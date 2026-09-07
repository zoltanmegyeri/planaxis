import type { Rect2D } from "./rect-2d.js";
import type { VerticalRange } from "./vertical-range.js";

/** An axis-aligned vertical prism. */
export interface RectangularPrism3D {
  readonly footprint: Rect2D;
  readonly verticalRange: VerticalRange;
}
