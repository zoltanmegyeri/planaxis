import { describe, expect, it } from "vitest";
import {
  MATERIAL_SCHEMA,
  MATERIAL_SCHEMA_1_1,
  getEffectiveMaterial,
  parseMaterialDescriptor,
  validateMaterialDescriptor,
  type MaterialValidationCode,
  type ValidatedMaterialDescriptor,
} from "../src/index.js";

const path = "assets/materials/paint/warm-white.json";
const minimal = { schema: MATERIAL_SCHEMA, name: "Warm white" };
const mapping = { widthCm: 120, heightCm: 20 };
const texture = "assets/materials/shared/packed.webp";
const textured = { ...minimal, mapping, maps: { baseColor: texture } };

function valid(value: unknown): ValidatedMaterialDescriptor {
  const result = validateMaterialDescriptor(value, path);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected a valid material.");
  return result.value;
}

function expectInvalid(value: unknown, code: MaterialValidationCode, location: string): void {
  expect(validateMaterialDescriptor(value, path)).toMatchObject({
    ok: false,
    error: { stage: "format", code, location, message: expect.any(String) },
  });
}

describe("Material 1.0 JSON and trusted identity", () => {
  it("accepts the minimum descriptor without inserting defaults or serialized identity", () => {
    expect(parseMaterialDescriptor(JSON.stringify(minimal), path)).toEqual({
      ok: true,
      value: { path, document: minimal },
    });
    const renamedPath = "assets/materials/archive/renamed.json";
    expect(validateMaterialDescriptor(minimal, renamedPath)).toEqual({
      ok: true,
      value: { path: renamedPath, document: minimal },
    });
  });

  it("accepts and detaches a complete descriptor while preserving its durable values", () => {
    const input = {
      ...minimal,
      name: "  Natural oak 🪵  ",
      baseColor: [0.88, 0.84, 0.76],
      roughness: 0.7,
      metalness: 1,
      mapping: { ...mapping },
      maps: {
        baseColor: "assets/materials/oak/color.png",
        roughness: texture,
        metalness: texture,
        normal: "assets/materials/another/normal.jpeg",
      },
      alpha: { mode: "mask", opacity: 0.8, cutoff: 0.5 },
    };
    const before = structuredClone(input);
    const descriptor = valid(input);
    expect(descriptor).toEqual({ path, document: before });
    expect(input).toEqual(before);
    expect(Object.isFrozen(input)).toBe(false);
    input.baseColor[0] = 0;
    input.mapping.widthCm = 1;
    input.maps.baseColor = "changed";
    input.alpha.cutoff = 0;
    input.name = "Changed";
    expect(descriptor.document).toEqual(before);
    for (const value of [
      descriptor,
      descriptor.document,
      descriptor.document.baseColor,
      descriptor.document.mapping,
      descriptor.document.maps,
      descriptor.document.alpha,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("accepts a leading BOM", () => {
    expect(parseMaterialDescriptor(`\uFEFF${JSON.stringify(minimal)}`, path).ok).toBe(true);
  });

  it.each(["", "{", "{} {}", '{"name":}', '{"name":"x",}', "// comment\n{}", "NaN"])(
    "reports syntax failures separately: %j",
    (text) => {
      expect(parseMaterialDescriptor(text, path)).toMatchObject({
        ok: false,
        error: { stage: "json", code: "MATERIAL_INVALID_JSON", location: "$" },
      });
    },
  );

  it.each([null, [], "material", 1, true])("rejects non-object JSON roots: %j", (value) => {
    expect(parseMaterialDescriptor(JSON.stringify(value), path)).toMatchObject({
      ok: false,
      error: { stage: "format", code: "MATERIAL_INVALID_OBJECT", location: "$" },
    });
  });

  it("rejects numeric overflow as a format failure after successful JSON parsing", () => {
    expect(
      parseMaterialDescriptor(
        '{"schema":"planaxis-material/1.0","name":"Overflow","roughness":1e400}',
        path,
      ),
    ).toMatchObject({
      ok: false,
      error: { stage: "format", code: "MATERIAL_INVALID_FACTOR", location: "$.roughness" },
    });
  });
});

describe("closed objects and required fields", () => {
  it.each(["schema", "name"])("requires %s", (key) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[key];
    expectInvalid(input, "MATERIAL_MISSING_PROPERTY", `$.${key}`);
  });

  it.each([undefined, null, 1, "", "planaxis-material/1.2", "planaxis-material/1.0 "])(
    "rejects unsupported schema %j",
    (schema) => expectInvalid({ ...minimal, schema }, "MATERIAL_UNSUPPORTED_SCHEMA", "$.schema"),
  );

  it.each([undefined, null, 1, {}, "", " \t\n\r", "\u0085\u00A0\u2003\u2028\u2029\u3000\uFEFF"])(
    "rejects blank or non-string names %j",
    (name) => expectInvalid({ ...minimal, name }, "MATERIAL_INVALID_NAME", "$.name"),
  );

  it.each(["id", "path", "geometry", "rotationDegrees", "x-note", "data-x-note", "__proto__"])(
    "rejects unknown root property %s",
    (key) => expectInvalid({ ...minimal, [key]: true }, "MATERIAL_UNKNOWN_PROPERTY", `$.${key}`),
  );

  it.each([
    [{ ...textured, mapping: { ...mapping, rotation: 90 } }, "$.mapping.rotation"],
    [{ ...textured, maps: { ...textured.maps, alpha: texture } }, "$.maps.alpha"],
    [{ ...textured, maps: { ...textured.maps, emissive: texture } }, "$.maps.emissive"],
    [{ ...minimal, alpha: { mode: "blend", "x-note": true } }, "$.alpha.x-note"],
  ])("rejects unknown nested properties: %j", (input, location) => {
    expectInvalid(input, "MATERIAL_UNKNOWN_PROPERTY", location);
  });

  it("does not accept inherited required fields or import inherited optional fields", () => {
    expectInvalid(Object.create(minimal), "MATERIAL_MISSING_PROPERTY", "$.schema");
    const input: unknown = Object.assign(Object.create({ roughness: 0.2 }), minimal);
    expect(valid(input).document).toEqual(minimal);
  });
});

describe("Material 1.1 ambient occlusion and version compatibility", () => {
  const scalar = { ...minimal, schema: MATERIAL_SCHEMA_1_1 };
  const ao = { ...scalar, mapping, maps: { ambientOcclusion: texture } };

  it("accepts scalar-only 1.1 without introducing AO state in either schema", () => {
    for (const input of [minimal, scalar, textured, { ...textured, schema: MATERIAL_SCHEMA_1_1 }]) {
      const parsed = parseMaterialDescriptor(JSON.stringify(input), path);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error("Expected supported material.");
      expect(parsed.value.document).toEqual(input);
      expect(getEffectiveMaterial(parsed.value)).not.toHaveProperty("ambientOcclusionStrength");
    }
    expect(getEffectiveMaterial(valid(scalar))).toEqual(getEffectiveMaterial(valid(minimal)));
  });

  it("defaults AO strength only in effective semantics and preserves immutable packed ORM references", () => {
    const input = {
      ...ao,
      metalness: 1,
      maps: {
        ambientOcclusion: texture,
        roughness: texture,
        metalness: texture,
      },
    };
    const descriptor = valid(input);
    const effective = getEffectiveMaterial(descriptor);
    expect(descriptor.document).toEqual(input);
    expect(descriptor.document).not.toHaveProperty("ambientOcclusionStrength");
    expect(effective).toMatchObject({ ambientOcclusionStrength: 1, maps: input.maps, mapping });
    expect(Object.isFrozen(effective)).toBe(true);
    expect(Object.isFrozen(effective.maps)).toBe(true);
    input.maps.ambientOcclusion = "changed";
    expect(effective.maps?.ambientOcclusion).toBe(texture);
  });

  it.each([0, 0.4, 1])("preserves explicit AO strength %s", (ambientOcclusionStrength) => {
    const input = { ...ao, ambientOcclusionStrength };
    const result = parseMaterialDescriptor(JSON.stringify(input), path);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected AO material.");
    expect(result.value.document).toEqual(input);
    expect(getEffectiveMaterial(result.value).ambientOcclusionStrength).toBe(
      ambientOcclusionStrength,
    );
  });

  it.each([undefined, null, "0.5", true, {}, [], NaN, Infinity, -Infinity, -0.01, 1.01])(
    "rejects invalid AO strength %s",
    (ambientOcclusionStrength) => {
      expectInvalid(
        { ...ao, ambientOcclusionStrength },
        "MATERIAL_INVALID_FACTOR",
        "$.ambientOcclusionStrength",
      );
    },
  );

  it.each([scalar, { ...textured, schema: MATERIAL_SCHEMA_1_1 }])(
    "requires an AO map when strength exists: %j",
    (input) => {
      expectInvalid(
        { ...input, ambientOcclusionStrength: 0 },
        "MATERIAL_AMBIENT_OCCLUSION_COUPLING",
        "$.ambientOcclusionStrength",
      );
    },
  );

  it("keeps AO properties prohibited in Material 1.0", () => {
    expectInvalid(
      { ...ao, schema: MATERIAL_SCHEMA },
      "MATERIAL_UNKNOWN_PROPERTY",
      "$.maps.ambientOcclusion",
    );
    expectInvalid(
      { ...minimal, ambientOcclusionStrength: 1 },
      "MATERIAL_UNKNOWN_PROPERTY",
      "$.ambientOcclusionStrength",
    );
  });

  it.each(["png", "jpg", "jpeg", "webp"])("accepts AO .%s paths", (extension) => {
    const maps = { ambientOcclusion: `assets/materials/ao.${extension}` };
    expect(valid({ ...ao, maps }).document.maps).toEqual(maps);
  });

  it.each([
    undefined,
    null,
    1,
    "ao.png",
    "assets/materials/../ao.png",
    "assets/materials//ao.png",
    "/assets/materials/ao.png",
    "assets/materials/ao.PNG",
    "assets/materials/ao.avif",
    "references/ao.png",
  ])("rejects invalid AO path %j", (ambientOcclusion) => {
    expectInvalid(
      { ...ao, maps: { ambientOcclusion } },
      "MATERIAL_INVALID_TEXTURE_PATH",
      "$.maps.ambientOcclusion",
    );
  });

  it.each([
    [{ ...scalar, maps: ao.maps }, "MATERIAL_MAPPING_COUPLING", "$.mapping"],
    [{ ...scalar, mapping }, "MATERIAL_MAPPING_COUPLING", "$.mapping"],
    [{ ...ao, maps: {} }, "MATERIAL_EMPTY_MAPS", "$.maps"],
    [
      { ...ao, mapping: { ...mapping, widthCm: 0 } },
      "MATERIAL_INVALID_DIMENSION",
      "$.mapping.widthCm",
    ],
    [
      { ...ao, mapping: { ...mapping, rotation: 90 } },
      "MATERIAL_UNKNOWN_PROPERTY",
      "$.mapping.rotation",
    ],
    [
      { ...ao, maps: { ...ao.maps, height: texture } },
      "MATERIAL_UNKNOWN_PROPERTY",
      "$.maps.height",
    ],
    [{ ...ao, uvChannel: 1 }, "MATERIAL_UNKNOWN_PROPERTY", "$.uvChannel"],
    [
      { ...ao, alpha: { mode: "opaque", opacity: 1 } },
      "MATERIAL_UNKNOWN_PROPERTY",
      "$.alpha.opacity",
    ],
  ] as const)("retains mapping and closed-schema rules: %j", (input, code, location) => {
    expectInvalid(input, code, location);
  });
});

describe("canonical descriptor and texture paths", () => {
  const invalidSegments = [
    "/file",
    "//server/share",
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
    "child/C:file",
    "child/http:resource",
    "child/",
  ];

  it.each(invalidSegments)("rejects prohibited syntax in both path roles: %j", (invalid) => {
    expect(validateMaterialDescriptor(minimal, `assets/materials/${invalid}.json`)).toMatchObject({
      ok: false,
      error: { code: "MATERIAL_INVALID_DESCRIPTOR_PATH", location: "descriptorPath" },
    });
    expectInvalid(
      { ...textured, maps: { baseColor: `assets/materials/${invalid}.png` } },
      "MATERIAL_INVALID_TEXTURE_PATH",
      "$.maps.baseColor",
    );
  });

  it.each([
    undefined,
    null,
    4,
    "",
    "assets/materials",
    "assets/materials/",
    "assets/materials/.json",
    "assets/materials/a.JSON",
    "assets/materials/a.Json",
    "assets/materials/a.json/",
    "assets/materials/a.json\n",
    "assets/materials/a.json.txt",
    "assets/materials-other/a.json",
    "references/materials/a.json",
    "/assets/materials/a.json",
    "C:/assets/materials/a.json",
    "file:assets/materials/a.json",
  ])("rejects invalid descriptor identity %j", (descriptorPath) => {
    expect(validateMaterialDescriptor(minimal, descriptorPath)).toMatchObject({
      ok: false,
      error: {
        stage: "format",
        code: "MATERIAL_INVALID_DESCRIPTOR_PATH",
        location: "descriptorPath",
      },
    });
  });

  it.each([
    "assets/materials/a.json",
    "assets/materials/concepts/A space.json",
    "assets/materials/archive/Élan.json",
  ])("accepts descriptor paths without extra naming conventions: %s", (descriptorPath) => {
    expect(validateMaterialDescriptor(minimal, descriptorPath)).toMatchObject({
      ok: true,
      value: { path: descriptorPath },
    });
  });

  it.each(["png", "jpg", "jpeg", "webp"])(
    "accepts shared .%s textures for every map role",
    (extension) => {
      const reference = `assets/materials/not-created-yet/A texture.${extension}`;
      const maps = {
        baseColor: reference,
        roughness: reference,
        metalness: reference,
        normal: reference,
      };
      expect(valid({ ...textured, maps }).document.maps).toEqual(maps);
    },
  );

  it.each([
    undefined,
    null,
    1,
    "",
    "base-color.webp",
    "assets/materials",
    "assets/materials/",
    "assets/materials/.png",
    "assets/materials-other/a.png",
    "references/materials/a.jpg",
    "assets/models/a.png",
    "/assets/materials/a.png",
    "C:/assets/materials/a.png",
    "file:assets/materials/a.png",
    "https://example.test/a.png",
    "assets/materials/a.png\n",
    "assets/materials/a.png/",
    "assets/materials/a.png?size=1",
    "assets/materials/a.png#fragment",
  ])("rejects invalid texture reference %j", (reference) => {
    for (const role of ["baseColor", "roughness", "metalness", "normal"]) {
      expectInvalid(
        { ...textured, maps: { [role]: reference } },
        "MATERIAL_INVALID_TEXTURE_PATH",
        `$.maps.${role}`,
      );
    }
  });

  it.each([
    "PNG",
    "JPG",
    "JPEG",
    "WEBP",
    "Png",
    "avif",
    "gif",
    "svg",
    "tiff",
    "bmp",
    "hdr",
    "exr",
    "dds",
    "ktx",
    "ktx2",
    "bin",
    "json",
  ])("rejects unsupported or uppercase texture extension %s", (extension) => {
    expectInvalid(
      { ...textured, maps: { normal: `assets/materials/a.${extension}` } },
      "MATERIAL_INVALID_TEXTURE_PATH",
      "$.maps.normal",
    );
  });
});

describe("scalar PBR values", () => {
  const invalidFactors = [
    undefined,
    null,
    "0.5",
    true,
    {},
    [],
    NaN,
    Infinity,
    -Infinity,
    -0.01,
    1.01,
  ];
  it.each([0, -0, 1, 0.5, Number.MIN_VALUE])("preserves valid factor %s", (value) => {
    const input = {
      ...minimal,
      baseColor: [value, value, value],
      roughness: value,
      metalness: value,
    };
    expect(valid(input).document).toEqual(input);
  });

  it.each(invalidFactors)("rejects invalid factor %s in all scalar roles", (value) => {
    for (const key of ["roughness", "metalness"]) {
      expectInvalid({ ...minimal, [key]: value }, "MATERIAL_INVALID_FACTOR", `$.${key}`);
    }
    for (const index of [0, 1, 2]) {
      const baseColor: unknown[] = [1, 1, 1];
      baseColor[index] = value;
      expectInvalid({ ...minimal, baseColor }, "MATERIAL_INVALID_FACTOR", `$.baseColor[${index}]`);
    }
  });

  it.each([undefined, null, 1, "white", {}, [], [1], [1, 1], [1, 1, 1, 1]])(
    "rejects invalid RGB tuple %j",
    (baseColor) =>
      expectInvalid({ ...minimal, baseColor }, "MATERIAL_INVALID_BASE_COLOR", "$.baseColor"),
  );

  it("rejects holes in a parsed RGB array", () => {
    expectInvalid({ ...minimal, baseColor: Array(3) }, "MATERIAL_INVALID_FACTOR", "$.baseColor[0]");
  });
});

describe("texture maps and physical mapping", () => {
  it.each([
    { ...minimal, maps: textured.maps },
    { ...minimal, mapping },
    { ...minimal, maps: undefined },
    { ...minimal, mapping: undefined },
  ])("requires maps and mapping together: %j", (input) => {
    expectInvalid(input, "MATERIAL_MAPPING_COUPLING", "$.mapping");
  });

  it.each([undefined, null, [], "texture", 1])("rejects non-object maps/mapping %j", (value) => {
    expectInvalid({ ...textured, maps: value }, "MATERIAL_INVALID_OBJECT", "$.maps");
    expectInvalid({ ...textured, mapping: value }, "MATERIAL_INVALID_OBJECT", "$.mapping");
  });

  it("rejects empty maps", () => {
    expectInvalid({ ...textured, maps: {} }, "MATERIAL_EMPTY_MAPS", "$.maps");
  });

  it.each(["widthCm", "heightCm"])("requires physical %s", (key) => {
    const incomplete: Record<string, unknown> = { ...mapping };
    delete incomplete[key];
    expectInvalid(
      { ...textured, mapping: incomplete },
      "MATERIAL_MISSING_PROPERTY",
      `$.mapping.${key}`,
    );
  });

  it.each([undefined, null, "20", true, {}, NaN, Infinity, -Infinity, 0, -0, -1])(
    "rejects invalid physical dimension %s",
    (value) => {
      for (const key of ["widthCm", "heightCm"]) {
        expectInvalid(
          { ...textured, mapping: { ...mapping, [key]: value } },
          "MATERIAL_INVALID_DIMENSION",
          `$.mapping.${key}`,
        );
      }
    },
  );

  it.each([Number.MIN_VALUE, 0.1, 1, Number.MAX_VALUE])(
    "accepts positive finite dimensions %s",
    (value) => {
      const dimensions = { widthCm: value, heightCm: value };
      expect(valid({ ...textured, mapping: dimensions }).document.mapping).toEqual(dimensions);
    },
  );
});

describe("alpha variants", () => {
  it.each([
    { mode: "opaque" },
    { mode: "mask", cutoff: 0 },
    { mode: "mask", cutoff: 1 },
    { mode: "mask", cutoff: 0.5, opacity: 0 },
    { mode: "mask", cutoff: 0.5, opacity: 1 },
    { mode: "blend" },
    { mode: "blend", opacity: 0 },
    { mode: "blend", opacity: 1 },
    { mode: "blend", opacity: 0.75 },
  ])("preserves valid alpha without adding durable defaults: %j", (alpha) => {
    expect(valid({ ...minimal, alpha }).document.alpha).toEqual(alpha);
  });

  it.each([undefined, null, [], "opaque", 1])("rejects non-object alpha %j", (alpha) => {
    expectInvalid({ ...minimal, alpha }, "MATERIAL_INVALID_OBJECT", "$.alpha");
  });

  it.each([undefined, null, 1, "", "Opaque", "MASK", "transmission"])(
    "rejects alpha mode %j",
    (mode) => {
      expectInvalid({ ...minimal, alpha: { mode } }, "MATERIAL_INVALID_ALPHA_MODE", "$.alpha.mode");
    },
  );

  it("requires alpha mode and mask cutoff", () => {
    expectInvalid({ ...minimal, alpha: {} }, "MATERIAL_MISSING_PROPERTY", "$.alpha.mode");
    expectInvalid(
      { ...minimal, alpha: { mode: "mask" } },
      "MATERIAL_MISSING_PROPERTY",
      "$.alpha.cutoff",
    );
  });

  it.each([
    [{ mode: "opaque", opacity: 1 }, "opacity"],
    [{ mode: "opaque", cutoff: 0.5 }, "cutoff"],
    [{ mode: "blend", cutoff: 0.5 }, "cutoff"],
    [{ mode: "mask", cutoff: 0.5, map: texture }, "map"],
  ])("rejects properties outside an alpha variant: %j", (alpha, key) => {
    expectInvalid({ ...minimal, alpha }, "MATERIAL_UNKNOWN_PROPERTY", `$.alpha.${key}`);
  });

  it.each([undefined, null, "1", true, {}, NaN, Infinity, -Infinity, -0.01, 1.01])(
    "rejects invalid alpha factor %s",
    (value) => {
      expectInvalid(
        { ...minimal, alpha: { mode: "mask", cutoff: value } },
        "MATERIAL_INVALID_FACTOR",
        "$.alpha.cutoff",
      );
      for (const mode of ["mask", "blend"]) {
        const alpha = { mode, opacity: value, ...(mode === "mask" ? { cutoff: 0.5 } : {}) };
        expectInvalid({ ...minimal, alpha }, "MATERIAL_INVALID_FACTOR", "$.alpha.opacity");
      }
    },
  );
});

describe("effective Material 1.0 defaults", () => {
  it("exposes deterministic defaults without rewriting the document", () => {
    const descriptor = valid(minimal);
    const before = JSON.stringify(descriptor.document);
    const effective = getEffectiveMaterial(descriptor);
    expect(effective).toEqual({
      baseColor: [1, 1, 1],
      roughness: 1,
      metalness: 0,
      alpha: { mode: "opaque" },
    });
    expect(getEffectiveMaterial(descriptor)).toEqual(effective);
    expect(JSON.stringify(descriptor.document)).toBe(before);
    expect(descriptor.document).toEqual(minimal);
    expect(Object.isFrozen(effective)).toBe(true);
    expect(Object.isFrozen(effective.baseColor)).toBe(true);
    expect(Object.isFrozen(effective.alpha)).toBe(true);
  });

  it.each([
    [{ mode: "opaque" }, { mode: "opaque" }],
    [
      { mode: "mask", cutoff: 0.5 },
      { mode: "mask", cutoff: 0.5, opacity: 1 },
    ],
    [{ mode: "blend" }, { mode: "blend", opacity: 1 }],
    [
      { mode: "mask", cutoff: 0, opacity: 0 },
      { mode: "mask", cutoff: 0, opacity: 0 },
    ],
    [
      { mode: "blend", opacity: 0 },
      { mode: "blend", opacity: 0 },
    ],
  ])("defaults only omitted alpha values: %j", (alpha, expected) => {
    const descriptor = valid({ ...minimal, alpha });
    expect(getEffectiveMaterial(descriptor).alpha).toEqual(expected);
    expect(descriptor.document.alpha).toEqual(alpha);
  });

  it("preserves explicit zero factors, maps and physical dimensions", () => {
    const descriptor = valid({ ...textured, baseColor: [0, 0.5, 1], roughness: 0, metalness: 0 });
    expect(getEffectiveMaterial(descriptor)).toEqual({
      baseColor: [0, 0.5, 1],
      roughness: 0,
      metalness: 0,
      alpha: { mode: "opaque" },
      maps: textured.maps,
      mapping,
    });
  });

  it("does not infer a non-zero metalness factor from a metalness map", () => {
    const descriptor = valid({ ...textured, maps: { metalness: texture } });
    expect(getEffectiveMaterial(descriptor).metalness).toBe(0);
    expect(descriptor.document).not.toHaveProperty("metalness");
  });
});
