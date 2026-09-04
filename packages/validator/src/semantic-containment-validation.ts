import { isPointInRect, isRectContainedInRect } from "@planaxis/geometry";
import type { Point2D, Rect2D } from "@planaxis/geometry";

import type {
  ReferenceValidApartmentSvgDocument,
  ReferenceValidDoor,
} from "./reference-valid-apartment-svg.js";
import { APARTMENT_SVG_DOOR_TYPE_VALUES } from "./schema-vocabulary.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

export function collectSemanticContainmentErrors(
  document: ReferenceValidApartmentSvgDocument,
): readonly ApartmentSvgValidationError[] {
  const errors: ApartmentSvgValidationError[] = [];
  const viewBox: Rect2D = {
    x: document.viewBox.minX,
    y: document.viewBox.minY,
    width: document.viewBox.width,
    height: document.viewBox.height,
  };

  for (const zone of document.spaces) {
    const outsidePoints = zone.points.filter((point) => !isPointInRect(point, viewBox));
    if (outsidePoints.length > 0) {
      errors.push(
        containmentError(
          zone.id,
          "points",
          `zone vertices ${outsidePoints.map(formatPoint).join(", ")}`,
          viewBox,
        ),
      );
    }
  }

  for (const element of [
    ...document.walls,
    ...document.windows,
    ...document.doors,
    ...document.fixedElements,
  ]) {
    if (!isRectContainedInRect(element, viewBox)) {
      errors.push(
        containmentError(
          element.id,
          "x,y,width,height",
          `${element.kind} footprint ${formatRect(element)}`,
          viewBox,
        ),
      );
    }
  }

  for (const utility of document.utilities) {
    const point = { x: utility.cx, y: utility.cy };
    if (!isPointInRect(point, viewBox)) {
      errors.push(
        containmentError(
          utility.id,
          "cx,cy",
          `${utility.kind} semantic point ${formatPoint(point)}`,
          viewBox,
        ),
      );
    }
  }

  for (const camera of document.cameras) {
    const point = { x: camera.cx, y: camera.cy };
    if (!isPointInRect(point, viewBox)) {
      errors.push(
        containmentError(
          camera.id,
          "cx,cy",
          `camera semantic point ${formatPoint(point)}`,
          viewBox,
        ),
      );
    }
  }

  for (const door of document.doors) {
    validateHingedDoorPoints(door, viewBox, errors);
  }

  return errors;
}

function validateHingedDoorPoints(
  door: ReferenceValidDoor,
  viewBox: Rect2D,
  errors: ApartmentSvgValidationError[],
): void {
  if (door.doorType !== APARTMENT_SVG_DOOR_TYPE_VALUES.hinged) return;

  if (!isPointInRect(door.hinge, viewBox)) {
    errors.push(
      containmentError(
        door.id,
        "data-hinge-x,data-hinge-y",
        `hinge point ${formatPoint(door.hinge)}`,
        viewBox,
      ),
    );
  }
  if (!isPointInRect(door.openLeaf, viewBox)) {
    errors.push(
      containmentError(
        door.id,
        "data-open-leaf-x,data-open-leaf-y",
        `open-leaf point ${formatPoint(door.openLeaf)}`,
        viewBox,
      ),
    );
  }
}

function containmentError(
  elementId: string,
  attribute: string,
  actual: string,
  viewBox: Rect2D,
): ApartmentSvgValidationError {
  return Object.freeze({
    code: APARTMENT_SVG_VALIDATION_CODES.root.semanticGeometryOutsideViewBox,
    category: "root",
    rule: "root.semantic-geometry-view-box-containment",
    expected: `all semantic XY geometry inside viewBox ${formatRect(viewBox)}, including its boundary`,
    message: `Semantic geometry of element ${elementId} extends outside the root viewBox.`,
    elementId,
    attribute,
    actual,
  });
}

function formatPoint(point: Point2D): string {
  return `(${point.x.toString()}, ${point.y.toString()})`;
}

function formatRect(rect: Rect2D): string {
  return `x=${rect.x.toString()}, y=${rect.y.toString()}, width=${rect.width.toString()}, height=${rect.height.toString()}`;
}
