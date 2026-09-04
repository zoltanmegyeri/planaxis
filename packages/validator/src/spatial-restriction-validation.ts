import {
  doRectsIntersect,
  doRectsOverlapWithPositiveArea,
  isPointInRect,
} from "@planaxis/geometry";
import type { Decimal, Point2D, Rect2D } from "@planaxis/geometry";

import type {
  ReferenceValidApartmentSvgDocument,
  ReferenceValidCamera,
  ReferenceValidDoor,
  ReferenceValidWall,
  ReferenceValidWindow,
} from "./reference-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

export function collectSpatialRestrictionErrors(
  document: ReferenceValidApartmentSvgDocument,
): readonly ApartmentSvgValidationError[] {
  const errors: ApartmentSvgValidationError[] = [];
  validateUtilityPlacement(document, errors);
  validateCameraCollisions(document, errors);
  validateOpeningWallIntersections(document, errors);
  validateOpeningOverlaps(document, errors);
  return errors;
}

function validateUtilityPlacement(
  document: ReferenceValidApartmentSvgDocument,
  errors: ApartmentSvgValidationError[],
): void {
  for (const utility of document.utilities) {
    if (!("wall" in utility)) continue;
    const point = { x: utility.cx, y: utility.cy };
    if (isPointInRect(point, utility.wall)) continue;
    errors.push(
      spatialError({
        code: APARTMENT_SVG_VALIDATION_CODES.utility.outsideSupportingWall,
        category: "utility",
        rule: "utility.supporting-wall-placement",
        expected: `semantic point on or within supporting wall ${utility.wall.id}'s footprint`,
        message: `Wall-associated utility ${utility.id} is outside supporting wall ${utility.wall.id}.`,
        elementId: utility.id,
        attribute: "cx,cy",
        actual: formatPoint(point),
      }),
    );
  }
}

function validateCameraCollisions(
  document: ReferenceValidApartmentSvgDocument,
  errors: ApartmentSvgValidationError[],
): void {
  for (const camera of document.cameras) {
    for (const wall of document.walls) {
      const minimumZ = document.metadata.level.baseZ;
      const maximumZ = minimumZ.plus(getEffectiveWallHeight(wall, document));
      if (!isCameraInsideVolume(camera, wall, minimumZ, maximumZ)) continue;
      errors.push(
        spatialError({
          code: APARTMENT_SVG_VALIDATION_CODES.camera.insideWall,
          category: "camera",
          rule: "camera.wall-volume-collision",
          expected: `camera point outside wall ${wall.id}'s physical volume`,
          message: `Camera ${camera.id} is inside wall ${wall.id}.`,
          elementId: camera.id,
          actual: formatCameraPoint(camera),
        }),
      );
    }

    for (const fixedElement of document.fixedElements) {
      const maximumZ = fixedElement.baseZ.plus(fixedElement.elementHeight);
      if (!isCameraInsideVolume(camera, fixedElement, fixedElement.baseZ, maximumZ)) continue;
      errors.push(
        spatialError({
          code: APARTMENT_SVG_VALIDATION_CODES.camera.insideFixedElement,
          category: "camera",
          rule: "camera.fixed-element-volume-collision",
          expected: `camera point outside fixed element ${fixedElement.id}'s physical volume`,
          message: `Camera ${camera.id} is inside fixed element ${fixedElement.id}.`,
          elementId: camera.id,
          actual: formatCameraPoint(camera),
        }),
      );
    }
  }
}

function validateOpeningWallIntersections(
  document: ReferenceValidApartmentSvgDocument,
  errors: ApartmentSvgValidationError[],
): void {
  for (const window of document.windows) {
    for (const wall of document.walls) {
      if (wall.id === window.wall.id || !doRectsIntersect(window, wall)) continue;
      errors.push(
        openingWallIntersectionError(
          window,
          wall,
          APARTMENT_SVG_VALIDATION_CODES.window.intersectsNonSupportingWall,
          "window",
        ),
      );
    }
  }

  for (const door of document.doors) {
    for (const wall of document.walls) {
      if (wall.id === door.wall.id || !doRectsIntersect(door, wall)) continue;
      errors.push(
        openingWallIntersectionError(
          door,
          wall,
          APARTMENT_SVG_VALIDATION_CODES.door.intersectsNonSupportingWall,
          "door",
        ),
      );
    }
  }
}

function validateOpeningOverlaps(
  document: ReferenceValidApartmentSvgDocument,
  errors: ApartmentSvgValidationError[],
): void {
  validateSameKindOpeningOverlaps(
    document.windows,
    APARTMENT_SVG_VALIDATION_CODES.window.overlapsWindow,
    "window",
    errors,
  );
  validateSameKindOpeningOverlaps(
    document.doors,
    APARTMENT_SVG_VALIDATION_CODES.door.overlapsDoor,
    "door",
    errors,
  );

  for (const door of document.doors) {
    for (const window of document.windows) {
      if (!doRectsOverlapWithPositiveArea(door, window)) continue;
      errors.push(
        spatialError({
          code: APARTMENT_SVG_VALIDATION_CODES.door.overlapsWindow,
          category: "door",
          rule: "door.window-positive-area-overlap",
          expected: "no positive-area overlap with a window footprint",
          message: `Door ${door.id} has positive-area overlap with window ${window.id}.`,
          elementId: door.id,
          actual: `positive-area overlap with window ${window.id}`,
        }),
      );
    }
  }
}

function validateSameKindOpeningOverlaps<T extends Rect2D & { readonly id: string }>(
  openings: readonly T[],
  code:
    | typeof APARTMENT_SVG_VALIDATION_CODES.window.overlapsWindow
    | typeof APARTMENT_SVG_VALIDATION_CODES.door.overlapsDoor,
  category: "window" | "door",
  errors: ApartmentSvgValidationError[],
): void {
  for (let firstIndex = 0; firstIndex < openings.length; firstIndex += 1) {
    const first = openings[firstIndex];
    if (first === undefined) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < openings.length; secondIndex += 1) {
      const second = openings[secondIndex];
      if (second === undefined || !doRectsOverlapWithPositiveArea(first, second)) continue;
      errors.push(
        spatialError({
          code,
          category,
          rule: `${category}.${category}-positive-area-overlap`,
          expected: `no positive-area overlap with another ${category} footprint`,
          message: `${capitalize(category)} ${second.id} has positive-area overlap with ${category} ${first.id}.`,
          elementId: second.id,
          actual: `positive-area overlap with ${category} ${first.id}`,
        }),
      );
    }
  }
}

function isCameraInsideVolume(
  camera: ReferenceValidCamera,
  footprint: Rect2D,
  minimumZ: Decimal,
  maximumZ: Decimal,
): boolean {
  return (
    isPointInRect({ x: camera.cx, y: camera.cy }, footprint) &&
    camera.z.greaterThanOrEqualTo(minimumZ) &&
    camera.z.lessThanOrEqualTo(maximumZ)
  );
}

function getEffectiveWallHeight(
  wall: ReferenceValidWall,
  document: ReferenceValidApartmentSvgDocument,
): Decimal {
  return wall.wallHeight ?? document.metadata.level.defaultCeilingHeight;
}

function openingWallIntersectionError(
  opening: ReferenceValidWindow | ReferenceValidDoor,
  wall: ReferenceValidWall,
  code:
    | typeof APARTMENT_SVG_VALIDATION_CODES.window.intersectsNonSupportingWall
    | typeof APARTMENT_SVG_VALIDATION_CODES.door.intersectsNonSupportingWall,
  category: "window" | "door",
): ApartmentSvgValidationError {
  return spatialError({
    code,
    category,
    rule: `${category}.non-supporting-wall-intersection`,
    expected: `intersection only with resolved supporting wall ${opening.wall.id}`,
    message: `${capitalize(category)} ${opening.id} intersects non-supporting wall ${wall.id}.`,
    elementId: opening.id,
    actual: `intersection with wall ${wall.id}`,
  });
}

function formatPoint(point: Point2D): string {
  return `(${point.x.toString()}, ${point.y.toString()})`;
}

function formatCameraPoint(camera: ReferenceValidCamera): string {
  return `(${camera.cx.toString()}, ${camera.cy.toString()}, ${camera.z.toString()})`;
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function spatialError(error: ApartmentSvgValidationError): ApartmentSvgValidationError {
  return Object.freeze(error);
}
