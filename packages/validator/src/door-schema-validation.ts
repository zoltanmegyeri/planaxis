import type { Decimal, Point2D } from "@planaxis/geometry";
import type { ParsedXmlElement } from "@planaxis/parser";

import {
  readOptionalAttribute,
  readOptionalScalar,
  readRequiredEnum,
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
  validateApartmentSvgNumber,
  validateApartmentSvgPositiveNumber,
} from "./scalar-validation.js";
import type { ApartmentSvgDoorType, SchemaValidDoor } from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  "x",
  "y",
  "width",
  "height",
  "data-kind",
  "data-wall",
  "data-door-type",
  "data-opening-height",
  "data-hinge-x",
  "data-hinge-y",
  "data-open-leaf-x",
  "data-open-leaf-y",
  "data-status",
]);
const ALLOWED_KINDS = new Set(["door"]);
const DOOR_TYPES = new Set<ApartmentSvgDoorType>(["hinged", "sliding", "opening-only"]);
const HINGE_ATTRIBUTES = [
  "data-hinge-x",
  "data-hinge-y",
  "data-open-leaf-x",
  "data-open-leaf-y",
] as const;

export interface DoorSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidDoor;
}

export function validateDoorSchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): DoorSchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: "doors",
      elementName: "rect",
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: ALLOWED_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
      category: "door",
    },
    idRegistry,
  );
  const rectangle = readRequiredRectangleAttributes(
    context,
    APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
    "door",
  );
  const wallId = readRequiredRef(
    context,
    "data-wall",
    APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
    "door",
    "door.data-wall",
  );
  const doorType = readRequiredEnum(
    context,
    "data-door-type",
    DOOR_TYPES,
    APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
    "door",
    "door.data-door-type",
  );
  const openingHeight = readRequiredScalar(
    context,
    "data-opening-height",
    validateApartmentSvgPositiveNumber,
    APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
    "door",
    "door.data-opening-height",
  );
  const hingedPoints = validateHingedAttributes(context, doorType);
  const status = readRequiredStatus(
    context,
    APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
    "door",
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
    doorType === undefined ||
    openingHeight === undefined ||
    status === undefined
  ) {
    return Object.freeze({ errors });
  }

  const base = {
    id: context.id,
    kind: "door" as const,
    x: rectangle.x,
    y: rectangle.y,
    width: rectangle.width,
    height: rectangle.height,
    wallId,
    openingHeight,
    status,
  };
  if (doorType === "hinged") {
    if (hingedPoints === undefined) {
      throw new Error("A schema-valid hinged door did not expose its required points.");
    }
    return Object.freeze({
      errors,
      value: Object.freeze({ ...base, doorType, ...hingedPoints }),
    });
  }

  return Object.freeze({ errors, value: Object.freeze({ ...base, doorType }) });
}

function validateHingedAttributes(
  context: ReturnType<typeof validateCommonSemanticElement>,
  doorType: ApartmentSvgDoorType | undefined,
): { readonly hinge: Point2D; readonly openLeaf: Point2D } | undefined {
  if (doorType === undefined) {
    return undefined;
  }

  if (doorType !== "hinged") {
    for (const attribute of HINGE_ATTRIBUTES) {
      if (readOptionalAttribute(context, attribute) !== undefined) {
        reportConditionalAttribute(
          context,
          attribute,
          'absence when data-door-type is "sliding" or "opening-only"',
          APARTMENT_SVG_VALIDATION_CODES.door.conditionalAttribute,
          "door",
          "door.hinged-attributes",
        );
      }
    }
    return undefined;
  }

  const hingeX = readRequiredHingedScalar(context, "data-hinge-x");
  const hingeY = readRequiredHingedScalar(context, "data-hinge-y");
  const openLeafX = readRequiredHingedScalar(context, "data-open-leaf-x");
  const openLeafY = readRequiredHingedScalar(context, "data-open-leaf-y");
  if (
    hingeX === undefined ||
    hingeY === undefined ||
    openLeafX === undefined ||
    openLeafY === undefined
  ) {
    return undefined;
  }

  return Object.freeze({
    hinge: Object.freeze({ x: hingeX, y: hingeY }),
    openLeaf: Object.freeze({ x: openLeafX, y: openLeafY }),
  });
}

function readRequiredHingedScalar(
  context: ReturnType<typeof validateCommonSemanticElement>,
  attribute: (typeof HINGE_ATTRIBUTES)[number],
): Decimal | undefined {
  if (readOptionalAttribute(context, attribute) === undefined) {
    reportConditionalAttribute(
      context,
      attribute,
      'a Number when data-door-type="hinged"',
      APARTMENT_SVG_VALIDATION_CODES.door.conditionalAttribute,
      "door",
      "door.hinged-attributes",
    );
    return undefined;
  }

  return readOptionalScalar(
    context,
    attribute,
    validateApartmentSvgNumber,
    APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
    "door",
    `door.${attribute}`,
  );
}
