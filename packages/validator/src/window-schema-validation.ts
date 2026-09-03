import type { ParsedXmlElement } from "@planaxis/parser";

import {
  elementError,
  readOptionalAttribute,
  readOptionalEnum,
  readOptionalRef,
  readRequiredRef,
  readRequiredScalar,
  reportConditionalAttribute,
  validateCommonSemanticElement,
} from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import {
  readRequiredRectangleAttributes,
  readRequiredStatus,
} from "./semantic-value-validation.js";
import {
  validateApartmentSvgNonNegativeNumber,
  validateApartmentSvgPositiveNumber,
} from "./scalar-validation.js";
import type {
  ApartmentSvgWindowFrameMaterial,
  ApartmentSvgWindowGlassType,
  ApartmentSvgWindowOpeningType,
  SchemaValidWindow,
} from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  "x",
  "y",
  "width",
  "height",
  "data-kind",
  "data-wall",
  "data-sill-height",
  "data-opening-height",
  "data-opening-type",
  "data-frame-material",
  "data-frame-material-description",
  "data-frame-color",
  "data-glass-type",
  "data-glass-type-description",
  "data-radiator-below",
  "data-status",
]);
const ALLOWED_KINDS = new Set(["window"]);
const OPENING_TYPES = new Set<ApartmentSvgWindowOpeningType>([
  "fixed",
  "casement",
  "tilt",
  "tilt-turn",
  "sliding",
]);
const FRAME_MATERIALS = new Set<ApartmentSvgWindowFrameMaterial>([
  "wood",
  "plastic",
  "aluminium",
  "steel",
  "other",
]);
const GLASS_TYPES = new Set<ApartmentSvgWindowGlassType>(["clear", "frosted", "tinted", "other"]);

export interface WindowSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidWindow;
}

export function validateWindowSchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): WindowSchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: "windows",
      elementName: "rect",
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: ALLOWED_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
      category: "window",
    },
    idRegistry,
  );
  const rectangle = readRequiredRectangleAttributes(
    context,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
  );
  const wallId = readRequiredRef(
    context,
    "data-wall",
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-wall",
  );
  const sillHeight = readRequiredScalar(
    context,
    "data-sill-height",
    validateApartmentSvgNonNegativeNumber,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-sill-height",
  );
  const openingHeight = readRequiredScalar(
    context,
    "data-opening-height",
    validateApartmentSvgPositiveNumber,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-opening-height",
  );
  const openingType = readOptionalEnum(
    context,
    "data-opening-type",
    OPENING_TYPES,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-opening-type",
  );

  const rawFrameMaterial = readOptionalAttribute(context, "data-frame-material");
  const frameMaterial = readOptionalEnum(
    context,
    "data-frame-material",
    FRAME_MATERIALS,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-frame-material",
  );
  const frameMaterialDescription = validateConditionalDescription(
    context,
    rawFrameMaterial,
    frameMaterial,
    "data-frame-material-description",
    "window.frame-material-description",
  );
  const frameColor = readOptionalAttribute(context, "data-frame-color");

  const rawGlassType = readOptionalAttribute(context, "data-glass-type");
  const glassType = readOptionalEnum(
    context,
    "data-glass-type",
    GLASS_TYPES,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-glass-type",
  );
  const glassTypeDescription = validateConditionalDescription(
    context,
    rawGlassType,
    glassType,
    "data-glass-type-description",
    "window.glass-type-description",
  );
  const radiatorBelowId = readOptionalRef(
    context,
    "data-radiator-below",
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-radiator-below",
  );
  const status = readRequiredStatus(
    context,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
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
    wallId === undefined ||
    sillHeight === undefined ||
    openingHeight === undefined ||
    status === undefined
  ) {
    return Object.freeze({ errors });
  }

  return Object.freeze({
    errors,
    value: Object.freeze({
      id: context.id,
      kind: "window",
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      wallId,
      sillHeight,
      openingHeight,
      ...(openingType === undefined ? {} : { openingType }),
      ...(frameMaterial === undefined ? {} : { frameMaterial }),
      ...(frameMaterialDescription === undefined ? {} : { frameMaterialDescription }),
      ...(frameColor === undefined ? {} : { frameColor }),
      ...(glassType === undefined ? {} : { glassType }),
      ...(glassTypeDescription === undefined ? {} : { glassTypeDescription }),
      ...(radiatorBelowId === undefined ? {} : { radiatorBelowId }),
      status,
    }),
  });
}

function validateConditionalDescription<T extends string>(
  context: ReturnType<typeof validateCommonSemanticElement>,
  rawDiscriminator: string | undefined,
  discriminator: T | undefined,
  descriptionAttribute: string,
  rule: string,
): string | undefined {
  const description = readOptionalAttribute(context, descriptionAttribute);
  if (rawDiscriminator !== undefined && discriminator === undefined) {
    return undefined;
  }

  if (discriminator === "other") {
    if (description === undefined) {
      reportConditionalAttribute(
        context,
        descriptionAttribute,
        'a non-empty value when the related enum is "other"',
        APARTMENT_SVG_VALIDATION_CODES.window.conditionalAttribute,
        "window",
        rule,
      );
      return undefined;
    }
    if (description.length === 0) {
      context.errors.push(
        elementError(
          APARTMENT_SVG_VALIDATION_CODES.window.conditionalAttribute,
          "window",
          rule,
          'a non-empty value when the related enum is "other"',
          "A conditional window description must not be empty.",
          context,
          { attribute: descriptionAttribute, actual: description },
        ),
      );
      return undefined;
    }
    return description;
  }

  if (description !== undefined) {
    reportConditionalAttribute(
      context,
      descriptionAttribute,
      'absence unless the related enum is "other"',
      APARTMENT_SVG_VALIDATION_CODES.window.conditionalAttribute,
      "window",
      rule,
    );
  }
  return undefined;
}
