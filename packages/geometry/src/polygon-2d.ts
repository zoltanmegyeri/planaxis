import type { Decimal } from "./decimal.js";
import { createDecimal } from "./decimal.js";
import { arePointsExactlyEqual } from "./point-2d.js";
import type { Point2D } from "./point-2d.js";
import { getRectVertices } from "./rect-2d.js";
import type { Rect2D } from "./rect-2d.js";
import { getOrientation, getSegmentIntersectionType, isPointOnSegment } from "./segment-2d.js";

const TWO = createDecimal("2");

export type PointPolygonLocation = "outside" | "boundary" | "inside";

export function getPolygonSignedDoubleArea(points: readonly Point2D[]): Decimal {
  let area = createDecimal("0");
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    area = area.plus(current.x.times(next.y).minus(next.x.times(current.y)));
  }
  return area;
}

export function getPolygonArea(points: readonly Point2D[]): Decimal {
  return getPolygonSignedDoubleArea(points).abs().dividedBy(TWO);
}

export function hasPolygonSelfIntersection(points: readonly Point2D[]): boolean {
  const vertices = withoutRepeatedClosingVertex(points);
  if (vertices.length < 3) return false;

  for (let firstIndex = 0; firstIndex < vertices.length; firstIndex += 1) {
    const firstStart = vertices[firstIndex];
    const firstEnd = vertices[(firstIndex + 1) % vertices.length];
    if (firstStart === undefined || firstEnd === undefined) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < vertices.length; secondIndex += 1) {
      const secondStart = vertices[secondIndex];
      const secondEnd = vertices[(secondIndex + 1) % vertices.length];
      if (secondStart === undefined || secondEnd === undefined) continue;
      const intersection = getSegmentIntersectionType(firstStart, firstEnd, secondStart, secondEnd);
      if (intersection === "none") continue;

      const areAdjacent =
        secondIndex === firstIndex + 1 || (firstIndex === 0 && secondIndex === vertices.length - 1);
      if (!areAdjacent || intersection === "overlap") return true;
    }
  }

  return false;
}

export function locatePointInPolygon(
  point: Point2D,
  polygon: readonly Point2D[],
): PointPolygonLocation {
  const vertices = withoutRepeatedClosingVertex(polygon);
  let windingNumber = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (start === undefined || end === undefined) continue;
    if (isPointOnSegment(point, start, end)) return "boundary";

    const orientation = getOrientation(start, end, point);
    if (start.y.lessThanOrEqualTo(point.y)) {
      if (end.y.greaterThan(point.y) && orientation.greaterThan(0)) windingNumber += 1;
    } else if (end.y.lessThanOrEqualTo(point.y) && orientation.lessThan(0)) {
      windingNumber -= 1;
    }
  }

  return windingNumber === 0 ? "outside" : "inside";
}

export function doPolygonsOverlapWithPositiveArea(
  a: readonly Point2D[],
  b: readonly Point2D[],
): boolean {
  const aTriangles = triangulatePolygon(a);
  const bTriangles = triangulatePolygon(b);

  return aTriangles.some((aTriangle) =>
    bTriangles.some((bTriangle) => doTrianglesOverlapWithPositiveArea(aTriangle, bTriangle)),
  );
}

export function doesPolygonOverlapRectWithPositiveArea(
  polygon: readonly Point2D[],
  rect: Rect2D,
): boolean {
  return doPolygonsOverlapWithPositiveArea(polygon, getRectVertices(rect));
}

type Triangle = readonly [Point2D, Point2D, Point2D];

function triangulatePolygon(points: readonly Point2D[]): readonly Triangle[] {
  const vertices = removeRedundantVertices(withoutRepeatedClosingVertex(points));
  const signedArea = getPolygonSignedDoubleArea(vertices);
  if (vertices.length < 3 || signedArea.isZero()) return [];

  const winding = signedArea.greaterThan(0) ? 1 : -1;
  const remaining = [...vertices];
  const triangles: Triangle[] = [];

  while (remaining.length > 3) {
    let earIndex = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const previous = remaining[(index - 1 + remaining.length) % remaining.length];
      const current = remaining[index];
      const next = remaining[(index + 1) % remaining.length];
      if (previous === undefined || current === undefined || next === undefined) continue;

      const orientation = getOrientation(previous, current, next);
      const isConvex = winding > 0 ? orientation.greaterThan(0) : orientation.lessThan(0);
      if (!isConvex) continue;

      const triangle: Triangle = [previous, current, next];
      const containsOtherVertex = remaining.some(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          candidateIndex !== (index - 1 + remaining.length) % remaining.length &&
          candidateIndex !== (index + 1) % remaining.length &&
          isPointInTriangle(candidate, triangle),
      );
      if (!containsOtherVertex) {
        earIndex = index;
        triangles.push(triangle);
        break;
      }
    }

    if (earIndex < 0) return [];
    remaining.splice(earIndex, 1);
  }

  const first = remaining[0];
  const second = remaining[1];
  const third = remaining[2];
  if (first !== undefined && second !== undefined && third !== undefined) {
    triangles.push([first, second, third]);
  }
  return triangles;
}

function removeRedundantVertices(points: readonly Point2D[]): Point2D[] {
  const uniqueConsecutive = points.filter(
    (point, index) => index === 0 || !arePointsExactlyEqual(point, points[index - 1]!),
  );
  let changed = true;
  while (changed && uniqueConsecutive.length >= 3) {
    changed = false;
    for (let index = 0; index < uniqueConsecutive.length; index += 1) {
      const previous =
        uniqueConsecutive[(index - 1 + uniqueConsecutive.length) % uniqueConsecutive.length];
      const current = uniqueConsecutive[index];
      const next = uniqueConsecutive[(index + 1) % uniqueConsecutive.length];
      if (
        previous !== undefined &&
        current !== undefined &&
        next !== undefined &&
        getOrientation(previous, current, next).isZero() &&
        isPointOnSegment(current, previous, next)
      ) {
        uniqueConsecutive.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return uniqueConsecutive;
}

function doTrianglesOverlapWithPositiveArea(a: Triangle, b: Triangle): boolean {
  return [...getEdgeAxes(a), ...getEdgeAxes(b)].every((axis) => {
    const aProjection = projectPolygon(a, axis);
    const bProjection = projectPolygon(b, axis);
    const overlapMinimum = decimalMax(aProjection.minimum, bProjection.minimum);
    const overlapMaximum = decimalMin(aProjection.maximum, bProjection.maximum);
    return overlapMinimum.lessThan(overlapMaximum);
  });
}

interface Projection {
  readonly minimum: Decimal;
  readonly maximum: Decimal;
}

function getEdgeAxes(triangle: Triangle): readonly Point2D[] {
  return triangle.map((start, index) => {
    const end = triangle[(index + 1) % triangle.length];
    if (end === undefined) throw new Error("A triangle edge is missing its endpoint.");
    return { x: start.y.minus(end.y), y: end.x.minus(start.x) };
  });
}

function projectPolygon(polygon: readonly Point2D[], axis: Point2D): Projection {
  const first = polygon[0];
  if (first === undefined) throw new Error("Cannot project an empty polygon.");
  let minimum = dotProduct(first, axis);
  let maximum = minimum;
  for (const point of polygon.slice(1)) {
    const projection = dotProduct(point, axis);
    minimum = decimalMin(minimum, projection);
    maximum = decimalMax(maximum, projection);
  }
  return { minimum, maximum };
}

function dotProduct(a: Point2D, b: Point2D): Decimal {
  return a.x.times(b.x).plus(a.y.times(b.y));
}

function decimalMin(a: Decimal, b: Decimal): Decimal {
  return a.lessThanOrEqualTo(b) ? a : b;
}

function decimalMax(a: Decimal, b: Decimal): Decimal {
  return a.greaterThanOrEqualTo(b) ? a : b;
}

function isPointInTriangle(point: Point2D, triangle: Triangle): boolean {
  const first = getOrientation(triangle[0], triangle[1], point);
  const second = getOrientation(triangle[1], triangle[2], point);
  const third = getOrientation(triangle[2], triangle[0], point);
  const hasNegative = first.lessThan(0) || second.lessThan(0) || third.lessThan(0);
  const hasPositive = first.greaterThan(0) || second.greaterThan(0) || third.greaterThan(0);
  return !(hasNegative && hasPositive);
}

function withoutRepeatedClosingVertex(points: readonly Point2D[]): readonly Point2D[] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  return first !== undefined && last !== undefined && arePointsExactlyEqual(first, last)
    ? points.slice(0, -1)
    : points;
}
