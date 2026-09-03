import type { Decimal } from "@planaxis/geometry";

import { APARTMENT_SVG_ATTRIBUTES, APARTMENT_SVG_STATUS_VALUES } from "./schema-vocabulary.js";
import {
  readOptionalEnum,
  readRequiredEnum,
  readRequiredScalar,
} from "./semantic-element-validation.js";
import type { SemanticElementValidationContext } from "./semantic-element-validation.js";
import {
  validateApartmentSvgNonNegativeNumber,
  validateApartmentSvgNumber,
  validateApartmentSvgPositiveNumber,
} from "./scalar-validation.js";
import type { ApartmentSvgStatus } from "./schema-valid-apartment-svg.js";
import type {
  ApartmentSvgValidationCategory,
  ApartmentSvgValidationCode,
} from "./validation-codes.js";

const STATUS_VALUES = new Set<ApartmentSvgStatus>(Object.values(APARTMENT_SVG_STATUS_VALUES));

export interface ValidatedRectangleAttributes {
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
}

export interface ValidatedCircleAttributes {
  readonly cx: Decimal;
  readonly cy: Decimal;
  readonly radius: Decimal;
}

export function readRequiredRectangleAttributes(
  context: SemanticElementValidationContext,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
): Partial<ValidatedRectangleAttributes> {
  const x = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.x,
    validateApartmentSvgNumber,
    code,
    category,
    `${category}.x`,
  );
  const y = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.y,
    validateApartmentSvgNumber,
    code,
    category,
    `${category}.y`,
  );
  const width = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.width,
    validateApartmentSvgPositiveNumber,
    code,
    category,
    `${category}.width`,
  );
  const height = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.height,
    validateApartmentSvgPositiveNumber,
    code,
    category,
    `${category}.height`,
  );

  return {
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
  };
}

export function readRequiredCircleAttributes(
  context: SemanticElementValidationContext,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
): Partial<ValidatedCircleAttributes> {
  const cx = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.cx,
    validateApartmentSvgNumber,
    code,
    category,
    `${category}.cx`,
  );
  const cy = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.cy,
    validateApartmentSvgNumber,
    code,
    category,
    `${category}.cy`,
  );
  const radius = readRequiredScalar(
    context,
    APARTMENT_SVG_ATTRIBUTES.radius,
    validateApartmentSvgPositiveNumber,
    code,
    category,
    `${category}.r`,
  );

  return {
    ...(cx === undefined ? {} : { cx }),
    ...(cy === undefined ? {} : { cy }),
    ...(radius === undefined ? {} : { radius }),
  };
}

export function readRequiredStatus(
  context: SemanticElementValidationContext,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
): ApartmentSvgStatus | undefined {
  return readRequiredEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataStatus,
    STATUS_VALUES,
    code,
    category,
    `${category}.data-status`,
  );
}

export function readOptionalStatus(
  context: SemanticElementValidationContext,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
): ApartmentSvgStatus | undefined {
  return readOptionalEnum(
    context,
    APARTMENT_SVG_ATTRIBUTES.dataStatus,
    STATUS_VALUES,
    code,
    category,
    `${category}.data-status`,
  );
}

export function readRequiredNonNegativeZ(
  context: SemanticElementValidationContext,
  attribute: typeof APARTMENT_SVG_ATTRIBUTES.dataBaseZ | typeof APARTMENT_SVG_ATTRIBUTES.dataZ,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
): Decimal | undefined {
  return readRequiredScalar(
    context,
    attribute,
    validateApartmentSvgNonNegativeNumber,
    code,
    category,
    `${category}.${attribute}`,
  );
}
