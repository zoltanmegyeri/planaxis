import { createDecimal } from "@planaxis/geometry";
import type { Decimal, Point3D } from "@planaxis/geometry";
import type { SurfaceAxis, SurfaceSign } from "./architectural-surfaces.js";

/** Orthonormal signed architectural axes; origins and measured distances are centimeters. */
export interface PhysicalSurfaceMapping {
  readonly origin: Point3D;
  readonly uDirection: Point3D;
  readonly vDirection: Point3D;
}

/** Global XY anchoring and level Z anchoring never depend on patches or tessellation. */
export function createSurfaceMapping(
  normalAxis: SurfaceAxis,
  normalSign: SurfaceSign,
  planeCoordinate: Decimal,
  baseZ: Decimal,
): PhysicalSurfaceMapping {
  const zero = createDecimal("0");
  const one = createDecimal("1");
  const sign = normalSign === "positive" ? one : one.negated();
  const origin = Object.freeze({ x: zero, y: zero, z: baseZ, [normalAxis]: planeCoordinate });
  const uDirection = Object.freeze(
    normalAxis === "x"
      ? { x: zero, y: sign, z: zero }
      : { x: normalAxis === "y" ? sign.negated() : one, y: zero, z: zero },
  );
  const vDirection = Object.freeze(
    normalAxis === "z" ? { x: zero, y: sign, z: zero } : { x: zero, y: zero, z: one },
  );
  return Object.freeze({ origin, uDirection, vDirection });
}

/** Signed physical distances, before division by any runtime texture dimensions. */
export function surfaceMappingDistances(
  mapping: PhysicalSurfaceMapping,
  point: Point3D,
): { readonly uCm: Decimal; readonly vCm: Decimal } {
  const distance = (direction: Point3D): Decimal =>
    point.x
      .minus(mapping.origin.x)
      .times(direction.x)
      .plus(point.y.minus(mapping.origin.y).times(direction.y))
      .plus(point.z.minus(mapping.origin.z).times(direction.z));
  return { uCm: distance(mapping.uDirection), vCm: distance(mapping.vDirection) };
}
