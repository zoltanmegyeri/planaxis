import type { Decimal } from "./decimal.js";
import { isGeometricallyEqual } from "./geometric-comparison.js";

export interface Point3D {
  readonly x: Decimal;
  readonly y: Decimal;
  readonly z: Decimal;
}

export function arePoints3DGeometricallyEqual(a: Point3D, b: Point3D): boolean {
  return (
    isGeometricallyEqual(a.x, b.x) &&
    isGeometricallyEqual(a.y, b.y) &&
    isGeometricallyEqual(a.z, b.z)
  );
}

export function arePoints3DExactlyEqual(a: Point3D, b: Point3D): boolean {
  return a.x.equals(b.x) && a.y.equals(b.y) && a.z.equals(b.z);
}
