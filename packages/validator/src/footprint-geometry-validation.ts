import {
  arePointsExactlyEqual,
  getPolygonArea,
  getRectVertices,
  hasPolygonSelfIntersection,
  isPolygonContainedInPolygon,
  locatePointInPolygon,
} from "@planaxis/geometry";
import type { Point2D } from "@planaxis/geometry";

import type { ReferenceValidApartmentSvgDocument } from "./reference-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

export function collectFootprintGeometryErrors(
  document: ReferenceValidApartmentSvgDocument,
): readonly ApartmentSvgValidationError[] {
  const { id, points } = document.footprint;
  const distinct: Point2D[] = [];
  for (const point of points) {
    if (!distinct.some((other) => arePointsExactlyEqual(point, other))) distinct.push(point);
  }
  const rules: readonly (readonly [string, boolean, string])[] = [
    ["distinct-vertices", distinct.length >= 4, "at least four distinct vertices"],
    ["positive-area", getPolygonArea(points).greaterThan(0), "polygon area > 0"],
    [
      "self-intersection",
      !hasPolygonSelfIntersection(points),
      "a simple polygon without self-intersection",
    ],
    [
      "nonzero-orthogonal-edges",
      points.every((start, index) => {
        const end = points[(index + 1) % points.length]!;
        return start.x.equals(end.x) !== start.y.equals(end.y);
      }),
      "exactly one coordinate changes on every edge, including the implicit closing edge",
    ],
  ];
  return rules
    .filter(([, valid]) => !valid)
    .map(([rule, , expected]) =>
      Object.freeze({
        code: APARTMENT_SVG_VALIDATION_CODES.footprint.invalidPolygon,
        category: "footprint" as const,
        rule: `footprint.${rule}`,
        expected,
        message: `Footprint ${id} violates ${rule}.`,
        elementId: id,
        attribute: "points",
        actual: formatPoints(points),
      }),
    );
}

/** Requires a geometrically valid footprint; zones are validated before this check. */
export function collectFootprintContainmentErrors(
  document: ReferenceValidApartmentSvgDocument,
): readonly ApartmentSvgValidationError[] {
  const errors: ApartmentSvgValidationError[] = [];
  const boundary = document.footprint.points;
  for (const zone of document.spaces) {
    if (!isPolygonContainedInPolygon(zone.points, boundary)) {
      errors.push(containmentError(zone.id, "points", zone.points));
    }
  }
  for (const element of [
    ...document.walls,
    ...document.windows,
    ...document.doors,
    ...document.fixedElements,
  ]) {
    const vertices = getRectVertices(element);
    if (!isPolygonContainedInPolygon(vertices, boundary)) {
      errors.push(containmentError(element.id, "x,y,width,height", vertices));
    }
  }
  for (const element of [...document.utilities, ...document.cameras]) {
    const point = { x: element.cx, y: element.cy };
    if (locatePointInPolygon(point, boundary) === "outside") {
      errors.push(containmentError(element.id, "cx,cy", [point]));
    }
  }
  return errors;
}

function containmentError(
  elementId: string,
  attribute: string,
  points: readonly Point2D[],
): ApartmentSvgValidationError {
  return Object.freeze({
    code: APARTMENT_SVG_VALIDATION_CODES.footprint.placementOutsideFootprint,
    category: "footprint",
    rule: "footprint.stationary-placement-containment",
    expected:
      "complete stationary placement geometry inside the closed apartment footprint, including its boundary",
    message: `Stationary placement geometry of element ${elementId} extends outside the apartment footprint.`,
    elementId,
    attribute,
    actual: formatPoints(points),
  });
}

function formatPoints(points: readonly Point2D[]): string {
  return points.map((point) => `(${point.x.toString()}, ${point.y.toString()})`).join(" ");
}
