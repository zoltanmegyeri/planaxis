import {
  arePointsGeometricallyEqual,
  GEOMETRIC_EPSILON,
  getRectBottomEdge,
  getRectCenterX,
  getRectCenterY,
  getRectRightEdge,
  isGeometricallyEqual,
} from "@planaxis/geometry";
import type { Decimal, Point2D, Rect2D } from "@planaxis/geometry";

import type {
  ReferenceValidApartmentSvgDocument,
  ReferenceValidDoor,
  ReferenceValidHingedDoor,
  ReferenceValidWall,
  ReferenceValidWindow,
} from "./reference-valid-apartment-svg.js";
import {
  APARTMENT_SVG_DOOR_TYPE_VALUES,
  APARTMENT_SVG_WALL_AXIS_VALUES,
} from "./schema-vocabulary.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

export interface ApartmentSvgWallAndOpeningGeometryValidationSuccess {
  readonly valid: true;
  readonly errors: readonly [];
  readonly document: ReferenceValidApartmentSvgDocument;
}

export interface ApartmentSvgWallAndOpeningGeometryValidationFailure {
  readonly valid: false;
  readonly errors: readonly ApartmentSvgValidationError[];
}

export type ApartmentSvgWallAndOpeningGeometryValidationResult =
  | ApartmentSvgWallAndOpeningGeometryValidationSuccess
  | ApartmentSvgWallAndOpeningGeometryValidationFailure;

const EMPTY_VALIDATION_ERRORS: readonly [] = Object.freeze([]);

/**
 * Validates the Apartment SVG 2.1 wall and opening geometry that follows
 * reference resolution. Later topology, overlap, placement, and collision
 * rules remain deferred.
 */
export function validateApartmentSvgWallAndOpeningGeometry(
  document: ReferenceValidApartmentSvgDocument,
): ApartmentSvgWallAndOpeningGeometryValidationResult {
  const errors: ApartmentSvgValidationError[] = [];

  for (const wall of document.walls) {
    validateWallAxisGeometry(wall, errors);
  }

  for (const window of document.windows) {
    validateWindowGeometry(window, document.metadata.level.defaultCeilingHeight, errors);
  }

  for (const door of document.doors) {
    validateDoorGeometry(door, document.metadata.level.defaultCeilingHeight, errors);
  }

  if (errors.length > 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  return Object.freeze({ valid: true, errors: EMPTY_VALIDATION_ERRORS, document });
}

function validateWallAxisGeometry(
  wall: ReferenceValidWall,
  errors: ApartmentSvgValidationError[],
): void {
  const hasValidAxisGeometry =
    wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
      ? wall.width.greaterThan(wall.height)
      : wall.height.greaterThan(wall.width);
  if (hasValidAxisGeometry) return;

  const expectedComparison =
    wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x ? "width > height" : "height > width";
  errors.push(
    geometryError({
      code: APARTMENT_SVG_VALIDATION_CODES.wall.invalidAxisGeometry,
      category: "wall",
      rule: "wall.axis-geometry",
      expected: `data-axis=${wall.axis} requires ${expectedComparison}`,
      message: `Wall ${wall.id} has dimensions inconsistent with its longitudinal axis.`,
      elementId: wall.id,
      attribute: "data-axis",
      actual: `data-axis=${wall.axis}, width=${formatDecimal(wall.width)}, height=${formatDecimal(wall.height)}`,
    }),
  );
}

function validateWindowGeometry(
  window: ReferenceValidWindow,
  defaultCeilingHeight: Decimal,
  errors: ApartmentSvgValidationError[],
): void {
  if (!coversWallThickness(window, window.wall)) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.window.invalidWallThicknessCoverage,
        category: "window",
        rule: "window.wall-thickness-coverage",
        expected: formatWallThicknessCoverage(window.wall),
        message: `Window ${window.id} does not cover the full thickness of supporting wall ${window.wall.id}.`,
        elementId: window.id,
        actual: formatRect(window),
      }),
    );
  }

  if (!isWithinWallLongitudinalExtent(window, window.wall)) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.window.outsideWallLongitudinalExtent,
        category: "window",
        rule: "window.wall-longitudinal-containment",
        expected: formatWallLongitudinalExtent(window.wall),
        message: `Window ${window.id} exceeds the longitudinal extent of supporting wall ${window.wall.id}.`,
        elementId: window.id,
        actual: formatOpeningLongitudinalExtent(window, window.wall),
      }),
    );
  }

  const effectiveWallHeight = getEffectiveWallHeight(window.wall, defaultCeilingHeight);
  const openingTop = window.sillHeight.plus(window.openingHeight);
  if (openingTop.greaterThan(effectiveWallHeight)) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.window.exceedsWallHeight,
        category: "window",
        rule: "window.vertical-opening-extent",
        expected: `data-sill-height + data-opening-height <= ${formatDecimal(effectiveWallHeight)}`,
        message: `Window ${window.id} extends above the effective height of supporting wall ${window.wall.id}.`,
        elementId: window.id,
        actual: `${formatDecimal(window.sillHeight)} + ${formatDecimal(window.openingHeight)} = ${formatDecimal(openingTop)}`,
      }),
    );
  }
}

function validateDoorGeometry(
  door: ReferenceValidDoor,
  defaultCeilingHeight: Decimal,
  errors: ApartmentSvgValidationError[],
): void {
  if (!coversWallThickness(door, door.wall)) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.door.invalidWallThicknessCoverage,
        category: "door",
        rule: "door.wall-thickness-coverage",
        expected: formatWallThicknessCoverage(door.wall),
        message: `Door ${door.id} does not cover the full thickness of supporting wall ${door.wall.id}.`,
        elementId: door.id,
        actual: formatRect(door),
      }),
    );
  }

  if (!isWithinWallLongitudinalExtent(door, door.wall)) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.door.outsideWallLongitudinalExtent,
        category: "door",
        rule: "door.wall-longitudinal-containment",
        expected: formatWallLongitudinalExtent(door.wall),
        message: `Door ${door.id} exceeds the longitudinal extent of supporting wall ${door.wall.id}.`,
        elementId: door.id,
        actual: formatOpeningLongitudinalExtent(door, door.wall),
      }),
    );
  }

  const effectiveWallHeight = getEffectiveWallHeight(door.wall, defaultCeilingHeight);
  if (door.openingHeight.greaterThan(effectiveWallHeight)) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.door.exceedsWallHeight,
        category: "door",
        rule: "door.vertical-opening-extent",
        expected: `data-opening-height <= ${formatDecimal(effectiveWallHeight)}`,
        message: `Door ${door.id} extends above the effective height of supporting wall ${door.wall.id}.`,
        elementId: door.id,
        attribute: "data-opening-height",
        actual: formatDecimal(door.openingHeight),
      }),
    );
  }

  if (door.doorType === APARTMENT_SVG_DOOR_TYPE_VALUES.hinged) {
    validateHingedDoorGeometry(door, errors);
  }
}

function validateHingedDoorGeometry(
  door: ReferenceValidHingedDoor,
  errors: ApartmentSvgValidationError[],
): void {
  const hingeEndpoints = getHingeEndpoints(door, door.wall);
  if (!hingeEndpoints.some((endpoint) => arePointsGeometricallyEqual(door.hinge, endpoint))) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.door.invalidHingePoint,
        category: "door",
        rule: "door.hinge-point",
        expected: `one opening endpoint on wall ${door.wall.id}'s centerline: ${hingeEndpoints.map(formatPoint).join(" or ")}`,
        message: `Hinged door ${door.id} has an invalid hinge point.`,
        elementId: door.id,
        attribute: "data-hinge-x,data-hinge-y",
        actual: formatPoint(door.hinge),
      }),
    );
  }

  const leafLength = getOpeningWidth(door, door.wall);
  if (!isValidOpenLeafPoint(door.openLeaf, door.hinge, leafLength, door.wall)) {
    errors.push(
      geometryError({
        code: APARTMENT_SVG_VALIDATION_CODES.door.invalidOpenLeafPoint,
        category: "door",
        rule: "door.open-leaf-point",
        expected: formatOpenLeafExpectation(door.hinge, leafLength, door.wall),
        message: `Hinged door ${door.id} has an invalid 90-degree open-leaf point.`,
        elementId: door.id,
        attribute: "data-open-leaf-x,data-open-leaf-y",
        actual: formatPoint(door.openLeaf),
      }),
    );
  }
}

function coversWallThickness(opening: Rect2D, wall: ReferenceValidWall): boolean {
  return wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
    ? isGeometricallyEqual(opening.y, wall.y) && isGeometricallyEqual(opening.height, wall.height)
    : isGeometricallyEqual(opening.x, wall.x) && isGeometricallyEqual(opening.width, wall.width);
}

function isWithinWallLongitudinalExtent(opening: Rect2D, wall: ReferenceValidWall): boolean {
  return wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
    ? opening.x.greaterThanOrEqualTo(wall.x) &&
        getRectRightEdge(opening).lessThanOrEqualTo(getRectRightEdge(wall))
    : opening.y.greaterThanOrEqualTo(wall.y) &&
        getRectBottomEdge(opening).lessThanOrEqualTo(getRectBottomEdge(wall));
}

function getEffectiveWallHeight(wall: ReferenceValidWall, defaultCeilingHeight: Decimal): Decimal {
  return wall.wallHeight ?? defaultCeilingHeight;
}

function getHingeEndpoints(
  door: ReferenceValidHingedDoor,
  wall: ReferenceValidWall,
): readonly [Point2D, Point2D] {
  if (wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x) {
    const centerY = getRectCenterY(wall);
    return [
      { x: door.x, y: centerY },
      { x: getRectRightEdge(door), y: centerY },
    ];
  }

  const centerX = getRectCenterX(wall);
  return [
    { x: centerX, y: door.y },
    { x: centerX, y: getRectBottomEdge(door) },
  ];
}

function getOpeningWidth(opening: Rect2D, wall: ReferenceValidWall): Decimal {
  return wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x ? opening.width : opening.height;
}

function isValidOpenLeafPoint(
  openLeaf: Point2D,
  hinge: Point2D,
  leafLength: Decimal,
  wall: ReferenceValidWall,
): boolean {
  return wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
    ? isGeometricallyEqual(openLeaf.x, hinge.x) &&
        isGeometricallyEqual(openLeaf.y.minus(hinge.y).abs(), leafLength)
    : isGeometricallyEqual(openLeaf.y, hinge.y) &&
        isGeometricallyEqual(openLeaf.x.minus(hinge.x).abs(), leafLength);
}

function formatWallThicknessCoverage(wall: ReferenceValidWall): string {
  const tolerance = formatDecimal(GEOMETRIC_EPSILON);
  return wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
    ? `y=${formatDecimal(wall.y)} and height=${formatDecimal(wall.height)}, each within ${tolerance} cm`
    : `x=${formatDecimal(wall.x)} and width=${formatDecimal(wall.width)}, each within ${tolerance} cm`;
}

function formatWallLongitudinalExtent(wall: ReferenceValidWall): string {
  return wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
    ? `X extent contained in [${formatDecimal(wall.x)}, ${formatDecimal(getRectRightEdge(wall))}]`
    : `Y extent contained in [${formatDecimal(wall.y)}, ${formatDecimal(getRectBottomEdge(wall))}]`;
}

function formatOpeningLongitudinalExtent(opening: Rect2D, wall: ReferenceValidWall): string {
  return wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
    ? `X extent [${formatDecimal(opening.x)}, ${formatDecimal(getRectRightEdge(opening))}]`
    : `Y extent [${formatDecimal(opening.y)}, ${formatDecimal(getRectBottomEdge(opening))}]`;
}

function formatOpenLeafExpectation(
  hinge: Point2D,
  leafLength: Decimal,
  wall: ReferenceValidWall,
): string {
  const negativeLeafLength = leafLength.negated();
  const candidates: readonly [Point2D, Point2D] =
    wall.axis === APARTMENT_SVG_WALL_AXIS_VALUES.x
      ? [
          { x: hinge.x, y: hinge.y.plus(negativeLeafLength) },
          { x: hinge.x, y: hinge.y.plus(leafLength) },
        ]
      : [
          { x: hinge.x.plus(negativeLeafLength), y: hinge.y },
          { x: hinge.x.plus(leafLength), y: hinge.y },
        ];
  return `a perpendicular leaf of length ${formatDecimal(leafLength)} ending at ${candidates.map(formatPoint).join(" or ")}`;
}

function formatRect(rect: Rect2D): string {
  return `x=${formatDecimal(rect.x)}, y=${formatDecimal(rect.y)}, width=${formatDecimal(rect.width)}, height=${formatDecimal(rect.height)}`;
}

function formatPoint(point: Point2D): string {
  return `(${formatDecimal(point.x)}, ${formatDecimal(point.y)})`;
}

function formatDecimal(value: Decimal): string {
  return value.toString();
}

function geometryError(error: ApartmentSvgValidationError): ApartmentSvgValidationError {
  return Object.freeze(error);
}
