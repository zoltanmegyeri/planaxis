import type { ParsedXmlElement } from "@planaxis/parser";

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
  "x",
  "y",
  "width",
  "height",
  "data-kind",
  "data-base-z",
  "data-height",
  "data-wall",
  "data-type-description",
  "data-status",
]);
const FIXED_ELEMENT_KINDS = new Set<ApartmentSvgFixedElementKind>([
  "radiator",
  "column",
  "shaft",
  "chimney",
  "boiler",
  "built-in",
  "air-conditioner",
  "stair",
  "mechanical-box",
  "fixed-object",
]);

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
      groupId: "fixed-elements",
      elementName: "rect",
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
    "data-base-z",
    APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
    "fixed-element",
  );
  const elementHeight = readRequiredScalar(
    context,
    "data-height",
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
  if (kind === "radiator") {
    return Object.freeze({
      errors,
      value: Object.freeze({
        ...base,
        kind,
        ...(wallId === undefined ? {} : { wallId }),
      }),
    });
  }
  if (kind === "fixed-object") {
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
  const rawKind = readOptionalAttribute(context, "data-kind");
  if (rawKind === undefined || context.kind === undefined) {
    return undefined;
  }

  return readRequiredEnum(
    context,
    "data-kind",
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

  const value = readOptionalAttribute(context, "data-wall");
  if (kind === "radiator") {
    return readOptionalRef(
      context,
      "data-wall",
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      "fixed-element",
      "fixed-element.data-wall",
    );
  }

  if (value !== undefined) {
    reportConditionalAttribute(
      context,
      "data-wall",
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

  const value = readOptionalAttribute(context, "data-type-description");
  if (kind === "fixed-object") {
    if (value === undefined) {
      reportConditionalAttribute(
        context,
        "data-type-description",
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
          { attribute: "data-type-description", actual: value },
        ),
      );
      return undefined;
    }
    return value;
  }

  if (value !== undefined) {
    reportConditionalAttribute(
      context,
      "data-type-description",
      'absence unless data-kind="fixed-object"',
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
      "fixed-element",
      "fixed-element.type-description",
    );
  }
  return undefined;
}
