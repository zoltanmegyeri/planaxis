import type { ParsedXmlElement } from "@planaxis/parser";

import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_GROUP_IDS,
  APARTMENT_SVG_SEMANTIC_KINDS,
  APARTMENT_SVG_SHARED_ENUM_VALUES,
  APARTMENT_SVG_WINDOW_FRAME_MATERIAL_VALUES,
  APARTMENT_SVG_WINDOW_GLASS_TYPE_VALUES,
  APARTMENT_SVG_WINDOW_OPENING_TYPE_VALUES,
} from "./schema-vocabulary.js";
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
  APARTMENT_SVG_ATTRIBUTES.x,
  APARTMENT_SVG_ATTRIBUTES.y,
  APARTMENT_SVG_ATTRIBUTES.width,
  APARTMENT_SVG_ATTRIBUTES.height,
  APARTMENT_SVG_ATTRIBUTES.dataKind,
  APARTMENT_SVG_ATTRIBUTES.dataWall,
  APARTMENT_SVG_ATTRIBUTES.dataSillHeight,
  APARTMENT_SVG_ATTRIBUTES.dataOpeningHeight,
  APARTMENT_SVG_ATTRIBUTES.dataOpeningType,
  APARTMENT_SVG_ATTRIBUTES.dataFrameMaterial,
  APARTMENT_SVG_ATTRIBUTES.dataFrameMaterialDescription,
  APARTMENT_SVG_ATTRIBUTES.dataFrameColor,
  APARTMENT_SVG_ATTRIBUTES.dataGlassType,
  APARTMENT_SVG_ATTRIBUTES.dataGlassTypeDescription,
  APARTMENT_SVG_ATTRIBUTES.dataRadiatorBelow,
  APARTMENT_SVG_ATTRIBUTES.dataStatus,
]);
const ALLOWED_KINDS = new Set([APARTMENT_SVG_SEMANTIC_KINDS.window]);
const OPENING_TYPES = new Set<ApartmentSvgWindowOpeningType>(
  Object.values(APARTMENT_SVG_WINDOW_OPENING_TYPE_VALUES),
);
const FRAME_MATERIALS = new Set<ApartmentSvgWindowFrameMaterial>(
  Object.values(APARTMENT_SVG_WINDOW_FRAME_MATERIAL_VALUES),
);
const GLASS_TYPES = new Set<ApartmentSvgWindowGlassType>(
  Object.values(APARTMENT_SVG_WINDOW_GLASS_TYPE_VALUES),
);

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
      groupId: APARTMENT_SVG_GROUP_IDS.windows,
      elementName: APARTMENT_SVG_ELEMENT_NAMES.rectangle,
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
    APARTMENT_SVG_ATTRIBUTES.dataWall,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-wall",
  );
  const sillHeight = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataSillHeight,
    validateApartmentSvgNonNegativeNumber,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-sill-height",
  );
  const openingHeight = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataOpeningHeight,
    validateApartmentSvgPositiveNumber,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-opening-height",
  );
  const openingType = readOptionalEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataOpeningType,
    OPENING_TYPES,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-opening-type",
  );

  const rawFrameMaterial = readOptionalAttribute(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataFrameMaterial,
  );
  const frameMaterial = readOptionalEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataFrameMaterial,
    FRAME_MATERIALS,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-frame-material",
  );
  const frameMaterialDescription = validateConditionalDescription(
    context,
    rawFrameMaterial,
    frameMaterial,
    APARTMENT_SVG_ATTRIBUTES.dataFrameMaterialDescription,
    "window.frame-material-description",
  );
  const frameColor = readOptionalAttribute(context, APARTMENT_SVG_ATTRIBUTES.dataFrameColor);

  const rawGlassType = readOptionalAttribute(context, APARTMENT_SVG_ATTRIBUTES.dataGlassType);
  const glassType = readOptionalEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataGlassType,
    GLASS_TYPES,
    APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
    "window",
    "window.data-glass-type",
  );
  const glassTypeDescription = validateConditionalDescription(
    context,
    rawGlassType,
    glassType,
    APARTMENT_SVG_ATTRIBUTES.dataGlassTypeDescription,
    "window.glass-type-description",
  );
  const radiatorBelowId = readOptionalRef(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataRadiatorBelow,
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
      kind: APARTMENT_SVG_SEMANTIC_KINDS.window,
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

  if (discriminator === APARTMENT_SVG_SHARED_ENUM_VALUES.other) {
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
