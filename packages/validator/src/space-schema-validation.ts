import type { ParsedXmlElement } from "@planaxis/parser";

import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_GROUP_IDS,
  APARTMENT_SVG_SEMANTIC_KINDS,
  APARTMENT_SVG_SPACE_ENCLOSURE_VALUES,
  APARTMENT_SVG_SPACE_FUNCTION_VALUES,
} from "./schema-vocabulary.js";
import {
  elementError,
  readOptionalAttribute,
  readRequiredEnum,
  readRequiredNonEmptyString,
  reportConditionalAttribute,
  validateCommonSemanticElement,
} from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import { readPolygonPoints } from "./polygon-points-validation.js";
import type {
  ApartmentSvgSpaceEnclosure,
  ApartmentSvgSpaceFunction,
  SchemaValidSpace,
} from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  APARTMENT_SVG_ATTRIBUTES.points,
  APARTMENT_SVG_ATTRIBUTES.dataKind,
  APARTMENT_SVG_ATTRIBUTES.dataName,
  APARTMENT_SVG_ATTRIBUTES.dataFunction,
  APARTMENT_SVG_ATTRIBUTES.dataFunctionDescription,
  APARTMENT_SVG_ATTRIBUTES.dataEnclosure,
]);
const ALLOWED_KINDS = new Set([APARTMENT_SVG_SEMANTIC_KINDS.zone]);
const SPACE_FUNCTIONS = new Set<ApartmentSvgSpaceFunction>(
  Object.values(APARTMENT_SVG_SPACE_FUNCTION_VALUES),
);
const SPACE_ENCLOSURES = new Set<ApartmentSvgSpaceEnclosure>(
  Object.values(APARTMENT_SVG_SPACE_ENCLOSURE_VALUES),
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
      groupId: APARTMENT_SVG_GROUP_IDS.spaces,
      elementName: APARTMENT_SVG_ELEMENT_NAMES.polygon,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: ALLOWED_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
      category: "zone",
    },
    idRegistry,
  );
  const points = readPolygonPoints(context, "zone");
  const name = readRequiredNonEmptyString(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataName,
    APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
    "zone",
    "zone.data-name",
  );
  const spaceFunction = readRequiredEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataFunction,
    SPACE_FUNCTIONS,
    APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
    "zone",
    "zone.data-function",
  );
  const functionDescription = validateFunctionDescription(context, spaceFunction);
  const enclosure = readRequiredEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataEnclosure,
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
      kind: APARTMENT_SVG_SEMANTIC_KINDS.zone,
      points,
      name,
      function: spaceFunction,
      ...(functionDescription === undefined ? {} : { functionDescription }),
      enclosure,
    }),
  });
}

function validateFunctionDescription(
  context: ReturnType<typeof validateCommonSemanticElement>,
  spaceFunction: ApartmentSvgSpaceFunction | undefined,
): string | undefined {
  const value = readOptionalAttribute(context, APARTMENT_SVG_ATTRIBUTES.dataFunctionDescription);
  if (spaceFunction === undefined) {
    return undefined;
  }

  if (spaceFunction === APARTMENT_SVG_SPACE_FUNCTION_VALUES.other) {
    if (value === undefined) {
      reportConditionalAttribute(
        context,
        APARTMENT_SVG_ATTRIBUTES.dataFunctionDescription,
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
          {
            attribute: APARTMENT_SVG_ATTRIBUTES.dataFunctionDescription,
            actual: value,
          },
        ),
      );
      return undefined;
    }
    return value;
  }

  if (value !== undefined) {
    reportConditionalAttribute(
      context,
      APARTMENT_SVG_ATTRIBUTES.dataFunctionDescription,
      'absence unless data-function="other"',
      APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute,
      "zone",
      "zone.function-description",
    );
  }
  return undefined;
}
