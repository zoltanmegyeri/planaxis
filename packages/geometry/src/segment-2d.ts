import type { Decimal } from "./decimal.js";
import { arePointsExactlyEqual } from "./point-2d.js";
import type { Point2D } from "./point-2d.js";

export type SegmentIntersectionType = "none" | "point" | "overlap";

export function getSegmentIntersectionType(
  aStart: Point2D,
  aEnd: Point2D,
  bStart: Point2D,
  bEnd: Point2D,
): SegmentIntersectionType {
  const aIsPoint = arePointsExactlyEqual(aStart, aEnd);
  const bIsPoint = arePointsExactlyEqual(bStart, bEnd);
  if (aIsPoint && bIsPoint) return arePointsExactlyEqual(aStart, bStart) ? "point" : "none";
  if (aIsPoint) return isPointOnSegment(aStart, bStart, bEnd) ? "point" : "none";
  if (bIsPoint) return isPointOnSegment(bStart, aStart, aEnd) ? "point" : "none";

  const orientationAStart = getOrientation(bStart, bEnd, aStart);
  const orientationAEnd = getOrientation(bStart, bEnd, aEnd);
  const orientationBStart = getOrientation(aStart, aEnd, bStart);
  const orientationBEnd = getOrientation(aStart, aEnd, bEnd);

  if (
    orientationAStart.isZero() &&
    orientationAEnd.isZero() &&
    orientationBStart.isZero() &&
    orientationBEnd.isZero()
  ) {
    return getCollinearIntersectionType(aStart, aEnd, bStart, bEnd);
  }

  if (
    haveOppositeSigns(orientationAStart, orientationAEnd) &&
    haveOppositeSigns(orientationBStart, orientationBEnd)
  ) {
    return "point";
  }

  if (
    (orientationAStart.isZero() && isPointOnSegment(aStart, bStart, bEnd)) ||
    (orientationAEnd.isZero() && isPointOnSegment(aEnd, bStart, bEnd)) ||
    (orientationBStart.isZero() && isPointOnSegment(bStart, aStart, aEnd)) ||
    (orientationBEnd.isZero() && isPointOnSegment(bEnd, aStart, aEnd))
  ) {
    return "point";
  }

  return "none";
}

export function doSegmentsProperlyIntersect(
  aStart: Point2D,
  aEnd: Point2D,
  bStart: Point2D,
  bEnd: Point2D,
): boolean {
  return (
    haveOppositeSigns(getOrientation(aStart, aEnd, bStart), getOrientation(aStart, aEnd, bEnd)) &&
    haveOppositeSigns(getOrientation(bStart, bEnd, aStart), getOrientation(bStart, bEnd, aEnd))
  );
}

export function isPointOnSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
  if (!getOrientation(start, end, point).isZero()) return false;

  return (
    point.x.greaterThanOrEqualTo(decimalMin(start.x, end.x)) &&
    point.x.lessThanOrEqualTo(decimalMax(start.x, end.x)) &&
    point.y.greaterThanOrEqualTo(decimalMin(start.y, end.y)) &&
    point.y.lessThanOrEqualTo(decimalMax(start.y, end.y))
  );
}

export function getOrientation(start: Point2D, end: Point2D, point: Point2D): Decimal {
  return end.x
    .minus(start.x)
    .times(point.y.minus(start.y))
    .minus(end.y.minus(start.y).times(point.x.minus(start.x)));
}

function getCollinearIntersectionType(
  aStart: Point2D,
  aEnd: Point2D,
  bStart: Point2D,
  bEnd: Point2D,
): SegmentIntersectionType {
  const useX = aStart.x.equals(aEnd.x) && bStart.x.equals(bEnd.x) ? false : true;
  const aMinimum = useX ? decimalMin(aStart.x, aEnd.x) : decimalMin(aStart.y, aEnd.y);
  const aMaximum = useX ? decimalMax(aStart.x, aEnd.x) : decimalMax(aStart.y, aEnd.y);
  const bMinimum = useX ? decimalMin(bStart.x, bEnd.x) : decimalMin(bStart.y, bEnd.y);
  const bMaximum = useX ? decimalMax(bStart.x, bEnd.x) : decimalMax(bStart.y, bEnd.y);
  const overlapMinimum = decimalMax(aMinimum, bMinimum);
  const overlapMaximum = decimalMin(aMaximum, bMaximum);

  if (overlapMinimum.greaterThan(overlapMaximum)) return "none";
  return overlapMinimum.equals(overlapMaximum) ? "point" : "overlap";
}

function haveOppositeSigns(a: Decimal, b: Decimal): boolean {
  return (a.greaterThan(0) && b.lessThan(0)) || (a.lessThan(0) && b.greaterThan(0));
}

function decimalMin(a: Decimal, b: Decimal): Decimal {
  return a.lessThanOrEqualTo(b) ? a : b;
}

function decimalMax(a: Decimal, b: Decimal): Decimal {
  return a.greaterThanOrEqualTo(b) ? a : b;
}
