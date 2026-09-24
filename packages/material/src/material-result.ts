export type MaterialValidationCode =
  | "MATERIAL_INVALID_JSON"
  | "MATERIAL_INVALID_DESCRIPTOR_PATH"
  | "MATERIAL_INVALID_OBJECT"
  | "MATERIAL_UNKNOWN_PROPERTY"
  | "MATERIAL_MISSING_PROPERTY"
  | "MATERIAL_UNSUPPORTED_SCHEMA"
  | "MATERIAL_INVALID_NAME"
  | "MATERIAL_INVALID_BASE_COLOR"
  | "MATERIAL_INVALID_FACTOR"
  | "MATERIAL_EMPTY_MAPS"
  | "MATERIAL_MAPPING_COUPLING"
  | "MATERIAL_AMBIENT_OCCLUSION_COUPLING"
  | "MATERIAL_INVALID_DIMENSION"
  | "MATERIAL_INVALID_TEXTURE_PATH"
  | "MATERIAL_INVALID_ALPHA_MODE";

export interface MaterialValidationError {
  readonly stage: "json" | "format";
  readonly code: MaterialValidationCode;
  /** JSON-style field location, or descriptorPath for external identity. */
  readonly location: string;
  readonly message: string;
}

export type MaterialValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MaterialValidationError };

export function materialFailure(
  code: MaterialValidationCode,
  location: string,
  message: string,
): MaterialValidationResult<never> {
  return {
    ok: false,
    error: { stage: code === "MATERIAL_INVALID_JSON" ? "json" : "format", code, location, message },
  };
}
