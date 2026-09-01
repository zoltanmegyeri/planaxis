import { createDecimal } from "@planaxis/geometry";
import type { Decimal } from "@planaxis/geometry";

import timeZoneData from "tzdata" with { type: "json" };

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/u;
const NUMBER_PATTERN = /^-?[0-9]+(?:\.[0-9]+)?$/u;

const ZERO = createDecimal("0");
const NEGATIVE_NINETY = createDecimal("-90");
const NINETY = createDecimal("90");
const NEGATIVE_ONE_HUNDRED_EIGHTY = createDecimal("-180");
const ONE_HUNDRED_EIGHTY = createDecimal("180");
const THREE_HUNDRED_SIXTY = createDecimal("360");

const IANA_TIME_ZONE_IDS = new Set(Object.keys(timeZoneData.zones));

export type ScalarValidationFailureReason =
  "invalid-lexical-form" | "out-of-range" | "empty" | "unknown-time-zone";

export interface ScalarValidationSuccess<T> {
  readonly valid: true;
  readonly value: T;
}

export interface ScalarValidationFailure {
  readonly valid: false;
  readonly reason: ScalarValidationFailureReason;
  readonly expected: string;
  readonly actual: string;
}

export type ScalarValidationResult<T> = ScalarValidationSuccess<T> | ScalarValidationFailure;

export function validateApartmentSvgId(value: string): ScalarValidationResult<string> {
  return ID_PATTERN.test(value)
    ? success(value)
    : failure("invalid-lexical-form", "[A-Za-z][A-Za-z0-9._-]*", value);
}

export function isApartmentSvgNumberLexeme(value: string): boolean {
  return NUMBER_PATTERN.test(value);
}

export function validateApartmentSvgNumber(value: string): ScalarValidationResult<Decimal> {
  if (!isApartmentSvgNumberLexeme(value)) {
    return failure("invalid-lexical-form", "-?[0-9]+(\\.[0-9]+)?", value);
  }

  return success(createDecimal(value));
}

export function validateApartmentSvgPositiveNumber(value: string): ScalarValidationResult<Decimal> {
  return validateDecimalRange(value, "value > 0", (decimal) => decimal.greaterThan(ZERO));
}

export function validateApartmentSvgNonNegativeNumber(
  value: string,
): ScalarValidationResult<Decimal> {
  return validateDecimalRange(value, "value >= 0", (decimal) => decimal.greaterThanOrEqualTo(ZERO));
}

export function validateApartmentSvgBoolean(value: string): ScalarValidationResult<boolean> {
  if (value === "true") {
    return success(true);
  }

  if (value === "false") {
    return success(false);
  }

  return failure("invalid-lexical-form", 'exactly "true" or "false"', value);
}

export function validateApartmentSvgAngle360(value: string): ScalarValidationResult<Decimal> {
  return validateDecimalRange(
    value,
    "0 <= value < 360",
    (decimal) => decimal.greaterThanOrEqualTo(ZERO) && decimal.lessThan(THREE_HUNDRED_SIXTY),
  );
}

export function validateApartmentSvgPitchAngle(value: string): ScalarValidationResult<Decimal> {
  return validateDecimalRange(
    value,
    "-90 < value < 90",
    (decimal) => decimal.greaterThan(NEGATIVE_NINETY) && decimal.lessThan(NINETY),
  );
}

export function validateApartmentSvgLatitude(value: string): ScalarValidationResult<Decimal> {
  return validateDecimalRange(
    value,
    "-90 <= value <= 90",
    (decimal) => decimal.greaterThanOrEqualTo(NEGATIVE_NINETY) && decimal.lessThanOrEqualTo(NINETY),
  );
}

export function validateApartmentSvgLongitude(value: string): ScalarValidationResult<Decimal> {
  return validateDecimalRange(
    value,
    "-180 <= value <= 180",
    (decimal) =>
      decimal.greaterThanOrEqualTo(NEGATIVE_ONE_HUNDRED_EIGHTY) &&
      decimal.lessThanOrEqualTo(ONE_HUNDRED_EIGHTY),
  );
}

export function validateApartmentSvgElevationMeters(
  value: string,
): ScalarValidationResult<Decimal> {
  return validateApartmentSvgNumber(value);
}

export function validateApartmentSvgTimeZoneId(value: string): ScalarValidationResult<string> {
  if (value.length === 0) {
    return failure("empty", "a non-empty IANA time-zone identifier", value);
  }

  if (!IANA_TIME_ZONE_IDS.has(value)) {
    return failure("unknown-time-zone", "an IANA time-zone identifier", value);
  }

  return success(value);
}

function validateDecimalRange(
  value: string,
  expected: string,
  isInRange: (decimal: Decimal) => boolean,
): ScalarValidationResult<Decimal> {
  const numberResult = validateApartmentSvgNumber(value);

  if (!numberResult.valid) {
    return numberResult;
  }

  return isInRange(numberResult.value) ? numberResult : failure("out-of-range", expected, value);
}

function success<T>(value: T): ScalarValidationSuccess<T> {
  return Object.freeze({ valid: true, value });
}

function failure(
  reason: ScalarValidationFailureReason,
  expected: string,
  actual: string,
): ScalarValidationFailure {
  return Object.freeze({ valid: false, reason, expected, actual });
}
