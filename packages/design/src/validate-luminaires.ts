import { closedObject } from "./design-object.js";
import { designFailure, type DesignValidationResult } from "./design-result.js";
import type {
  DesignLuminaire,
  DesignLuminaireOrientation,
  DesignLuminairePosition,
} from "./design.js";

function finiteNumber(
  value: unknown,
  location: string,
  accepts: (value: number) => boolean = () => true,
  constraint = "a finite JSON number",
): DesignValidationResult<number> {
  return typeof value === "number" && Number.isFinite(value) && accepts(value)
    ? { ok: true, value }
    : designFailure("DESIGN_INVALID_LUMINAIRE_NUMBER", location, `Expected ${constraint}.`);
}

function position(
  value: unknown,
  location: string,
): DesignValidationResult<DesignLuminairePosition> {
  const checked = closedObject(value, location, ["x", "y", "z"], ["x", "y", "z"]);
  if (!checked.ok) return checked;
  const x = finiteNumber(checked.value.x, `${location}.x`);
  if (!x.ok) return x;
  const y = finiteNumber(checked.value.y, `${location}.y`);
  if (!y.ok) return y;
  const z = finiteNumber(checked.value.z, `${location}.z`);
  if (!z.ok) return z;
  return { ok: true, value: Object.freeze({ x: x.value, y: y.value, z: z.value }) };
}

function orientation(
  value: unknown,
  location: string,
): DesignValidationResult<DesignLuminaireOrientation> {
  const keys = ["headingDegrees", "pitchDegrees", "rollDegrees"];
  const checked = closedObject(value, location, keys, keys);
  if (!checked.ok) return checked;
  const heading = finiteNumber(
    checked.value.headingDegrees,
    `${location}.headingDegrees`,
    (n) => n >= 0 && n < 360,
    "a finite number in [0, 360)",
  );
  if (!heading.ok) return heading;
  const pitch = finiteNumber(
    checked.value.pitchDegrees,
    `${location}.pitchDegrees`,
    (n) => n >= -90 && n <= 90,
    "a finite number in [-90, 90]",
  );
  if (!pitch.ok) return pitch;
  const roll = finiteNumber(
    checked.value.rollDegrees,
    `${location}.rollDegrees`,
    (n) => n >= 0 && n < 360,
    "a finite number in [0, 360)",
  );
  if (!roll.ok) return roll;
  return {
    ok: true,
    value: Object.freeze({
      headingDegrees: heading.value,
      pitchDegrees: pitch.value,
      rollDegrees: roll.value,
    }),
  };
}

const commonKeys = [
  "id",
  "type",
  "position",
  "luminousFluxLumens",
  "colorTemperatureKelvin",
  "enabled",
  "dimming",
];

function validateLuminaire(
  value: unknown,
  location: string,
): DesignValidationResult<DesignLuminaire> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return designFailure("DESIGN_INVALID_OBJECT", location, "Expected a JSON object.");
  }
  if (!Object.hasOwn(value, "type")) {
    return designFailure(
      "DESIGN_MISSING_PROPERTY",
      `${location}.type`,
      "Required property is missing.",
    );
  }
  const type = "type" in value ? value.type : undefined;
  if (type !== "point" && type !== "spot" && type !== "linear" && type !== "area") {
    return designFailure(
      "DESIGN_INVALID_LUMINAIRE_TYPE",
      `${location}.type`,
      "Expected point, spot, linear, or area.",
    );
  }
  const keys = [
    ...commonKeys,
    ...(type === "point" ? [] : ["orientation"]),
    ...(type === "spot"
      ? ["beamAngleDegrees"]
      : type === "linear"
        ? ["lengthCm"]
        : type === "area"
          ? ["widthCm", "heightCm"]
          : []),
  ];
  const checked = closedObject(value, location, keys, keys);
  if (!checked.ok) return checked;
  const raw = checked.value;
  if (typeof raw.id !== "string" || !/^[A-Za-z][A-Za-z0-9._-]*(?![\s\S])/.test(raw.id)) {
    return designFailure(
      "DESIGN_INVALID_LUMINAIRE_ID",
      `${location}.id`,
      "Expected a design-local identifier matching [A-Za-z][A-Za-z0-9._-]*.",
    );
  }
  const placed = position(raw.position, `${location}.position`);
  if (!placed.ok) return placed;
  const flux = finiteNumber(
    raw.luminousFluxLumens,
    `${location}.luminousFluxLumens`,
    (n) => n > 0,
    "a positive finite number",
  );
  if (!flux.ok) return flux;
  const kelvin = finiteNumber(
    raw.colorTemperatureKelvin,
    `${location}.colorTemperatureKelvin`,
    (n) => n > 0,
    "a positive finite number",
  );
  if (!kelvin.ok) return kelvin;
  if (typeof raw.enabled !== "boolean") {
    return designFailure(
      "DESIGN_INVALID_LUMINAIRE_ENABLED",
      `${location}.enabled`,
      "Expected a JSON boolean.",
    );
  }
  const dimming = finiteNumber(
    raw.dimming,
    `${location}.dimming`,
    (n) => n >= 0 && n <= 1,
    "a finite number in [0, 1]",
  );
  if (!dimming.ok) return dimming;
  const common = {
    id: raw.id,
    position: placed.value,
    luminousFluxLumens: flux.value,
    colorTemperatureKelvin: kelvin.value,
    enabled: raw.enabled,
    dimming: dimming.value,
  };
  if (type === "point") return { ok: true, value: Object.freeze({ ...common, type }) };
  const oriented = orientation(raw.orientation, `${location}.orientation`);
  if (!oriented.ok) return oriented;
  const directional = { ...common, orientation: oriented.value };
  if (type === "spot") {
    const beam = finiteNumber(
      raw.beamAngleDegrees,
      `${location}.beamAngleDegrees`,
      (n) => n > 0 && n < 180,
      "a finite full cone angle in (0, 180)",
    );
    if (!beam.ok) return beam;
    return {
      ok: true,
      value: Object.freeze({ ...directional, type, beamAngleDegrees: beam.value }),
    };
  }
  if (type === "linear") {
    const length = finiteNumber(
      raw.lengthCm,
      `${location}.lengthCm`,
      (n) => n > 0,
      "a positive finite number",
    );
    if (!length.ok) return length;
    return { ok: true, value: Object.freeze({ ...directional, type, lengthCm: length.value }) };
  }
  const width = finiteNumber(
    raw.widthCm,
    `${location}.widthCm`,
    (n) => n > 0,
    "a positive finite number",
  );
  if (!width.ok) return width;
  const height = finiteNumber(
    raw.heightCm,
    `${location}.heightCm`,
    (n) => n > 0,
    "a positive finite number",
  );
  if (!height.ok) return height;
  return {
    ok: true,
    value: Object.freeze({ ...directional, type, widthCm: width.value, heightCm: height.value }),
  };
}

export function validateLuminaires(
  value: unknown,
): DesignValidationResult<readonly DesignLuminaire[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return designFailure(
      "DESIGN_INVALID_LUMINAIRES",
      "$.luminaires",
      "Expected a non-empty array of luminaires.",
    );
  }
  const ids = new Set<string>();
  const luminaires: DesignLuminaire[] = [];
  for (const [index, item] of value.entries()) {
    const location = `$.luminaires[${index}]`;
    const checked = validateLuminaire(item, location);
    if (!checked.ok) return checked;
    if (ids.has(checked.value.id)) {
      return designFailure(
        "DESIGN_DUPLICATE_LUMINAIRE_ID",
        `${location}.id`,
        "Luminaire IDs must be unique within the design.",
      );
    }
    ids.add(checked.value.id);
    luminaires.push(checked.value);
  }
  return { ok: true, value: Object.freeze(luminaires) };
}
