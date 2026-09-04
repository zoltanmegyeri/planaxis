import type { Decimal } from "./decimal.js";
import { createDecimal } from "./decimal.js";
import type { Point2D } from "./point-2d.js";

const TWO = createDecimal("2");

export interface Rect2D {
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
}

export function getRectRightEdge(rect: Rect2D): Decimal {
  return rect.x.plus(rect.width);
}

export function getRectBottomEdge(rect: Rect2D): Decimal {
  return rect.y.plus(rect.height);
}

export function getRectCenterX(rect: Rect2D): Decimal {
  return rect.x.plus(rect.width.dividedBy(TWO));
}

export function getRectCenterY(rect: Rect2D): Decimal {
  return rect.y.plus(rect.height.dividedBy(TWO));
}

export function getRectVertices(rect: Rect2D): readonly [Point2D, Point2D, Point2D, Point2D] {
  const right = getRectRightEdge(rect);
  const bottom = getRectBottomEdge(rect);
  return [
    { x: rect.x, y: rect.y },
    { x: right, y: rect.y },
    { x: right, y: bottom },
    { x: rect.x, y: bottom },
  ];
}

export function isPointInRect(point: Point2D, rect: Rect2D): boolean {
  return (
    point.x.greaterThanOrEqualTo(rect.x) &&
    point.x.lessThanOrEqualTo(getRectRightEdge(rect)) &&
    point.y.greaterThanOrEqualTo(rect.y) &&
    point.y.lessThanOrEqualTo(getRectBottomEdge(rect))
  );
}

export function isRectContainedInRect(inner: Rect2D, outer: Rect2D): boolean {
  return (
    inner.x.greaterThanOrEqualTo(outer.x) &&
    inner.y.greaterThanOrEqualTo(outer.y) &&
    getRectRightEdge(inner).lessThanOrEqualTo(getRectRightEdge(outer)) &&
    getRectBottomEdge(inner).lessThanOrEqualTo(getRectBottomEdge(outer))
  );
}

export function doRectsIntersect(a: Rect2D, b: Rect2D): boolean {
  return (
    a.x.lessThanOrEqualTo(getRectRightEdge(b)) &&
    getRectRightEdge(a).greaterThanOrEqualTo(b.x) &&
    a.y.lessThanOrEqualTo(getRectBottomEdge(b)) &&
    getRectBottomEdge(a).greaterThanOrEqualTo(b.y)
  );
}

export function doRectsOverlapWithPositiveArea(a: Rect2D, b: Rect2D): boolean {
  return (
    a.x.lessThan(getRectRightEdge(b)) &&
    getRectRightEdge(a).greaterThan(b.x) &&
    a.y.lessThan(getRectBottomEdge(b)) &&
    getRectBottomEdge(a).greaterThan(b.y)
  );
}
