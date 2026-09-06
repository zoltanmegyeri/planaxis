import { createDecimal } from "@planaxis/geometry";
import type { Point2D } from "@planaxis/geometry";

import { APARTMENT_SVG_ATTRIBUTES } from "./schema-vocabulary.js";
import { elementError, readRequiredNonEmptyString } from "./semantic-element-validation.js";
import type { SemanticElementValidationContext } from "./semantic-element-validation.js";
import { isApartmentSvgNumberLexeme } from "./scalar-validation.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";

const COORDINATE_SEPARATOR = "(?:\\s*,\\s*|\\s+)";
const NUMBER_SOURCE = "-?[0-9]+(?:\\.[0-9]+)?";
const COORDINATE_LIST_PATTERN = new RegExp(
  `^${NUMBER_SOURCE}${COORDINATE_SEPARATOR}${NUMBER_SOURCE}(?:${COORDINATE_SEPARATOR}${NUMBER_SOURCE}${COORDINATE_SEPARATOR}${NUMBER_SOURCE})*$`,
  "u",
);

export function readPolygonPoints(
  context: SemanticElementValidationContext,
  category: "zone" | "footprint",
): readonly Point2D[] | undefined {
  const value = readRequiredNonEmptyString(
    context,
    APARTMENT_SVG_ATTRIBUTES.points,
    APARTMENT_SVG_VALIDATION_CODES[category].malformedPoints,
    category,
    `${category}.points-syntax`,
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
        APARTMENT_SVG_VALIDATION_CODES[category].invalidPointNumber,
        category,
        `${category}.points-number-lexemes`,
        "coordinate components matching -?[0-9]+(\\.[0-9]+)?",
        "A polygon points coordinate is not an Apartment SVG Number.",
        context,
        { attribute: APARTMENT_SVG_ATTRIBUTES.points, actual: invalidComponent },
      ),
    );
    return undefined;
  }

  if (!COORDINATE_LIST_PATTERN.test(trimmed)) {
    context.errors.push(
      elementError(
        APARTMENT_SVG_VALIDATION_CODES[category].malformedPoints,
        category,
        `${category}.points-syntax`,
        "one or more SVG coordinate pairs using Apartment SVG Number components",
        "The polygon points attribute is not a syntactically valid coordinate list.",
        context,
        { attribute: APARTMENT_SVG_ATTRIBUTES.points, actual: value },
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
