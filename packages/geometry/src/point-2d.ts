import type { Decimal } from "./decimal.js";
import { isGeometricallyEqual } from "./geometric-comparison.js";

export interface Point2D {
  readonly x: Decimal;
  readonly y: Decimal;
}

export function arePointsGeometricallyEqual(a: Point2D, b: Point2D): boolean {
  return isGeometricallyEqual(a.x, b.x) && isGeometricallyEqual(a.y, b.y);
}

export function arePointsExactlyEqual(a: Point2D, b: Point2D): boolean {
  return a.x.equals(b.x) && a.y.equals(b.y);
}
