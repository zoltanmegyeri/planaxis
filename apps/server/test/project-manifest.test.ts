import { describe, expect, it } from "vitest";

import { parseProjectManifest, validateProjectManifest } from "../src/project/project-manifest.js";

const manifest = {
  schema: "planaxis-project/1.0",
  name: "Apartment renovation",
  architecture: { active: "architecture/existing.svg" },
};

describe("Project Format 1.0 manifest", () => {
  it.each(["Apartment", "  My apartment  ", "東京", "\u0085Home\u2003"])(
    "preserves the valid human-readable name %j",
    (name) => {
      expect(validateProjectManifest({ ...manifest, name })).toEqual({
        ok: true,
        value: { ...manifest, name },
      });
    },
  );

  it.each([
    null,
    [],
    "project",
    42,
    true,
    {},
    { name: manifest.name, architecture: manifest.architecture },
    { schema: manifest.schema, architecture: manifest.architecture },
    { schema: manifest.schema, name: manifest.name },
    { ...manifest, description: "Unknown" },
    { ...manifest, __proto__: null, extra: 1 },
  ])("rejects a nonconforming root object %j", (value) => {
    expect(validateProjectManifest(value)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_MANIFEST", location: "manifest" },
    });
  });

  it.each([null, 1, "", "planaxis-project/1.1", "planaxis-project/2.0", "planaxis-project/1.0 "])(
    "rejects unsupported schema %j",
    (schema) => {
      expect(validateProjectManifest({ ...manifest, schema })).toMatchObject({
        ok: false,
        error: { code: "PROJECT_UNSUPPORTED_SCHEMA", location: "schema" },
      });
    },
  );

  it.each([null, 0, false, [], {}, "", " \t\n\r", "\u00A0\u2003\u202F", "\u0085", "\uFEFF"])(
    "rejects invalid name %j",
    (name) => {
      expect(validateProjectManifest({ ...manifest, name })).toMatchObject({
        ok: false,
        error: { code: "PROJECT_INVALID_MANIFEST", location: "name" },
      });
    },
  );

  it.each([
    null,
    [],
    "architecture/existing.svg",
    1,
    {},
    { active: manifest.architecture.active, extra: 1 },
  ])("rejects invalid architecture object %j", (architecture) => {
    expect(validateProjectManifest({ ...manifest, architecture })).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_MANIFEST", location: "architecture" },
    });
  });

  it.each([
    null,
    1,
    "",
    "/architecture/existing.svg",
    "architecture/../existing.svg",
    "architecture/C:/existing.svg",
    "architecture\\existing.svg",
  ])("rejects unsafe active path %j", (active) => {
    expect(validateProjectManifest({ ...manifest, architecture: { active } })).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_PATH", location: "architecture.active" },
    });
  });

  it.each([
    "references/existing.svg",
    "architecture-other/existing.svg",
    "Architecture/existing.svg",
    "architecture",
    "architecture/existing.SVG",
    "architecture/.svg",
    "architecture/existing.svg.txt",
    "architecture/existing",
  ])("rejects misplaced or wrong-extension active path %j", (active) => {
    expect(validateProjectManifest({ ...manifest, architecture: { active } })).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_ARCHITECTURE_PATH", location: "architecture.active" },
    });
  });

  it("accepts nested architecture paths", () => {
    const value = {
      ...manifest,
      architecture: { active: "architecture/variants/open kitchen.svg" },
    };
    expect(validateProjectManifest(value)).toEqual({ ok: true, value });
  });

  it.each(["", "{", "{} {}", '{"schema":}', JSON.stringify(manifest) + " trailing"])(
    "rejects malformed JSON %j",
    (text) => {
      expect(parseProjectManifest(Buffer.from(text))).toMatchObject({
        ok: false,
        error: { code: "PROJECT_INVALID_JSON" },
      });
    },
  );

  it("rejects malformed UTF-8 rather than replacing bytes in the name", () => {
    const bytes = Buffer.concat([
      Buffer.from('{"schema":"planaxis-project/1.0","name":"'),
      Buffer.from([0xff]),
      Buffer.from('","architecture":{"active":"architecture/existing.svg"}}'),
    ]);
    expect(parseProjectManifest(bytes)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_JSON" },
    });
  });

  it.each(["", "\uFEFF"])("accepts UTF-8 JSON with optional BOM %j", (prefix) => {
    expect(parseProjectManifest(Buffer.from(prefix + JSON.stringify(manifest)))).toEqual({
      ok: true,
      value: manifest,
    });
  });

  it("applies closed schemas to JSON properties such as __proto__", () => {
    const text = JSON.stringify(manifest).replace("{", '{"__proto__":{},');
    expect(parseProjectManifest(Buffer.from(text))).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_MANIFEST" },
    });
  });
});
