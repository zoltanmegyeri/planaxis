import type { Decimal } from "./decimal.js";
import { createDecimal } from "./decimal.js";

export const GEOMETRIC_EPSILON: Decimal = createDecimal("0.01");

export function isGeometricallyEqual(a: Decimal, b: Decimal): boolean {
  return a.minus(b).abs().lessThanOrEqualTo(GEOMETRIC_EPSILON);
}

export function isLessThanOrEqualWithinTolerance(a: Decimal, b: Decimal): boolean {
  return a.lessThanOrEqualTo(b.plus(GEOMETRIC_EPSILON));
}

export function isGreaterThanOrEqualWithinTolerance(a: Decimal, b: Decimal): boolean {
  return a.greaterThanOrEqualTo(b.minus(GEOMETRIC_EPSILON));
}
