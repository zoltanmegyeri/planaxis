import { designFailure, type DesignValidationResult } from "./design-result.js";

export function closedObject(
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
