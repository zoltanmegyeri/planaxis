import {
  arePointsGeometricallyEqual,
  doesPolygonOverlapRectWithPositiveArea,
  doPolygonsOverlapWithPositiveArea,
  getPolygonArea,
  hasPolygonSelfIntersection,
} from "@planaxis/geometry";
import type { Point2D } from "@planaxis/geometry";

import type {
  ReferenceValidApartmentSvgDocument,
  ReferenceValidSpace,
} from "./reference-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

export function collectZoneGeometryErrors(
  document: ReferenceValidApartmentSvgDocument,
): readonly ApartmentSvgValidationError[] {
  const errors: ApartmentSvgValidationError[] = [];
  const validZones: ReferenceValidSpace[] = [];

  for (const zone of document.spaces) {
    const distinctVertexCount = countGeometricallyDistinctVertices(zone);
    const area = getPolygonArea(zone.points);
    const hasSelfIntersection = hasPolygonSelfIntersection(zone.points);

    if (distinctVertexCount < 3) {
      errors.push(
        zoneError({
          code: APARTMENT_SVG_VALIDATION_CODES.zone.insufficientDistinctVertices,
          category: "zone",
          rule: "zone.distinct-vertices",
          expected: "at least three geometrically distinct vertices",
          message: `Zone ${zone.id} has too few geometrically distinct vertices.`,
          elementId: zone.id,
          attribute: "points",
          actual: String(distinctVertexCount),
        }),
      );
    }

    if (!area.greaterThan(0)) {
      errors.push(
        zoneError({
          code: APARTMENT_SVG_VALIDATION_CODES.zone.nonPositiveArea,
          category: "zone",
          rule: "zone.positive-area",
          expected: "polygon area > 0",
          message: `Zone ${zone.id} does not have positive area.`,
          elementId: zone.id,
          attribute: "points",
          actual: area.toString(),
        }),
      );
    }

    if (hasSelfIntersection) {
      errors.push(
        zoneError({
          code: APARTMENT_SVG_VALIDATION_CODES.zone.selfIntersection,
          category: "zone",
          rule: "zone.self-intersection",
          expected: "a simple polygon with no self-intersection",
          message: `Zone ${zone.id} is self-intersecting.`,
          elementId: zone.id,
          attribute: "points",
          actual: formatPoints(zone),
        }),
      );
    }

    if (distinctVertexCount >= 3 && area.greaterThan(0) && !hasSelfIntersection) {
      validZones.push(zone);
    }
  }

  for (const zone of validZones) {
    for (const wall of document.walls) {
      if (!doesPolygonOverlapRectWithPositiveArea(zone.points, wall)) continue;
      errors.push(
        zoneError({
          code: APARTMENT_SVG_VALIDATION_CODES.zone.overlapsWall,
          category: "zone",
          rule: "zone.wall-interior-overlap",
          expected: "no positive-area interior overlap with a wall footprint",
          message: `Zone ${zone.id} overlaps the interior of wall ${wall.id}.`,
          elementId: zone.id,
          actual: `positive-area overlap with wall ${wall.id}`,
        }),
      );
    }
  }

  for (let firstIndex = 0; firstIndex < validZones.length; firstIndex += 1) {
    const first = validZones[firstIndex];
    if (first === undefined) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < validZones.length; secondIndex += 1) {
      const second = validZones[secondIndex];
      if (second === undefined || !doPolygonsOverlapWithPositiveArea(first.points, second.points)) {
        continue;
      }
      errors.push(
        zoneError({
          code: APARTMENT_SVG_VALIDATION_CODES.zone.overlapsZone,
          category: "zone",
          rule: "zone.zone-interior-overlap",
          expected: "no positive-area interior overlap with another zone",
          message: `Zone ${second.id} overlaps the interior of zone ${first.id}.`,
          elementId: second.id,
          actual: `positive-area overlap with zone ${first.id}`,
        }),
      );
    }
  }

  return errors;
}

function countGeometricallyDistinctVertices(zone: ReferenceValidSpace): number {
  const distinct: Point2D[] = [];
  for (const point of zone.points) {
    if (!distinct.some((candidate) => arePointsGeometricallyEqual(point, candidate))) {
      distinct.push(point);
    }
  }
  return distinct.length;
}

function formatPoints(zone: ReferenceValidSpace): string {
  return zone.points.map((point) => `(${point.x.toString()}, ${point.y.toString()})`).join(" ");
}

function zoneError(error: ApartmentSvgValidationError): ApartmentSvgValidationError {
  return Object.freeze(error);
}
