import { isDescriptorFilePath, isFinishTargetId, isProjectRelativePath } from "./design-lexical.js";
import { designFailure, type DesignValidationResult } from "./design-result.js";
import {
  DESIGN_SCHEMA,
  type DesignDocument,
  type DesignFinishAssignment,
  type DesignPresentation,
  type DesignToneMapping,
  type ValidatedDesignDescriptor,
} from "./design.js";

function closedObject(
  value: unknown,
  location: string,
  allowed: readonly string[],
  required: readonly string[] = [],
): DesignValidationResult<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return designFailure("DESIGN_INVALID_OBJECT", location, "Expected a JSON object.");
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return designFailure(
        "DESIGN_UNKNOWN_PROPERTY",
        `${location}.${key}`,
        "Unknown properties are prohibited.",
      );
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      return designFailure(
        "DESIGN_MISSING_PROPERTY",
        `${location}.${key}`,
        "Required property is missing.",
      );
    }
  }
  return { ok: true, value: value as Record<string, unknown> };
}

function validateFinishes(
  value: unknown,
): DesignValidationResult<readonly DesignFinishAssignment[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return designFailure(
      "DESIGN_INVALID_FINISHES",
      "$.finishes",
      "Expected a non-empty array of finish assignments.",
    );
  }
  const targets = new Set<string>();
  const finishes: DesignFinishAssignment[] = [];
  for (const [index, assignment] of value.entries()) {
    const location = `$.finishes[${index}]`;
    const checked = closedObject(
      assignment,
      location,
      ["target", "material"],
      ["target", "material"],
    );
    if (!checked.ok) return checked;
    const { target, material } = checked.value;
    if (!isFinishTargetId(target)) {
      return designFailure(
        "DESIGN_INVALID_TARGET",
        `${location}.target`,
        "Expected a Design 1.0 finish target with Apartment SVG IDs.",
      );
    }
    if (targets.has(target)) {
      return designFailure(
        "DESIGN_DUPLICATE_TARGET",
        `${location}.target`,
        `Finish target ${target} is assigned more than once.`,
      );
    }
    if (!isProjectRelativePath(material) || !material.startsWith("assets/materials/")) {
      return designFailure(
        "DESIGN_INVALID_MATERIAL_PATH",
        `${location}.material`,
        "Expected a project-relative resource path below assets/materials/.",
      );
    }
    targets.add(target);
    finishes.push(Object.freeze({ target, material }));
  }
  return { ok: true, value: Object.freeze(finishes) };
}

function validatePresentation(value: unknown): DesignValidationResult<DesignPresentation> {
  const checked = closedObject(value, "$.presentation", ["toneMapping", "exposureEv"]);
  if (!checked.ok) return checked;
  const presentation = checked.value;
  if (Object.keys(presentation).length === 0) {
    return designFailure(
      "DESIGN_INVALID_PRESENTATION",
      "$.presentation",
      "Expected at least one presentation override.",
    );
  }
  const result: { toneMapping?: DesignToneMapping; exposureEv?: number } = {};
  if (Object.hasOwn(presentation, "toneMapping")) {
    const toneMapping = presentation.toneMapping;
    if (toneMapping !== "agx" && toneMapping !== "aces-filmic" && toneMapping !== "neutral") {
      return designFailure(
        "DESIGN_INVALID_TONE_MAPPING",
        "$.presentation.toneMapping",
        "Expected agx, aces-filmic, or neutral.",
      );
    }
    result.toneMapping = toneMapping;
  }
  if (Object.hasOwn(presentation, "exposureEv")) {
    const exposureEv = presentation.exposureEv;
    if (typeof exposureEv !== "number" || !Number.isFinite(exposureEv)) {
      return designFailure(
        "DESIGN_INVALID_EXPOSURE",
        "$.presentation.exposureEv",
        "Expected a finite JSON number.",
      );
    }
    result.exposureEv = exposureEv;
  }
  return { ok: true, value: Object.freeze(result) };
}

/** Validates parsed JSON and its external identity without loading any referenced resource. */
export function validateDesignDescriptor(
  value: unknown,
  descriptorPath: unknown,
): DesignValidationResult<ValidatedDesignDescriptor> {
  if (!isDescriptorFilePath(descriptorPath, "designs", ".json")) {
    return designFailure(
      "DESIGN_INVALID_DESCRIPTOR_PATH",
      "descriptorPath",
      "Expected a project-relative file below designs/ with a lowercase .json extension.",
    );
  }
  const checked = closedObject(
    value,
    "$",
    ["schema", "name", "architecture", "finishes", "presentation"],
    ["schema", "name", "architecture"],
  );
  if (!checked.ok) return checked;
  const document = checked.value;
  if (document.schema !== DESIGN_SCHEMA) {
    return designFailure(
      "DESIGN_UNSUPPORTED_SCHEMA",
      "$.schema",
      `Only ${DESIGN_SCHEMA} is supported.`,
    );
  }
  if (typeof document.name !== "string" || !/[^\p{White_Space}\uFEFF]/u.test(document.name)) {
    return designFailure(
      "DESIGN_INVALID_NAME",
      "$.name",
      "Expected at least one non-whitespace Unicode character.",
    );
  }
  if (!isDescriptorFilePath(document.architecture, "architecture", ".svg")) {
    return designFailure(
      "DESIGN_INVALID_ARCHITECTURE_PATH",
      "$.architecture",
      "Expected a project-relative file below architecture/ with a lowercase .svg extension.",
    );
  }
  let finishes: readonly DesignFinishAssignment[] | undefined;
  if (Object.hasOwn(document, "finishes")) {
    const checkedFinishes = validateFinishes(document.finishes);
    if (!checkedFinishes.ok) return checkedFinishes;
    finishes = checkedFinishes.value;
  }
  let presentation: DesignPresentation | undefined;
  if (Object.hasOwn(document, "presentation")) {
    const checkedPresentation = validatePresentation(document.presentation);
    if (!checkedPresentation.ok) return checkedPresentation;
    presentation = checkedPresentation.value;
  }
  const trusted: DesignDocument = Object.freeze({
    schema: DESIGN_SCHEMA,
    name: document.name,
    architecture: document.architecture,
    ...(finishes === undefined ? {} : { finishes }),
    ...(presentation === undefined ? {} : { presentation }),
  });
  // The nominal boundary is established only after every format rule succeeds.
  return {
    ok: true,
    value: Object.freeze({ path: descriptorPath, document: trusted }) as ValidatedDesignDescriptor,
  };
}

/** Parses decoded JSON text; a leading UTF-8 BOM is discouraged but not prohibited. */
export function parseDesignDescriptor(
  text: string,
  descriptorPath: unknown,
): DesignValidationResult<ValidatedDesignDescriptor> {
  let value: unknown;
  try {
    value = JSON.parse(text.startsWith("\uFEFF") ? text.slice(1) : text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return designFailure(
      "DESIGN_INVALID_JSON",
      "$",
      "Expected syntactically valid JSON representing one object.",
    );
  }
  return validateDesignDescriptor(value, descriptorPath);
}
