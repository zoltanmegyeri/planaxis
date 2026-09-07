import type { Decimal } from "./decimal.js";

/** A closed vertical interval with minZ <= maxZ. */
export interface VerticalRange {
  readonly minZ: Decimal;
  readonly maxZ: Decimal;
}

export function getVerticalRangeHeight(range: VerticalRange): Decimal {
  return range.maxZ.minus(range.minZ);
}
