import { createDecimal } from "@planaxis/geometry";
import type { Point2D } from "@planaxis/geometry";
import type { ParsedXmlElement } from "@planaxis/parser";

import {
  elementError,
  readOptionalAttribute,
  readRequiredEnum,
  readRequiredNonEmptyString,
  reportConditionalAttribute,
  validateCommonSemanticElement,
} from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import { isApartmentSvgNumberLexeme } from "./scalar-validation.js";
import type {
  ApartmentSvgSpaceEnclosure,
  ApartmentSvgSpaceFunction,
  SchemaValidSpace,
} from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  "points",
  "data-kind",
  "data-name",
  "data-function",
  "data-function-description",
  "data-enclosure",
]);
const ALLOWED_KINDS = new Set(["zone"]);
const SPACE_FUNCTIONS = new Set<ApartmentSvgSpaceFunction>([
  "living-room",
  "dining",
  "kitchen",
  "bedroom",
  "bathroom",
  "toilet",
  "hall",
  "corridor",
  "entrance",
  "home-office",
  "storage",
  "utility",
  "balcony",
  "other",
]);
const SPACE_ENCLOSURES = new Set<ApartmentSvgSpaceEnclosure>(["closed", "partial", "open"]);
const COORDINATE_SEPARATOR = "(?:\\s*,\\s*|\\s+)";
const NUMBER_SOURCE = "-?[0-9]+(?:\\.[0-9]+)?";
const COORDINATE_LIST_PATTERN = new RegExp(
  `^${NUMBER_SOURCE}${COORDINATE_SEPARATOR}${NUMBER_SOURCE}(?:${COORDINATE_SEPARATOR}${NUMBER_SOURCE}${COORDINATE_SEPARATOR}${NUMBER_SOURCE})*$`,
  "u",
);

export interface SpaceSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidSpace;
}

export function validateSpaceSchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): SpaceSchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: "spaces",
      elementName: "polygon",
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: ALLOWED_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
      category: "zone",
    },
    idRegistry,
  );
  const points = readPoints(context);
  const name = readRequiredNonEmptyString(
    context,
    "data-name",
    APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
    "zone",
    "zone.data-name",
  );
  const spaceFunction = readRequiredEnum(
    context,
    "data-function",
    SPACE_FUNCTIONS,
    APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
    "zone",
    "zone.data-function",
  );
  const functionDescription = validateFunctionDescription(context, spaceFunction);
  const enclosure = readRequiredEnum(
    context,
    "data-enclosure",
    SPACE_ENCLOSURES,
    APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
    "zone",
    "zone.data-enclosure",
  );

  const errors = Object.freeze(context.errors);
  if (
    errors.length > 0 ||
    context.id === undefined ||
    context.kind === undefined ||
    points === undefined ||
    name === undefined ||
    spaceFunction === undefined ||
    enclosure === undefined
  ) {
    return Object.freeze({ errors });
  }

  return Object.freeze({
    errors,
    value: Object.freeze({
      id: context.id,
      kind: "zone",
      points,
      name,
      function: spaceFunction,
      ...(functionDescription === undefined ? {} : { functionDescription }),
      enclosure,
    }),
  });
}

function readPoints(
  context: ReturnType<typeof validateCommonSemanticElement>,
): readonly Point2D[] | undefined {
  const value = readRequiredNonEmptyString(
    context,
    "points",
    APARTMENT_SVG_VALIDATION_CODES.zone.malformedPoints,
    "zone",
    "zone.points-syntax",
  );
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  const lexicalComponents = trimmed.split(/[\s,]+/u).filter((component) => component.length > 0);
  const invalidComponent = lexicalComponents.find(
    (component) => !isApartmentSvgNumberLexeme(component),
  );
  if (invalidComponent !== undefined) {
    context.errors.push(
      elementError(
        APARTMENT_SVG_VALIDATION_CODES.zone.invalidPointNumber,
        "zone",
        "zone.points-number-lexemes",
        "coordinate components matching -?[0-9]+(\\.[0-9]+)?",
        "A space points coordinate is not an Apartment SVG Number.",
        context,
        { attribute: "points", actual: invalidComponent },
      ),
    );
    return undefined;
  }

  if (!COORDINATE_LIST_PATTERN.test(trimmed)) {
    context.errors.push(
      elementError(
        APARTMENT_SVG_VALIDATION_CODES.zone.malformedPoints,
        "zone",
        "zone.points-syntax",
        "one or more SVG coordinate pairs using Apartment SVG Number components",
        "The space points attribute is not a syntactically valid coordinate list.",
        context,
        { attribute: "points", actual: value },
      ),
    );
    return undefined;
  }

  const points: Point2D[] = [];
  for (let index = 0; index < lexicalComponents.length; index += 2) {
    const x = lexicalComponents[index];
    const y = lexicalComponents[index + 1];
    if (x === undefined || y === undefined) {
      throw new Error("A validated coordinate list did not contain complete coordinate pairs.");
    }
    points.push(Object.freeze({ x: createDecimal(x), y: createDecimal(y) }));
  }

  return Object.freeze(points);
}

function validateFunctionDescription(
  context: ReturnType<typeof validateCommonSemanticElement>,
  spaceFunction: ApartmentSvgSpaceFunction | undefined,
): string | undefined {
  const value = readOptionalAttribute(context, "data-function-description");
  if (spaceFunction === undefined) {
    return undefined;
  }

  if (spaceFunction === "other") {
    if (value === undefined) {
      reportConditionalAttribute(
        context,
        "data-function-description",
        'a non-empty value when data-function="other"',
        APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute,
        "zone",
        "zone.function-description",
      );
      return undefined;
    }
    if (value.length === 0) {
      context.errors.push(
        elementError(
          APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute,
          "zone",
          "zone.function-description",
          'a non-empty value when data-function="other"',
          "A space with data-function other requires a non-empty description.",
          context,
          { attribute: "data-function-description", actual: value },
        ),
      );
      return undefined;
    }
    return value;
  }

  if (value !== undefined) {
    reportConditionalAttribute(
      context,
      "data-function-description",
      'absence unless data-function="other"',
      APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute,
      "zone",
      "zone.function-description",
    );
  }
  return undefined;
}
