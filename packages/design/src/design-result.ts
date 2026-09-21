export type DesignValidationCode =
  | "DESIGN_INVALID_JSON"
  | "DESIGN_INVALID_DESCRIPTOR_PATH"
  | "DESIGN_INVALID_OBJECT"
  | "DESIGN_UNKNOWN_PROPERTY"
  | "DESIGN_MISSING_PROPERTY"
  | "DESIGN_UNSUPPORTED_SCHEMA"
  | "DESIGN_INVALID_NAME"
  | "DESIGN_INVALID_ARCHITECTURE_PATH"
  | "DESIGN_INVALID_FINISHES"
  | "DESIGN_INVALID_TARGET"
  | "DESIGN_DUPLICATE_TARGET"
  | "DESIGN_INVALID_MATERIAL_PATH"
  | "DESIGN_INVALID_PRESENTATION"
  | "DESIGN_INVALID_TONE_MAPPING"
  | "DESIGN_INVALID_EXPOSURE";

export interface DesignValidationError {
  readonly stage: "json" | "format";
  readonly code: DesignValidationCode;
  /** JSON-style field location, or descriptorPath for the external identity. */
  readonly location: string;
  readonly message: string;
}

export type DesignValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DesignValidationError };

export function designFailure(
  code: DesignValidationCode,
  location: string,
  message: string,
): DesignValidationResult<never> {
  return {
    ok: false,
    error: { stage: code === "DESIGN_INVALID_JSON" ? "json" : "format", code, location, message },
  };
}
