import { isMaterialFilePath } from "./material-path.js";
import { materialFailure, type MaterialValidationResult } from "./material-result.js";
import {
  MATERIAL_SCHEMA,
  type MaterialAlpha,
  type MaterialBaseColor,
  type MaterialDocument,
  type MaterialMapping,
  type MaterialMaps,
  type MaterialTextures,
  type ValidatedMaterialDescriptor,
} from "./material.js";

function closedObject(
  value: unknown,
  location: string,
  allowed: readonly string[],
  required: readonly string[] = [],
): MaterialValidationResult<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return materialFailure("MATERIAL_INVALID_OBJECT", location, "Expected a JSON object.");
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return materialFailure(
        "MATERIAL_UNKNOWN_PROPERTY",
        `${location}.${key}`,
        "Unknown properties are prohibited.",
      );
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      return materialFailure(
        "MATERIAL_MISSING_PROPERTY",
        `${location}.${key}`,
        "Required property is missing.",
      );
    }
  }
  return { ok: true, value: value as Record<string, unknown> };
}

function factor(value: unknown, location: string): MaterialValidationResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return materialFailure(
      "MATERIAL_INVALID_FACTOR",
      location,
      "Expected a finite JSON number in [0, 1].",
    );
  }
  return { ok: true, value };
}

function validateBaseColor(value: unknown): MaterialValidationResult<MaterialBaseColor> {
  if (!Array.isArray(value) || value.length !== 3) {
    return materialFailure(
      "MATERIAL_INVALID_BASE_COLOR",
      "$.baseColor",
      "Expected exactly three RGB components.",
    );
  }
  // Check indices explicitly: sparse arrays supplied through the parsed-value API are invalid.
  const red = factor(value[0], "$.baseColor[0]");
  if (!red.ok) return red;
  const green = factor(value[1], "$.baseColor[1]");
  if (!green.ok) return green;
  const blue = factor(value[2], "$.baseColor[2]");
  if (!blue.ok) return blue;
  return { ok: true, value: Object.freeze([red.value, green.value, blue.value] as const) };
}

function validateMapping(value: unknown): MaterialValidationResult<MaterialMapping> {
  const checked = closedObject(
    value,
    "$.mapping",
    ["widthCm", "heightCm"],
    ["widthCm", "heightCm"],
  );
  if (!checked.ok) return checked;
  const { widthCm, heightCm } = checked.value;
  if (typeof widthCm !== "number" || !Number.isFinite(widthCm) || widthCm <= 0) {
    return materialFailure(
      "MATERIAL_INVALID_DIMENSION",
      "$.mapping.widthCm",
      "Expected a finite JSON number greater than zero.",
    );
  }
  if (typeof heightCm !== "number" || !Number.isFinite(heightCm) || heightCm <= 0) {
    return materialFailure(
      "MATERIAL_INVALID_DIMENSION",
      "$.mapping.heightCm",
      "Expected a finite JSON number greater than zero.",
    );
  }
  return { ok: true, value: Object.freeze({ widthCm, heightCm }) };
}

function validateMaps(value: unknown): MaterialValidationResult<MaterialMaps> {
  const roles = ["baseColor", "roughness", "metalness", "normal"] as const;
  const checked = closedObject(value, "$.maps", roles);
  if (!checked.ok) return checked;
  if (Object.keys(checked.value).length === 0) {
    return materialFailure("MATERIAL_EMPTY_MAPS", "$.maps", "Expected at least one texture map.");
  }
  const maps: { -readonly [K in keyof MaterialMaps]: MaterialMaps[K] } = {};
  for (const role of roles) {
    if (!Object.hasOwn(checked.value, role)) continue;
    const path = checked.value[role];
    if (!isMaterialFilePath(path, [".png", ".jpg", ".jpeg", ".webp"])) {
      return materialFailure(
        "MATERIAL_INVALID_TEXTURE_PATH",
        `$.maps.${role}`,
        "Expected a project-relative file below assets/materials/ with a lowercase .png, .jpg, .jpeg, or .webp extension.",
      );
    }
    maps[role] = path;
  }
  return { ok: true, value: Object.freeze(maps) };
}

function validateAlpha(value: unknown): MaterialValidationResult<MaterialAlpha> {
  const checked = closedObject(value, "$.alpha", ["mode", "opacity", "cutoff"], ["mode"]);
  if (!checked.ok) return checked;
  const alpha = checked.value;
  const mode = alpha.mode;
  if (mode !== "opaque" && mode !== "mask" && mode !== "blend") {
    return materialFailure(
      "MATERIAL_INVALID_ALPHA_MODE",
      "$.alpha.mode",
      "Expected opaque, mask, or blend.",
    );
  }
  const variant = closedObject(
    alpha,
    "$.alpha",
    mode === "opaque"
      ? ["mode"]
      : mode === "mask"
        ? ["mode", "opacity", "cutoff"]
        : ["mode", "opacity"],
    mode === "mask" ? ["mode", "cutoff"] : ["mode"],
  );
  if (!variant.ok) return variant;
  if (mode === "opaque") return { ok: true, value: Object.freeze({ mode }) };
  let opacity: number | undefined;
  if (Object.hasOwn(alpha, "opacity")) {
    const checkedOpacity = factor(alpha.opacity, "$.alpha.opacity");
    if (!checkedOpacity.ok) return checkedOpacity;
    opacity = checkedOpacity.value;
  }
  const optionalOpacity = opacity === undefined ? {} : { opacity };
  if (mode === "mask") {
    const cutoff = factor(alpha.cutoff, "$.alpha.cutoff");
    if (!cutoff.ok) return cutoff;
    return { ok: true, value: Object.freeze({ mode, cutoff: cutoff.value, ...optionalOpacity }) };
  }
  return { ok: true, value: Object.freeze({ mode, ...optionalOpacity }) };
}

/** Validates parsed JSON and external identity without accessing any referenced resource. */
export function validateMaterialDescriptor(
  value: unknown,
  descriptorPath: unknown,
): MaterialValidationResult<ValidatedMaterialDescriptor> {
  if (!isMaterialFilePath(descriptorPath, [".json"])) {
    return materialFailure(
      "MATERIAL_INVALID_DESCRIPTOR_PATH",
      "descriptorPath",
      "Expected a project-relative file below assets/materials/ with a lowercase .json extension.",
    );
  }
  const checked = closedObject(
    value,
    "$",
    ["schema", "name", "baseColor", "roughness", "metalness", "mapping", "maps", "alpha"],
    ["schema", "name"],
  );
  if (!checked.ok) return checked;
  const document = checked.value;
  if (document.schema !== MATERIAL_SCHEMA) {
    return materialFailure(
      "MATERIAL_UNSUPPORTED_SCHEMA",
      "$.schema",
      `Only ${MATERIAL_SCHEMA} is supported.`,
    );
  }
  if (typeof document.name !== "string" || !/[^\p{White_Space}\uFEFF]/u.test(document.name)) {
    return materialFailure(
      "MATERIAL_INVALID_NAME",
      "$.name",
      "Expected at least one non-whitespace Unicode character.",
    );
  }
  let baseColor: MaterialBaseColor | undefined;
  if (Object.hasOwn(document, "baseColor")) {
    const checkedColor = validateBaseColor(document.baseColor);
    if (!checkedColor.ok) return checkedColor;
    baseColor = checkedColor.value;
  }
  const scalars: { roughness?: number; metalness?: number } = {};
  for (const key of ["roughness", "metalness"] as const) {
    if (!Object.hasOwn(document, key)) continue;
    const checkedFactor = factor(document[key], `$.${key}`);
    if (!checkedFactor.ok) return checkedFactor;
    scalars[key] = checkedFactor.value;
  }
  const hasMaps = Object.hasOwn(document, "maps");
  const hasMapping = Object.hasOwn(document, "mapping");
  if (hasMaps !== hasMapping) {
    return materialFailure(
      "MATERIAL_MAPPING_COUPLING",
      "$.mapping",
      "Mapping must be present exactly when maps is present.",
    );
  }
  let textures: MaterialTextures = {};
  if (hasMaps) {
    const maps = validateMaps(document.maps);
    if (!maps.ok) return maps;
    const mapping = validateMapping(document.mapping);
    if (!mapping.ok) return mapping;
    textures = { maps: maps.value, mapping: mapping.value };
  }
  let alpha: MaterialAlpha | undefined;
  if (Object.hasOwn(document, "alpha")) {
    const checkedAlpha = validateAlpha(document.alpha);
    if (!checkedAlpha.ok) return checkedAlpha;
    alpha = checkedAlpha.value;
  }
  const trusted: MaterialDocument = Object.freeze({
    schema: MATERIAL_SCHEMA,
    name: document.name,
    ...(baseColor === undefined ? {} : { baseColor }),
    ...scalars,
    ...textures,
    ...(alpha === undefined ? {} : { alpha }),
  });
  // Establish the nominal boundary only after all format and identity checks succeed.
  return {
    ok: true,
    value: Object.freeze({
      path: descriptorPath,
      document: trusted,
    }) as ValidatedMaterialDescriptor,
  };
}

/** Parses decoded JSON text; a leading UTF-8 BOM is discouraged but not prohibited. */
export function parseMaterialDescriptor(
  text: string,
  descriptorPath: unknown,
): MaterialValidationResult<ValidatedMaterialDescriptor> {
  let value: unknown;
  try {
    value = JSON.parse(text.startsWith("\uFEFF") ? text.slice(1) : text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return materialFailure(
      "MATERIAL_INVALID_JSON",
      "$",
      "Expected syntactically valid JSON representing one object.",
    );
  }
  return validateMaterialDescriptor(value, descriptorPath);
}
