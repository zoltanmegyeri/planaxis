import type { Decimal, Point3D, RectangularPrism3D } from "@planaxis/geometry";
import type { PhysicalSurfaceMapping } from "@planaxis/model-3d";
import { Box3, Vector3 } from "three/webgpu";

/** Central position conversion: centimeters to meters, (X, Y, Z) to (X, Z, Y). */
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

/** Converts renderer-tessellated physical coordinates without feeding them into the domain. */
export function rendererMappedPoint(
  uCm: number,
  vCm: number,
  mapping: PhysicalSurfaceMapping,
): [number, number, number] {
  const component = (axis: "x" | "y" | "z"): number => {
    const value =
      meters(mapping.origin[axis]) +
      mapping.uDirection[axis].toNumber() * (uCm / 100) +
      mapping.vDirection[axis].toNumber() * (vCm / 100);
    if (!Number.isFinite(value)) throw new Error("Geometry exceeds finite renderer coordinates.");
    return value;
  };
  return [component("x"), component("z"), component("y")];
}
