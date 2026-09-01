import type {
  ApartmentSvgValidationCategory,
  ApartmentSvgValidationCode,
} from "./validation-codes.js";

export interface ApartmentSvgValidationError {
  readonly code: ApartmentSvgValidationCode;
  readonly category: ApartmentSvgValidationCategory;
  readonly rule: string;
  readonly expected: string;
  readonly message: string;
  readonly elementId?: string;
  readonly attribute?: string;
  readonly path?: string;
  readonly actual?: string;
}

export interface ApartmentSvgValidationSuccess {
  readonly valid: true;
  readonly errors: readonly [];
}

export interface ApartmentSvgValidationFailure {
  readonly valid: false;
  readonly errors: readonly ApartmentSvgValidationError[];
}

export type ApartmentSvgValidationResult =
  ApartmentSvgValidationSuccess | ApartmentSvgValidationFailure;

const EMPTY_VALIDATION_ERRORS: readonly [] = Object.freeze([]);

export function createApartmentSvgValidationResult(
  errors: readonly ApartmentSvgValidationError[],
): ApartmentSvgValidationResult {
  if (errors.length === 0) {
    return Object.freeze({ valid: true, errors: EMPTY_VALIDATION_ERRORS });
  }

  return Object.freeze({ valid: false, errors: Object.freeze([...errors]) });
}
