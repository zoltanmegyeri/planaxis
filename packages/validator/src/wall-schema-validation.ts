import type { ParsedXmlElement } from "@planaxis/parser";

import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_GROUP_IDS,
  APARTMENT_SVG_SEMANTIC_KINDS,
  APARTMENT_SVG_WALL_AXIS_VALUES,
  APARTMENT_SVG_WALL_CLASS_VALUES,
} from "./schema-vocabulary.js";
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
  APARTMENT_SVG_ATTRIBUTES.x,
  APARTMENT_SVG_ATTRIBUTES.y,
  APARTMENT_SVG_ATTRIBUTES.width,
  APARTMENT_SVG_ATTRIBUTES.height,
  APARTMENT_SVG_ATTRIBUTES.dataKind,
  APARTMENT_SVG_ATTRIBUTES.dataAxis,
  APARTMENT_SVG_ATTRIBUTES.dataHeight,
  APARTMENT_SVG_ATTRIBUTES.dataClass,
  APARTMENT_SVG_ATTRIBUTES.dataStatus,
]);
const ALLOWED_KINDS = new Set([APARTMENT_SVG_SEMANTIC_KINDS.wall]);
const WALL_AXES = new Set<ApartmentSvgWallAxis>(Object.values(APARTMENT_SVG_WALL_AXIS_VALUES));
const WALL_CLASSES = new Set<ApartmentSvgWallClass>(Object.values(APARTMENT_SVG_WALL_CLASS_VALUES));

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
      groupId: APARTMENT_SVG_GROUP_IDS.walls,
      elementName: APARTMENT_SVG_ELEMENT_NAMES.rectangle,
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
    APARTMENT_SVG_ATTRIBUTES.dataAxis,
    WALL_AXES,
    APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
    "wall",
    "wall.data-axis",
  );
  const wallHeight = readOptionalScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataHeight,
    validateApartmentSvgPositiveNumber,
    APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
    "wall",
    "wall.data-height",
  );
  const wallClass = readRequiredEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataClass,
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
      kind: APARTMENT_SVG_SEMANTIC_KINDS.wall,
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
