import { describe, expect, it } from "vitest";
import {
  parseDesignDescriptor,
  validateDesignDescriptor,
  type DesignValidationCode,
} from "../src/index.js";

const path = "designs/concepts/warm-modern.json";
const minimal = {
  schema: "planaxis-design/1.0",
  name: "Warm modern",
  architecture: "architecture/alternatives/apartment.svg",
};
const assignment = { target: "floor", material: "assets/materials/oak" };

function expectInvalid(value: unknown, code: DesignValidationCode, location: string): void {
  expect(validateDesignDescriptor(value, path)).toMatchObject({
    ok: false,
    error: { stage: "format", code, location, message: expect.any(String) },
  });
}

describe("Design 1.0 JSON and trusted identity", () => {
  it("accepts the minimum descriptor without inserting optional defaults or a serialized ID", () => {
    const result = parseDesignDescriptor(JSON.stringify(minimal), path);
    expect(result).toEqual({ ok: true, value: { path, document: minimal } });
    if (!result.ok) throw new Error("Expected valid design.");
    expect(JSON.stringify(result.value.document)).toBe(JSON.stringify(minimal));
    expect(
      parseDesignDescriptor(JSON.stringify(minimal), "designs/archive/warm-modern.json"),
    ).toMatchObject({ ok: true, value: { path: "designs/archive/warm-modern.json" } });
  });

  it("accepts a complete descriptor and preserves values without mutating or retaining raw input", () => {
    const document = {
      ...minimal,
      name: "  Warm modern 🏠  ",
      finishes: [{ ...assignment }],
      presentation: { toneMapping: "agx", exposureEv: 0.7 },
    };
    const before = structuredClone(document);
    const result = validateDesignDescriptor(document, path);
    expect(result).toEqual({ ok: true, value: { path, document: before } });
    expect(document).toEqual(before);
    if (!result.ok) throw new Error("Expected valid design.");
    document.name = "Changed";
    document.finishes[0]!.material = "assets/materials/changed";
    document.presentation.exposureEv = 99;
    expect(result.value.document).toEqual(before);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.document)).toBe(true);
    expect(Object.isFrozen(result.value.document.finishes)).toBe(true);
    expect(Object.isFrozen(result.value.document.finishes?.[0])).toBe(true);
    expect(Object.isFrozen(result.value.document.presentation)).toBe(true);
  });

  it("accepts a leading BOM without requiring one", () => {
    expect(parseDesignDescriptor(`\uFEFF${JSON.stringify(minimal)}`, path).ok).toBe(true);
  });

  it.each(["", "{", "{} {}", '{"name":}', '{"name":"x",}', "// comment\n{}", "NaN"])(
    "reports JSON syntax separately: %j",
    (text) => {
      expect(parseDesignDescriptor(text, path)).toMatchObject({
        ok: false,
        error: { stage: "json", code: "DESIGN_INVALID_JSON", location: "$" },
      });
    },
  );

  it.each([null, [], "design", 1, true])("rejects non-object roots: %j", (value) => {
    expect(parseDesignDescriptor(JSON.stringify(value), path)).toMatchObject({
      ok: false,
      error: { stage: "format", code: "DESIGN_INVALID_OBJECT", location: "$" },
    });
  });
});

describe("closed root and required fields", () => {
  it.each(["schema", "name", "architecture"] as const)("requires %s", (key) => {
    const value: Record<string, unknown> = { ...minimal };
    delete value[key];
    expectInvalid(value, "DESIGN_MISSING_PROPERTY", `$.${key}`);
  });

  it.each(["id", "active", "x-note", "geometry", "environment", "__proto__"])(
    "rejects the unknown property %s",
    (key) => expectInvalid({ ...minimal, [key]: true }, "DESIGN_UNKNOWN_PROPERTY", `$.${key}`),
  );

  it.each([null, 1, "", "planaxis-design/1.1", "planaxis-design/1.0 "])(
    "rejects unsupported schema %j",
    (schema) => expectInvalid({ ...minimal, schema }, "DESIGN_UNSUPPORTED_SCHEMA", "$.schema"),
  );

  it.each([null, 1, {}, "", " \t\n\r", "\u0085\u00A0\u2003\u2028\u2029\u3000\uFEFF"])(
    "rejects an empty or invalid name %j",
    (name) => expectInvalid({ ...minimal, name }, "DESIGN_INVALID_NAME", "$.name"),
  );

  it("does not accept inherited required fields", () => {
    expectInvalid(Object.create(minimal), "DESIGN_MISSING_PROPERTY", "$.schema");
  });
});

describe("portable project-relative paths", () => {
  const invalidPaths = [
    "",
    "/file",
    "//server/share/file",
    "C:/file",
    "C:file",
    "file:resource",
    "https://host/file",
    "child\\file",
    "child\0file",
    "child//file",
    "./file",
    "../file",
    "child/./file",
    "child/../file",
    "child/file:",
    "child/C:file",
    "child/http:resource",
    "child/",
  ];

  it.each(invalidPaths)("rejects unsafe syntax in every path role: %j", (invalid) => {
    expect(validateDesignDescriptor(minimal, `designs/${invalid}.json`)).toMatchObject({
      ok: false,
      error: { code: "DESIGN_INVALID_DESCRIPTOR_PATH", location: "descriptorPath" },
    });
    expectInvalid(
      { ...minimal, architecture: `architecture/${invalid}.svg` },
      "DESIGN_INVALID_ARCHITECTURE_PATH",
      "$.architecture",
    );
    expectInvalid(
      { ...minimal, finishes: [{ ...assignment, material: `assets/materials/${invalid}` }] },
      "DESIGN_INVALID_MATERIAL_PATH",
      "$.finishes[0].material",
    );
  });

  it.each([
    null,
    4,
    "designs",
    "designs/",
    "designs/.json",
    "designs/a.JSON",
    "designs/a.Json",
    "designs/a.json/",
    "other/a.json",
    "designs-other/a.json",
    "/designs/a.json",
    "C:/designs/a.json",
    "designs/a.json\n",
  ])("rejects invalid descriptor location %j", (descriptorPath) => {
    expect(validateDesignDescriptor(minimal, descriptorPath)).toMatchObject({
      ok: false,
      error: {
        stage: "format",
        code: "DESIGN_INVALID_DESCRIPTOR_PATH",
        location: "descriptorPath",
      },
    });
  });

  it.each(["designs/a.json", "designs/concepts/A space.json", "designs/archive/Élan.json"])(
    "accepts a descriptor location without extra naming rules: %s",
    (descriptorPath) => expect(validateDesignDescriptor(minimal, descriptorPath).ok).toBe(true),
  );

  it.each([
    null,
    1,
    "architecture",
    "architecture/",
    "architecture/.svg",
    "architecture/a.SVG",
    "architecture/a.Svg",
    "architecture/a.svg/",
    "architecture/a.svg\n",
    "other/a.svg",
    "architectures/a.svg",
    "/architecture/a.svg",
  ])("rejects invalid architecture path %j", (architecture) =>
    expectInvalid(
      { ...minimal, architecture },
      "DESIGN_INVALID_ARCHITECTURE_PATH",
      "$.architecture",
    ),
  );

  it.each([
    null,
    1,
    "assets/materials",
    "assets/materials/",
    "assets/materials-other/oak",
    "assets/models/chair.glb",
    "references/materials/oak.jpg",
    "../shared/material.json",
  ])("rejects invalid material path %j", (material) =>
    expectInvalid(
      { ...minimal, finishes: [{ ...assignment, material }] },
      "DESIGN_INVALID_MATERIAL_PATH",
      "$.finishes[0].material",
    ),
  );

  it.each([
    "assets/materials/oak-natural/material.json",
    "assets/materials/paint/warm-white",
    "assets/materials/tiles/matte-stone.material",
    "assets/materials/not-created-yet",
    "assets/materials/Oak finish.MATERIAL",
  ])(
    "accepts material resource paths without existence, content, or extension checks: %s",
    (material) =>
      expect(
        validateDesignDescriptor({ ...minimal, finishes: [{ ...assignment, material }] }, path).ok,
      ).toBe(true),
  );
});

describe("finish assignments", () => {
  it.each([null, {}, "floor", [], undefined])(
    "rejects present but invalid finishes %j",
    (finishes) => {
      expectInvalid({ ...minimal, finishes }, "DESIGN_INVALID_FINISHES", "$.finishes");
    },
  );

  it.each([null, [], "floor", 1])("requires assignment objects: %j", (finish) => {
    expectInvalid({ ...minimal, finishes: [finish] }, "DESIGN_INVALID_OBJECT", "$.finishes[0]");
  });

  it.each(["target", "material"] as const)("requires assignment %s", (key) => {
    const finish: Record<string, unknown> = { ...assignment };
    delete finish[key];
    expectInvalid(
      { ...minimal, finishes: [finish] },
      "DESIGN_MISSING_PROPERTY",
      `$.finishes[0].${key}`,
    );
  });

  it("rejects unknown assignment properties", () => {
    expectInvalid(
      { ...minimal, finishes: [{ ...assignment, "x-note": true }] },
      "DESIGN_UNKNOWN_PROPERTY",
      "$.finishes[0].x-note",
    );
  });

  it.each([
    "floor",
    "ceiling",
    "wall:W.a_1-2:side-negative",
    "wall:w:side-positive",
    "wall:w:opening:O.a_1-2:reveal-start",
    "wall:w:opening:o:reveal-end",
    "wall:w:opening:o:reveal-top",
    "wall:w:opening:o:reveal-bottom",
    "space:S.a_1-2:floor",
    "space:s:ceiling",
    "space:s:wall:w:side-negative",
    "space:s:wall:w:side-positive",
  ])("accepts supported target %s", (target) => {
    expect(
      validateDesignDescriptor({ ...minimal, finishes: [{ ...assignment, target }] }, path).ok,
    ).toBe(true);
  });

  it.each([
    null,
    0,
    "",
    "Floor",
    "floor\n",
    "ceiling\r",
    " wall:w:side-positive",
    "wall:w:side-positive\n",
    "wall:1wall:side-positive",
    "wall:_wall:side-positive",
    "wall:w é:side-positive",
    "wall:é:side-positive",
    "wall:w:side-top",
    "wall:w:side-positive:extra",
    "wall::side-positive",
    "wall:w:opening:1o:reveal-top",
    "wall:w:opening:o:reveal-side",
    "wall:w:opening:o:reveal-top\n",
    "space:1s:floor",
    "space:s:wall:1w:side-positive",
    "space:s:wall:w:side-positive\n",
    "space:s:wall:w:opening:o:reveal-start",
    "space:s:space:s:floor",
    "floor:extra",
  ])("rejects unsupported or malformed target %j", (target) => {
    expectInvalid(
      { ...minimal, finishes: [{ ...assignment, target }] },
      "DESIGN_INVALID_TARGET",
      "$.finishes[0].target",
    );
  });

  it.each(["assets/materials/oak", "assets/materials/tile"])(
    "rejects duplicates even for material %s",
    (material) => {
      expectInvalid(
        {
          ...minimal,
          finishes: [assignment, { ...assignment, target: "ceiling" }, { ...assignment, material }],
        },
        "DESIGN_DUPLICATE_TARGET",
        "$.finishes[2].target",
      );
    },
  );

  it("preserves overlapping base and space assignments without inventing precedence", () => {
    const finishes = [assignment, { ...assignment, target: "space:room:floor" }];
    expect(validateDesignDescriptor({ ...minimal, finishes }, path)).toMatchObject({
      ok: true,
      value: { document: { finishes } },
    });
  });
});

describe("presentation overrides", () => {
  it.each([null, [], "agx", 1, undefined])("rejects non-object presentation %j", (presentation) => {
    expectInvalid({ ...minimal, presentation }, "DESIGN_INVALID_OBJECT", "$.presentation");
  });

  it("rejects an empty presentation", () => {
    expectInvalid(
      { ...minimal, presentation: {} },
      "DESIGN_INVALID_PRESENTATION",
      "$.presentation",
    );
  });

  it.each(["environment", "intensity", "camera", "x-note"])(
    "rejects presentation property %s",
    (key) => {
      expectInvalid(
        { ...minimal, presentation: { exposureEv: 0, [key]: true } },
        "DESIGN_UNKNOWN_PROPERTY",
        `$.presentation.${key}`,
      );
    },
  );

  it.each(["agx", "aces-filmic", "neutral"])(
    "accepts tone mapping %s without default exposure",
    (toneMapping) => {
      expect(validateDesignDescriptor({ ...minimal, presentation: { toneMapping } }, path)).toEqual(
        { ok: true, value: { path, document: { ...minimal, presentation: { toneMapping } } } },
      );
    },
  );

  it.each([null, 0, "AgX", "aces", "linear", "agx ", undefined])(
    "rejects invalid tone mapping %j",
    (toneMapping) => {
      expectInvalid(
        { ...minimal, presentation: { toneMapping } },
        "DESIGN_INVALID_TONE_MAPPING",
        "$.presentation.toneMapping",
      );
    },
  );

  it.each([0, -0, -1.5, 6, -1000, 1000, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE])(
    "preserves finite exposure %s without UI range restrictions or default tone mapping",
    (exposureEv) => {
      const result = validateDesignDescriptor({ ...minimal, presentation: { exposureEv } }, path);
      expect(result).toEqual({
        ok: true,
        value: { path, document: { ...minimal, presentation: { exposureEv } } },
      });
      if (!result.ok) throw new Error("Expected valid design.");
      expect(result.value.document.presentation?.exposureEv).toBe(exposureEv);
    },
  );

  it.each([null, "1", true, {}, NaN, Infinity, -Infinity, undefined])(
    "rejects non-finite or non-number exposure %s",
    (exposureEv) => {
      expectInvalid(
        { ...minimal, presentation: { exposureEv } },
        "DESIGN_INVALID_EXPOSURE",
        "$.presentation.exposureEv",
      );
    },
  );

  it("rejects JSON number overflow during format validation", () => {
    const text = JSON.stringify({ ...minimal, presentation: { exposureEv: 0 } }).replace(
      '"exposureEv":0',
      '"exposureEv":1e400',
    );
    expect(parseDesignDescriptor(text, path)).toMatchObject({
      ok: false,
      error: { stage: "format", code: "DESIGN_INVALID_EXPOSURE" },
    });
  });
});
