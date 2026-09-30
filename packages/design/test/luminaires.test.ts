import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DESIGN_SCHEMA,
  DESIGN_SCHEMA_1_1,
  validateDesignDescriptor,
  resolveDesignArchitecture,
  type DesignDocument,
  type DesignLuminaire,
  type DesignValidationCode,
} from "../src/index.js";

const minimal = { schema: DESIGN_SCHEMA_1_1, name: "Lighting", architecture: "architecture/a.svg" };
const position = { x: -2000.25, y: 1e6, z: -50.5 };
const orientation = { headingDegrees: 359.99, pitchDegrees: 90, rollDegrees: 0 };
const point = {
  id: "Lamp_1.test",
  type: "point",
  position,
  luminousFluxLumens: 1234.5,
  colorTemperatureKelvin: 2700,
  enabled: false,
  dimming: 0.75,
};
const spot = { ...point, id: "spot", type: "spot", orientation, beamAngleDegrees: 36 };
const linear = { ...point, id: "linear", type: "linear", orientation, lengthCm: 123.45 };
const area = { ...point, id: "area", type: "area", orientation, widthCm: 80, heightCm: 40 };
const luminaires = [point, spot, linear, area];
const check = (value: unknown) => validateDesignDescriptor(value, "designs/test.json");
function invalid(luminaire: unknown, code: DesignValidationCode, field = ""): void {
  expect(check({ ...minimal, luminaires: [luminaire] })).toMatchObject({
    ok: false,
    error: { stage: "format", code, location: `$.luminaires[0]${field}` },
  });
}

describe("versioned luminaire persistence", () => {
  it.each([DESIGN_SCHEMA, DESIGN_SCHEMA_1_1])(
    "accepts minimal %s without migration or defaults",
    (schema) => {
      const document = { ...minimal, schema };
      expect(check(document)).toEqual({ ok: true, value: { path: "designs/test.json", document } });
    },
  );
  it("rejects luminaires under Design 1.0", () => {
    expect(check({ ...minimal, schema: DESIGN_SCHEMA, luminaires })).toMatchObject({
      ok: false,
      error: { code: "DESIGN_UNKNOWN_PROPERTY", location: "$.luminaires" },
    });
  });
  it("exposes discriminated schema and luminaire types", () => {
    expectTypeOf<
      Extract<DesignDocument, { schema: typeof DESIGN_SCHEMA }>["luminaires"]
    >().toEqualTypeOf<undefined>();
    expectTypeOf<Extract<DesignLuminaire, { type: "area" }>["widthCm"]>().toEqualTypeOf<number>();
  });
  it("copies and deeply freezes all four types, preserving values and order", () => {
    const input = structuredClone({ ...minimal, luminaires });
    const before = structuredClone(input);
    const result = check(input);
    expect(result).toEqual({ ok: true, value: { path: "designs/test.json", document: before } });
    if (!result.ok || result.value.document.schema !== DESIGN_SCHEMA_1_1)
      throw new Error("Expected Design 1.1.");
    input.luminaires[0]!.position.z = 999;
    input.luminaires.reverse();
    expect(result.value.document).toEqual(before);
    expect(Object.isFrozen(result.value.document.luminaires)).toBe(true);
    for (const luminaire of result.value.document.luminaires ?? []) {
      expect(Object.isFrozen(luminaire)).toBe(true);
      expect(Object.isFrozen(luminaire.position)).toBe(true);
      if (luminaire.type !== "point") expect(Object.isFrozen(luminaire.orientation)).toBe(true);
    }
  });
  it.each([undefined, null, {}, [], "lights"])("rejects invalid array %j", (value) => {
    expect(check({ ...minimal, luminaires: value })).toMatchObject({
      ok: false,
      error: { code: "DESIGN_INVALID_LUMINAIRES", location: "$.luminaires" },
    });
  });
  it("rejects duplicate IDs across types", () => {
    expect(check({ ...minimal, luminaires: [point, { ...area, id: point.id }] })).toMatchObject({
      ok: false,
      error: { code: "DESIGN_DUPLICATE_LUMINAIRE_ID", location: "$.luminaires[1].id" },
    });
  });
  it.each(["", "1lamp", " lamp", "lamp ", "lamp\n", "lamp\r", "á", "lamp:x", null, 1])(
    "rejects ID %j",
    (id) => invalid({ ...point, id }, "DESIGN_INVALID_LUMINAIRE_ID", ".id"),
  );
  it.each([null, [], 1, "lamp"])("rejects non-object %j", (value) =>
    invalid(value, "DESIGN_INVALID_OBJECT"),
  );
  it.each(["PointLight", "Point", "directional", "spot ", 1, null])("rejects type %j", (type) =>
    invalid({ ...point, type }, "DESIGN_INVALID_LUMINAIRE_TYPE", ".type"),
  );

  for (const luminaire of luminaires) {
    it.each(Object.keys(luminaire))(`${luminaire.type} requires %s`, (key) => {
      const raw: Record<string, unknown> = { ...luminaire };
      delete raw[key];
      invalid(raw, "DESIGN_MISSING_PROPERTY", `.${key}`);
    });
    it.each(
      ["orientation", "beamAngleDegrees", "lengthCm", "widthCm", "heightCm"].filter(
        (key) => !(key in luminaire),
      ),
    )(`${luminaire.type} prohibits %s`, (key) =>
      invalid({ ...luminaire, [key]: 1 }, "DESIGN_UNKNOWN_PROPERTY", `.${key}`),
    );
    it.each([
      "rgb",
      "color",
      "ies",
      "iesProfile",
      "photometricProfile",
      "fixtureModel",
      "model",
      "utility",
      "attachment",
      "wall",
      "ceiling",
      "space",
      "parent",
      "host",
      "target",
      "x-note",
    ])(`${luminaire.type} rejects unsupported %s`, (key) =>
      invalid({ ...luminaire, [key]: "resource" }, "DESIGN_UNKNOWN_PROPERTY", `.${key}`),
    );
  }
  for (const [key, base, nested] of [
    ["position", point, position],
    ["orientation", spot, orientation],
  ] as const) {
    it.each([null, [], 1, "value"])(`rejects invalid ${key} %j`, (value) =>
      invalid({ ...base, [key]: value }, "DESIGN_INVALID_OBJECT", `.${key}`),
    );
    it(`closes ${key} recursively`, () =>
      invalid(
        { ...base, [key]: { ...nested, extra: 0 } },
        "DESIGN_UNKNOWN_PROPERTY",
        `.${key}.extra`,
      ));
    for (const field of Object.keys(nested)) {
      it(`requires ${key}.${field}`, () => {
        const raw: Record<string, unknown> = { ...nested };
        delete raw[field];
        invalid({ ...base, [key]: raw }, "DESIGN_MISSING_PROPERTY", `.${key}.${field}`);
      });
      it.each([NaN, Infinity, -Infinity, "0", null, true])(
        `rejects non-finite/non-numeric ${key}.${field}: %j`,
        (value) =>
          invalid(
            { ...base, [key]: { ...nested, [field]: value } },
            "DESIGN_INVALID_LUMINAIRE_NUMBER",
            `.${key}.${field}`,
          ),
      );
    }
  }
  for (const [base, field, rejected, accepted] of [
    [point, "luminousFluxLumens", [0, -1], [0.001, 1e8]],
    [point, "colorTemperatureKelvin", [0, -1], [0.001, 1e8]],
    [point, "dimming", [-0.001, 1.001], [0, 1]],
    [spot, "beamAngleDegrees", [0, -1, 180, 181], [0.001, 179.999]],
    [linear, "lengthCm", [0, -1], [0.001, 1e8]],
    [area, "widthCm", [0, -1], [0.001, 1e8]],
    [area, "heightCm", [0, -1], [0.001, 1e8]],
  ] as const) {
    it.each([...rejected, NaN, Infinity, -Infinity, "1", null, true])(
      `rejects ${field} %j`,
      (value) =>
        invalid({ ...base, [field]: value }, "DESIGN_INVALID_LUMINAIRE_NUMBER", `.${field}`),
    );
    it.each(accepted)(`accepts ${field} %s`, (value) =>
      expect(check({ ...minimal, luminaires: [{ ...base, [field]: value }] }).ok).toBe(true),
    );
  }
  for (const [field, rejected, accepted] of [
    ["headingDegrees", [-0.001, 360], [0, 359.999]],
    ["pitchDegrees", [-90.001, 90.001], [-90, 90]],
    ["rollDegrees", [-0.001, 360], [0, 359.999]],
  ] as const) {
    it.each(rejected)(`rejects ${field} %s`, (value) =>
      invalid(
        { ...spot, orientation: { ...orientation, [field]: value } },
        "DESIGN_INVALID_LUMINAIRE_NUMBER",
        `.orientation.${field}`,
      ),
    );
    it.each(accepted)(`accepts ${field} %s`, (value) =>
      expect(
        check({
          ...minimal,
          luminaires: [{ ...spot, orientation: { ...orientation, [field]: value } }],
        }).ok,
      ).toBe(true),
    );
  }
  it.each([0, 1, "false", null])("rejects enabled %j", (enabled) =>
    invalid({ ...point, enabled }, "DESIGN_INVALID_LUMINAIRE_ENABLED", ".enabled"),
  );
  it("resolves awkward positions without attachment or geometric checks and retains all data", () => {
    const result = check({ ...minimal, luminaires });
    if (!result.ok) throw new Error("Expected valid descriptor.");
    const resolved = resolveDesignArchitecture(result.value, {
      path: minimal.architecture,
      finishTargets: [],
    });
    expect(resolved).toEqual({ ok: true, value: result.value });
    if (!resolved.ok) throw new Error("Expected resolution.");
    expect(resolved.value).toBe(result.value);
    expect(resolved.value.document.luminaires).toEqual(luminaires);
  });
});
