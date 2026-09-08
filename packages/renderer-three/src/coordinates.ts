import type { Decimal, Point3D, RectangularPrism3D } from "@planaxis/geometry";
import { Box3, Vector3 } from "three/webgpu";

/** The sole exact-to-renderer boundary: centimeters to meters, (X, Y, Z) to (X, Z, Y). */
export function meters(value: Decimal): number {
  const result = value.dividedBy(100).toNumber();
  if (!Number.isFinite(result)) throw new Error("Geometry exceeds finite renderer coordinates.");
  return result;
}

export function rendererPoint(point: Point3D): Vector3 {
  return new Vector3(meters(point.x), meters(point.z), meters(point.y));
}

export function rendererBox(prism: RectangularPrism3D): Box3 {
  const { footprint: r, verticalRange: z } = prism;
  return new Box3(
    rendererPoint({ x: r.x, y: r.y, z: z.minZ }),
    rendererPoint({ x: r.x.plus(r.width), y: r.y.plus(r.height), z: z.maxZ }),
  );
}
