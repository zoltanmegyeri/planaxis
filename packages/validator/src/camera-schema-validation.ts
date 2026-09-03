import { createDecimal } from "@planaxis/geometry";
import type { ParsedXmlElement } from "@planaxis/parser";

import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_GROUP_IDS,
  APARTMENT_SVG_SEMANTIC_KINDS,
} from "./schema-vocabulary.js";
import {
  elementError,
  readRequiredScalar,
  validateCommonSemanticElement,
} from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import {
  readRequiredCircleAttributes,
  readRequiredNonNegativeZ,
} from "./semantic-value-validation.js";
import {
  validateApartmentSvgAngle360,
  validateApartmentSvgNumber,
  validateApartmentSvgPitchAngle,
} from "./scalar-validation.js";
import type { SchemaValidCamera } from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";
import { getParsedAttribute } from "./xml-element.js";

const ALLOWED_ATTRIBUTES = new Set([
  APARTMENT_SVG_ATTRIBUTES.cx,
  APARTMENT_SVG_ATTRIBUTES.cy,
  APARTMENT_SVG_ATTRIBUTES.radius,
  APARTMENT_SVG_ATTRIBUTES.dataKind,
  APARTMENT_SVG_ATTRIBUTES.dataZ,
  APARTMENT_SVG_ATTRIBUTES.dataHeading,
  APARTMENT_SVG_ATTRIBUTES.dataPitch,
  APARTMENT_SVG_ATTRIBUTES.dataHorizontalFov,
]);
const ALLOWED_KINDS = new Set([APARTMENT_SVG_SEMANTIC_KINDS.camera]);
const ZERO = createDecimal("0");
const ONE_HUNDRED_EIGHTY = createDecimal("180");

export interface CameraSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidCamera;
}

export function validateCameraSchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): CameraSchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: APARTMENT_SVG_GROUP_IDS.cameras,
      elementName: APARTMENT_SVG_ELEMENT_NAMES.circle,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: ALLOWED_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
      category: "camera",
    },
    idRegistry,
  );
  const circle = readRequiredCircleAttributes(
    context,
    APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
    "camera",
  );
  const z = readRequiredNonNegativeZ(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataZ,
    APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
    "camera",
  );
  const heading = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataHeading,
    validateApartmentSvgAngle360,
    APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
    "camera",
    "camera.data-heading",
  );
  const pitch = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataPitch,
    validateApartmentSvgPitchAngle,
    APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
    "camera",
    "camera.data-pitch",
  );
  const horizontalFov = readHorizontalFov(context);

  const errors = Object.freeze(context.errors);
  if (
    errors.length > 0 ||
    context.id === undefined ||
    context.kind === undefined ||
    circle.cx === undefined ||
    circle.cy === undefined ||
    circle.radius === undefined ||
    z === undefined ||
    heading === undefined ||
    pitch === undefined ||
    horizontalFov === undefined
  ) {
    return Object.freeze({ errors });
  }

  return Object.freeze({
    errors,
    value: Object.freeze({
      id: context.id,
      kind: APARTMENT_SVG_SEMANTIC_KINDS.camera,
      cx: circle.cx,
      cy: circle.cy,
      radius: circle.radius,
      z,
      heading,
      pitch,
      horizontalFov,
    }),
  });
}

function readHorizontalFov(context: ReturnType<typeof validateCommonSemanticElement>) {
  const horizontalFov = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataHorizontalFov,
    validateApartmentSvgNumber,
    APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
    "camera",
    "camera.data-horizontal-fov-number",
  );
  if (horizontalFov === undefined) {
    return undefined;
  }

  if (
    horizontalFov.lessThanOrEqualTo(ZERO) ||
    horizontalFov.greaterThanOrEqualTo(ONE_HUNDRED_EIGHTY)
  ) {
    const actual = getParsedAttribute(context.element, APARTMENT_SVG_ATTRIBUTES.dataHorizontalFov);
    context.errors.push(
      elementError(
        APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
        "camera",
        "camera.data-horizontal-fov-range",
        "0 < value < 180",
        "Camera horizontal field of view must be strictly between 0 and 180 degrees.",
        context,
        {
          attribute: APARTMENT_SVG_ATTRIBUTES.dataHorizontalFov,
          ...(actual === undefined ? {} : { actual }),
        },
      ),
    );
    return undefined;
  }

  return horizontalFov;
}
