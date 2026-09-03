import type { ParsedXmlElement } from "@planaxis/parser";

import {
  readOptionalAttribute,
  readRequiredEnum,
  readRequiredRef,
  reportConditionalAttribute,
  validateCommonSemanticElement,
} from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import {
  readOptionalStatus,
  readRequiredCircleAttributes,
  readRequiredNonNegativeZ,
} from "./semantic-value-validation.js";
import type { ApartmentSvgUtilityKind, SchemaValidUtility } from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  "cx",
  "cy",
  "r",
  "data-kind",
  "data-z",
  "data-wall",
  "data-status",
]);
const UTILITY_KINDS = new Set<ApartmentSvgUtilityKind>([
  "socket",
  "ethernet",
  "tv-coax",
  "light-switch",
  "ceiling-light",
  "wall-light",
]);

export interface UtilitySchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidUtility;
}

export function validateUtilitySchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): UtilitySchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: "utilities",
      elementName: "circle",
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: UTILITY_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
      category: "utility",
    },
    idRegistry,
  );
  const circle = readRequiredCircleAttributes(
    context,
    APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
    "utility",
  );
  const kind = readUtilityKind(context);
  const z = readRequiredNonNegativeZ(
    context,
    "data-z",
    APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
    "utility",
  );
  const wallId = validateWallReference(context, kind);
  const status = readOptionalStatus(
    context,
    APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
    "utility",
  );

  const errors = Object.freeze(context.errors);
  if (
    errors.length > 0 ||
    context.id === undefined ||
    circle.cx === undefined ||
    circle.cy === undefined ||
    circle.radius === undefined ||
    kind === undefined ||
    z === undefined
  ) {
    return Object.freeze({ errors });
  }

  const base = {
    id: context.id,
    cx: circle.cx,
    cy: circle.cy,
    radius: circle.radius,
    z,
    ...(status === undefined ? {} : { status }),
  };
  if (kind === "ceiling-light") {
    return Object.freeze({ errors, value: Object.freeze({ ...base, kind }) });
  }

  if (wallId === undefined) {
    throw new Error("A schema-valid wall-associated utility did not expose data-wall.");
  }
  return Object.freeze({
    errors,
    value: Object.freeze({ ...base, kind, wallId }),
  });
}

function readUtilityKind(
  context: ReturnType<typeof validateCommonSemanticElement>,
): ApartmentSvgUtilityKind | undefined {
  if (context.kind === undefined) {
    return undefined;
  }

  return readRequiredEnum(
    context,
    "data-kind",
    UTILITY_KINDS,
    APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
    "utility",
    "utility.data-kind",
  );
}

function validateWallReference(
  context: ReturnType<typeof validateCommonSemanticElement>,
  kind: ApartmentSvgUtilityKind | undefined,
): string | undefined {
  if (kind === undefined) {
    return undefined;
  }

  const value = readOptionalAttribute(context, "data-wall");
  if (kind === "ceiling-light") {
    if (value !== undefined) {
      reportConditionalAttribute(
        context,
        "data-wall",
        'absence when data-kind="ceiling-light"',
        APARTMENT_SVG_VALIDATION_CODES.utility.conditionalAttribute,
        "utility",
        "utility.data-wall",
      );
    }
    return undefined;
  }

  if (value === undefined) {
    reportConditionalAttribute(
      context,
      "data-wall",
      "a non-empty unresolved wall ID for a wall-associated utility",
      APARTMENT_SVG_VALIDATION_CODES.utility.conditionalAttribute,
      "utility",
      "utility.data-wall",
    );
    return undefined;
  }

  return readRequiredRef(
    context,
    "data-wall",
    APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
    "utility",
    "utility.data-wall",
  );
}
