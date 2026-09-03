import type { ParsedXmlElement } from "@planaxis/parser";

import {
  readOptionalScalar,
  readRequiredEnum,
  validateCommonSemanticElement,
} from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import {
  readRequiredRectangleAttributes,
  readRequiredStatus,
} from "./semantic-value-validation.js";
import { validateApartmentSvgPositiveNumber } from "./scalar-validation.js";
import type {
  ApartmentSvgWallAxis,
  ApartmentSvgWallClass,
  SchemaValidWall,
} from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  "x",
  "y",
  "width",
  "height",
  "data-kind",
  "data-axis",
  "data-height",
  "data-class",
  "data-status",
]);
const ALLOWED_KINDS = new Set(["wall"]);
const WALL_AXES = new Set<ApartmentSvgWallAxis>(["x", "y"]);
const WALL_CLASSES = new Set<ApartmentSvgWallClass>(["interior", "exterior"]);

export interface WallSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidWall;
}

export function validateWallSchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): WallSchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: "walls",
      elementName: "rect",
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: ALLOWED_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
      category: "wall",
    },
    idRegistry,
  );
  const rectangle = readRequiredRectangleAttributes(
    context,
    APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
    "wall",
  );
  const axis = readRequiredEnum(
    context,
    "data-axis",
    WALL_AXES,
    APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
    "wall",
    "wall.data-axis",
  );
  const wallHeight = readOptionalScalar(
    context,
    "data-height",
    validateApartmentSvgPositiveNumber,
    APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
    "wall",
    "wall.data-height",
  );
  const wallClass = readRequiredEnum(
    context,
    "data-class",
    WALL_CLASSES,
    APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
    "wall",
    "wall.data-class",
  );
  const status = readRequiredStatus(
    context,
    APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
    "wall",
  );

  const errors = Object.freeze(context.errors);
  if (
    errors.length > 0 ||
    context.id === undefined ||
    context.kind === undefined ||
    rectangle.x === undefined ||
    rectangle.y === undefined ||
    rectangle.width === undefined ||
    rectangle.height === undefined ||
    axis === undefined ||
    wallClass === undefined ||
    status === undefined
  ) {
    return Object.freeze({ errors });
  }

  return Object.freeze({
    errors,
    value: Object.freeze({
      id: context.id,
      kind: "wall",
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      axis,
      ...(wallHeight === undefined ? {} : { wallHeight }),
      wallClass,
      status,
    }),
  });
}
