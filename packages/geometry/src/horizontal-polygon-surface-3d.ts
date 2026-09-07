import type { Decimal } from "./decimal.js";
import type { Point2D } from "./point-2d.js";

/** A zero-thickness polygon surface in the horizontal plane at z. */
export interface HorizontalPolygonSurface3D {
  readonly boundary: readonly Point2D[];
  readonly z: Decimal;
}
