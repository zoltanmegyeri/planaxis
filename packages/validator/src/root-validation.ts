import { createDecimal } from "@planaxis/geometry";
import type { ParsedApartmentSvgDocument } from "@planaxis/parser";

import type { SchemaValidApartmentSvgViewBox } from "./schema-valid-apartment-svg.js";
import { isApartmentSvgNumberLexeme } from "./scalar-validation.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";
import { getParsedAttribute } from "./xml-element.js";

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
const ZERO = createDecimal("0");

const REQUIRED_ROOT_ATTRIBUTE_VALUES = Object.freeze({
  "data-schema": "apartment-svg",
  "data-schema-version": "2.1",
  "data-unit": "cm",
});

export function validateApartmentSvgRoot(
  document: ParsedApartmentSvgDocument,
): readonly ApartmentSvgValidationError[] {
  return validateApartmentSvgRootWithValues(document).errors;
}

export interface ApartmentSvgRootValidationWithValues {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly viewBox?: SchemaValidApartmentSvgViewBox;
}

export function validateApartmentSvgRootWithValues(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgRootValidationWithValues {
  const errors: ApartmentSvgValidationError[] = [];
  const root = document.rootElement;

  if (
    root.name.qualifiedName !== "svg" ||
    root.name.localName !== "svg" ||
    root.name.prefix !== null
  ) {
    errors.push(
      rootError(
        APARTMENT_SVG_VALIDATION_CODES.root.invalidElementForm,
        "root.element-form",
        "an unprefixed root element named svg",
        "The Apartment SVG root element must use the canonical unprefixed svg form.",
        { actual: root.name.qualifiedName },
      ),
    );
  }

  const defaultNamespace = root.namespaceDeclarations.find(
    (declaration) => declaration.prefix === null,
  );
  if (
    root.name.namespaceUri !== SVG_NAMESPACE_URI ||
    defaultNamespace?.qualifiedName !== "xmlns" ||
    defaultNamespace.namespaceUri !== SVG_NAMESPACE_URI
  ) {
    errors.push(
      rootError(
        APARTMENT_SVG_VALIDATION_CODES.root.invalidNamespace,
        "root.svg-namespace",
        `an explicit default xmlns declaration equal to ${SVG_NAMESPACE_URI}`,
        "The Apartment SVG root must declare and use the required SVG default namespace.",
        {
          attribute: "xmlns",
          actual: defaultNamespace?.namespaceUri ?? root.name.namespaceUri ?? "missing",
        },
      ),
    );
  }

  validateRequiredRootConstants(document, errors);
  const viewBox = validateViewBox(document, errors);
  return Object.freeze({
    errors: Object.freeze(errors),
    ...(viewBox === undefined ? {} : { viewBox }),
  });
}

function validateRequiredRootConstants(
  document: ParsedApartmentSvgDocument,
  errors: ApartmentSvgValidationError[],
): void {
  for (const [attribute, expectedValue] of Object.entries(REQUIRED_ROOT_ATTRIBUTE_VALUES)) {
    const actualValue = getParsedAttribute(document.rootElement, attribute);
    if (actualValue === undefined) {
      errors.push(missingRootAttribute(attribute, JSON.stringify(expectedValue)));
      continue;
    }

    if (actualValue !== expectedValue) {
      errors.push(
        rootError(
          APARTMENT_SVG_VALIDATION_CODES.root.invalidAttributeValue,
          "root.attribute-value",
          `exactly ${JSON.stringify(expectedValue)}`,
          `Root attribute ${attribute} has an invalid value.`,
          { attribute, actual: actualValue },
        ),
      );
    }
  }
}

function validateViewBox(
  document: ParsedApartmentSvgDocument,
  errors: ApartmentSvgValidationError[],
): SchemaValidApartmentSvgViewBox | undefined {
  const viewBox = getParsedAttribute(document.rootElement, "viewBox");
  if (viewBox === undefined) {
    errors.push(missingRootAttribute("viewBox", "exactly four Apartment SVG Number values"));
    return undefined;
  }

  const values = viewBox.trim() === "" ? [] : viewBox.trim().split(/\s+/u);
  if (values.length !== 4) {
    errors.push(
      rootError(
        APARTMENT_SVG_VALIDATION_CODES.root.invalidViewBox,
        "root.viewBox-arity",
        "exactly four whitespace-separated Apartment SVG Number values",
        "The root viewBox must contain exactly four Apartment SVG numbers.",
        { attribute: "viewBox", actual: viewBox },
      ),
    );
    return undefined;
  }

  if (!values.every(isApartmentSvgNumberLexeme)) {
    errors.push(
      rootError(
        APARTMENT_SVG_VALIDATION_CODES.root.invalidViewBox,
        "root.viewBox-number-lexemes",
        "four values matching -?[0-9]+(\\.[0-9]+)?",
        "The root viewBox contains a value that is not an Apartment SVG Number.",
        { attribute: "viewBox", actual: viewBox },
      ),
    );
    return undefined;
  }

  const widthLexeme = values[2];
  const heightLexeme = values[3];
  if (widthLexeme === undefined || heightLexeme === undefined) {
    throw new Error("A four-value viewBox did not expose width and height values.");
  }

  const decimalValues = values.map((value) => createDecimal(value));
  const width = decimalValues[2];
  const height = decimalValues[3];
  if (width === undefined || height === undefined) {
    throw new Error("Exact viewBox construction did not expose width and height values.");
  }

  if (width.lessThanOrEqualTo(ZERO)) {
    errors.push(
      rootError(
        APARTMENT_SVG_VALIDATION_CODES.root.invalidViewBoxExtent,
        "root.viewBox-width",
        "viewBox width > 0",
        "The root viewBox width must be positive.",
        { attribute: "viewBox", actual: widthLexeme },
      ),
    );
  }

  if (height.lessThanOrEqualTo(ZERO)) {
    errors.push(
      rootError(
        APARTMENT_SVG_VALIDATION_CODES.root.invalidViewBoxExtent,
        "root.viewBox-height",
        "viewBox height > 0",
        "The root viewBox height must be positive.",
        { attribute: "viewBox", actual: heightLexeme },
      ),
    );
  }

  if (width.lessThanOrEqualTo(ZERO) || height.lessThanOrEqualTo(ZERO)) {
    return undefined;
  }

  const minX = decimalValues[0];
  const minY = decimalValues[1];
  if (minX === undefined || minY === undefined) {
    throw new Error("Exact viewBox construction did not expose minimum coordinate values.");
  }

  return Object.freeze({ minX, minY, width, height });
}

function missingRootAttribute(attribute: string, expected: string): ApartmentSvgValidationError {
  return rootError(
    APARTMENT_SVG_VALIDATION_CODES.root.missingAttribute,
    "root.required-attribute",
    expected,
    `Required root attribute ${attribute} is missing.`,
    { attribute },
  );
}

interface RootErrorContext {
  readonly attribute?: string;
  readonly actual?: string;
}

function rootError(
  code: ApartmentSvgValidationError["code"],
  rule: string,
  expected: string,
  message: string,
  context: RootErrorContext = {},
): ApartmentSvgValidationError {
  return Object.freeze({
    code,
    category: "root",
    rule,
    expected,
    message,
    ...context,
  });
}
