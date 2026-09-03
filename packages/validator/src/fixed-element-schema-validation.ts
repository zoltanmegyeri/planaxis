import type { ParsedXmlElement } from "@planaxis/parser";

import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_FIXED_ELEMENT_KIND_VALUES,
  APARTMENT_SVG_GROUP_IDS,
  APARTMENT_SVG_SEMANTIC_KINDS,
} from "./schema-vocabulary.js";
import {
  elementError,
  readOptionalAttribute,
  readOptionalRef,
  readRequiredEnum,
  readRequiredScalar,
  reportConditionalAttribute,
  validateCommonSemanticElement,
} from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import {
  readRequiredNonNegativeZ,
  readRequiredRectangleAttributes,
  readRequiredStatus,
} from "./semantic-value-validation.js";
import { validateApartmentSvgPositiveNumber } from "./scalar-validation.js";
import type {
  ApartmentSvgFixedElementKind,
  SchemaValidFixedElement,
} from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  APARTMENT_SVG_ATTRIBUTES.x,
  APARTMENT_SVG_ATTRIBUTES.y,
  APARTMENT_SVG_ATTRIBUTES.width,
  APARTMENT_SVG_ATTRIBUTES.height,
  APARTMENT_SVG_ATTRIBUTES.dataKind,
  APARTMENT_SVG_ATTRIBUTES.dataBaseZ,
  APARTMENT_SVG_ATTRIBUTES.dataHeight,
  APARTMENT_SVG_ATTRIBUTES.dataWall,
  APARTMENT_SVG_ATTRIBUTES.dataTypeDescription,
  APARTMENT_SVG_ATTRIBUTES.dataStatus,
]);
const FIXED_ELEMENT_KINDS = new Set<ApartmentSvgFixedElementKind>(
  Object.values(APARTMENT_SVG_FIXED_ELEMENT_KIND_VALUES),
);

export interface FixedElementSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidFixedElement;
}

export function validateFixedElementSchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): FixedElementSchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: APARTMENT_SVG_GROUP_IDS.fixedElements,
      elementName: APARTMENT_SVG_ELEMENT_NAMES.rectangle,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: FIXED_ELEMENT_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      category: "fixed-element",
    },
    idRegistry,
  );
  const rectangle = readRequiredRectangleAttributes(
    context,
    APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
    "fixed-element",
  );
  const kind = readFixedElementKind(context);
  const baseZ = readRequiredNonNegativeZ(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataBaseZ,
    APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
    "fixed-element",
  );
  const elementHeight = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataHeight,
    validateApartmentSvgPositiveNumber,
    APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
    "fixed-element",
    "fixed-element.data-height",
  );
  const wallId = validateWallReference(context, kind);
  const typeDescription = validateTypeDescription(context, kind);
  const status = readRequiredStatus(
    context,
    APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
    "fixed-element",
  );

  const errors = Object.freeze(context.errors);
  if (
    errors.length > 0 ||
    context.id === undefined ||
    rectangle.x === undefined ||
    rectangle.y === undefined ||
    rectangle.width === undefined ||
    rectangle.height === undefined ||
    kind === undefined ||
    baseZ === undefined ||
    elementHeight === undefined ||
    status === undefined
  ) {
    return Object.freeze({ errors });
  }

  const base = {
    id: context.id,
    x: rectangle.x,
    y: rectangle.y,
    width: rectangle.width,
    height: rectangle.height,
    baseZ,
    elementHeight,
    status,
  };
  if (kind === APARTMENT_SVG_SEMANTIC_KINDS.radiator) {
    return Object.freeze({
      errors,
      value: Object.freeze({
        ...base,
        kind,
        ...(wallId === undefined ? {} : { wallId }),
      }),
    });
  }
  if (kind === APARTMENT_SVG_SEMANTIC_KINDS.fixedObject) {
    if (typeDescription === undefined) {
      throw new Error("A schema-valid fixed-object did not expose its required description.");
    }
    return Object.freeze({
      errors,
      value: Object.freeze({ ...base, kind, typeDescription }),
    });
  }

  return Object.freeze({ errors, value: Object.freeze({ ...base, kind }) });
}

function readFixedElementKind(
  context: ReturnType<typeof validateCommonSemanticElement>,
): ApartmentSvgFixedElementKind | undefined {
  const rawKind = readOptionalAttribute(context, APARTMENT_SVG_ATTRIBUTES.dataKind);
  if (rawKind === undefined || context.kind === undefined) {
    return undefined;
  }

  return readRequiredEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataKind,
    FIXED_ELEMENT_KINDS,
    APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
    "fixed-element",
    "fixed-element.data-kind",
  );
}

function validateWallReference(
  context: ReturnType<typeof validateCommonSemanticElement>,
  kind: ApartmentSvgFixedElementKind | undefined,
): string | undefined {
  if (kind === undefined) {
    return undefined;
  }

  const value = readOptionalAttribute(context, APARTMENT_SVG_ATTRIBUTES.dataWall);
  if (kind === APARTMENT_SVG_SEMANTIC_KINDS.radiator) {
    return readOptionalRef(
      context,
      APARTMENT_SVG_ATTRIBUTES.dataWall,
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      "fixed-element",
      "fixed-element.data-wall",
    );
  }

  if (value !== undefined) {
    reportConditionalAttribute(
      context,
      APARTMENT_SVG_ATTRIBUTES.dataWall,
      'absence unless data-kind="radiator"',
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
      "fixed-element",
      "fixed-element.data-wall",
    );
  }
  return undefined;
}

function validateTypeDescription(
  context: ReturnType<typeof validateCommonSemanticElement>,
  kind: ApartmentSvgFixedElementKind | undefined,
): string | undefined {
  if (kind === undefined) {
    return undefined;
  }

  const value = readOptionalAttribute(context, APARTMENT_SVG_ATTRIBUTES.dataTypeDescription);
  if (kind === APARTMENT_SVG_SEMANTIC_KINDS.fixedObject) {
    if (value === undefined) {
      reportConditionalAttribute(
        context,
        APARTMENT_SVG_ATTRIBUTES.dataTypeDescription,
        'a non-empty value when data-kind="fixed-object"',
        APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
        "fixed-element",
        "fixed-element.type-description",
      );
      return undefined;
    }
    if (value.length === 0) {
      context.errors.push(
        elementError(
          APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
          "fixed-element",
          "fixed-element.type-description",
          'a non-empty value when data-kind="fixed-object"',
          "A fixed-object requires a non-empty type description.",
          context,
          { attribute: APARTMENT_SVG_ATTRIBUTES.dataTypeDescription, actual: value },
        ),
      );
      return undefined;
    }
    return value;
  }

  if (value !== undefined) {
    reportConditionalAttribute(
      context,
      APARTMENT_SVG_ATTRIBUTES.dataTypeDescription,
      'absence unless data-kind="fixed-object"',
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
      "fixed-element",
      "fixed-element.type-description",
    );
  }
  return undefined;
}
