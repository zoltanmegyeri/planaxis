import type { ParsedApartmentSvgDocument, ParsedXmlElement } from "@planaxis/parser";

import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_EXTENSION_PREFIXES,
  APARTMENT_SVG_REQUIRED_GROUP_IDS,
  SVG_NAMESPACE_URI,
} from "./schema-vocabulary.js";
import type { ApartmentSvgCoreGroupId } from "./schema-vocabulary.js";
import type { ScalarValidationResult } from "./scalar-validation.js";
import { validateApartmentSvgId } from "./scalar-validation.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type {
  ApartmentSvgValidationCategory,
  ApartmentSvgValidationCode,
} from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";
import { getParsedAttribute } from "./xml-element.js";

const XMLNS_NAMESPACE_URI = "http://www.w3.org/2000/xmlns/";
const REQUIRED_GROUP_IDS = new Set<string>(APARTMENT_SVG_REQUIRED_GROUP_IDS);
const PRESENTATION_ATTRIBUTES = new Set([
  "alignment-baseline",
  "baseline-shift",
  "class",
  "clip",
  "clip-path",
  "clip-rule",
  "color",
  "color-interpolation",
  "color-interpolation-filters",
  "color-profile",
  "color-rendering",
  "cursor",
  "direction",
  "display",
  "dominant-baseline",
  "enable-background",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "flood-color",
  "flood-opacity",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "glyph-orientation-horizontal",
  "glyph-orientation-vertical",
  "image-rendering",
  "isolation",
  "kerning",
  "letter-spacing",
  "lighting-color",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "mix-blend-mode",
  "opacity",
  "overflow",
  "paint-order",
  "pointer-events",
  "shape-rendering",
  "solid-color",
  "solid-opacity",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "style",
  "text-anchor",
  "text-decoration",
  "text-rendering",
  "unicode-bidi",
  "vector-effect",
  "visibility",
  "viewport-fill",
  "viewport-fill-opacity",
  "word-spacing",
  "writing-mode",
]);
const REDUNDANT_GEOMETRY_ATTRIBUTES = new Set<string>([
  APARTMENT_SVG_ATTRIBUTES.dataLength,
  APARTMENT_SVG_ATTRIBUTES.dataWidth,
  APARTMENT_SVG_ATTRIBUTES.dataDepth,
  APARTMENT_SVG_ATTRIBUTES.dataOpeningWidth,
  APARTMENT_SVG_ATTRIBUTES.dataWallThickness,
  APARTMENT_SVG_ATTRIBUTES.dataCenterX,
  APARTMENT_SVG_ATTRIBUTES.dataCenterY,
]);
const SEMANTIC_SHAPE_NAMES = new Set<string>([
  APARTMENT_SVG_ELEMENT_NAMES.polygon,
  APARTMENT_SVG_ELEMENT_NAMES.rectangle,
  APARTMENT_SVG_ELEMENT_NAMES.circle,
]);

export interface SemanticIdRegistry {
  readonly reservedIds: ReadonlySet<string>;
  readonly semanticIds: Set<string>;
}

export interface SemanticElementRules {
  readonly groupId: ApartmentSvgCoreGroupId;
  readonly elementName:
    | typeof APARTMENT_SVG_ELEMENT_NAMES.polygon
    | typeof APARTMENT_SVG_ELEMENT_NAMES.rectangle
    | typeof APARTMENT_SVG_ELEMENT_NAMES.circle;
  readonly allowedAttributes: ReadonlySet<string>;
  readonly allowedKinds: ReadonlySet<string>;
  readonly invalidValueCode: ApartmentSvgValidationCode;
  readonly category: ApartmentSvgValidationCategory;
}

export interface SemanticElementValidationContext {
  readonly element: ParsedXmlElement;
  readonly errors: ApartmentSvgValidationError[];
  readonly id?: string;
  readonly kind?: string;
}

export function createSemanticIdRegistry(document: ParsedApartmentSvgDocument): SemanticIdRegistry {
  const reservedIds = new Set<string>();
  for (const element of document.rootElements) {
    const id = getParsedAttribute(element, APARTMENT_SVG_ATTRIBUTES.id);
    if (
      element.name.localName === APARTMENT_SVG_ELEMENT_NAMES.group &&
      element.name.namespaceUri === SVG_NAMESPACE_URI &&
      id !== undefined &&
      (REQUIRED_GROUP_IDS.has(id) || id.startsWith(APARTMENT_SVG_EXTENSION_PREFIXES.group))
    ) {
      reservedIds.add(id);
    }
  }

  return { reservedIds, semanticIds: new Set<string>() };
}

export function validateCommonSemanticElement(
  element: ParsedXmlElement,
  rules: SemanticElementRules,
  idRegistry: SemanticIdRegistry,
): SemanticElementValidationContext {
  const errors: ApartmentSvgValidationError[] = [];
  const rawId = getParsedAttribute(element, APARTMENT_SVG_ATTRIBUTES.id);
  const errorElementId = rawId === undefined ? undefined : rawId;

  if (element.name.localName !== rules.elementName) {
    errors.push(
      semanticError(
        APARTMENT_SVG_VALIDATION_CODES.semantic.invalidElementType,
        "semantic.element-type",
        `a direct SVG ${rules.elementName} child of the ${rules.groupId} group`,
        `The ${rules.groupId} group contains a semantic element with an invalid SVG element type.`,
        {
          ...(errorElementId === undefined ? {} : { elementId: errorElementId }),
          actual: element.name.qualifiedName,
        },
      ),
    );
  }

  if (element.name.namespaceUri !== SVG_NAMESPACE_URI) {
    errors.push(
      semanticError(
        APARTMENT_SVG_VALIDATION_CODES.semantic.invalidNamespace,
        "semantic.svg-namespace",
        SVG_NAMESPACE_URI,
        "A core semantic element must use the SVG namespace.",
        {
          ...(errorElementId === undefined ? {} : { elementId: errorElementId }),
          actual: element.name.namespaceUri ?? "missing",
        },
      ),
    );
  }

  const id = validateSemanticId(rawId, idRegistry, errors);
  const kind = validateDataKind(element, rules, errorElementId, errors);
  validateSemanticAttributes(element, rules.allowedAttributes, errorElementId, errors);
  validateNestedSemanticElements(element, errorElementId, errors);

  return {
    element,
    errors,
    ...(id === undefined ? {} : { id }),
    ...(kind === undefined ? {} : { kind }),
  };
}

export function readRequiredAttribute(
  context: SemanticElementValidationContext,
  attribute: string,
): string | undefined {
  const value = getParsedAttribute(context.element, attribute);
  if (value === undefined) {
    context.errors.push(
      elementError(
        APARTMENT_SVG_VALIDATION_CODES.semantic.missingAttribute,
        "semantic",
        "semantic.required-attribute",
        `a ${attribute} attribute permitted by the element schema`,
        `Required semantic attribute ${attribute} is missing.`,
        context,
        { attribute },
      ),
    );
  }

  return value;
}

export function readOptionalAttribute(
  context: SemanticElementValidationContext,
  attribute: string,
): string | undefined {
  return getParsedAttribute(context.element, attribute);
}

export function readRequiredNonEmptyString(
  context: SemanticElementValidationContext,
  attribute: string,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): string | undefined {
  const value = readRequiredAttribute(context, attribute);
  if (value === undefined) {
    return undefined;
  }

  if (value.length === 0) {
    context.errors.push(
      elementError(
        code,
        category,
        rule,
        "a non-empty string",
        `Semantic attribute ${attribute} must not be empty.`,
        context,
        { attribute, actual: value },
      ),
    );
    return undefined;
  }

  return value;
}

export function readRequiredRef(
  context: SemanticElementValidationContext,
  attribute: string,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): string | undefined {
  return readRequiredNonEmptyString(context, attribute, code, category, rule);
}

export function readOptionalRef(
  context: SemanticElementValidationContext,
  attribute: string,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): string | undefined {
  const value = readOptionalAttribute(context, attribute);
  if (value === undefined) {
    return undefined;
  }

  if (value.length === 0) {
    context.errors.push(
      elementError(
        code,
        category,
        rule,
        "a non-empty unresolved reference ID",
        `Optional reference attribute ${attribute} must not be empty when present.`,
        context,
        { attribute, actual: value },
      ),
    );
    return undefined;
  }

  return value;
}

export function readRequiredEnum<T extends string>(
  context: SemanticElementValidationContext,
  attribute: string,
  permittedValues: ReadonlySet<T>,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): T | undefined {
  const value = readRequiredAttribute(context, attribute);
  return value === undefined
    ? undefined
    : validateEnumValue(context, attribute, value, permittedValues, code, category, rule);
}

export function readOptionalEnum<T extends string>(
  context: SemanticElementValidationContext,
  attribute: string,
  permittedValues: ReadonlySet<T>,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): T | undefined {
  const value = readOptionalAttribute(context, attribute);
  return value === undefined
    ? undefined
    : validateEnumValue(context, attribute, value, permittedValues, code, category, rule);
}

export function readRequiredScalar<T>(
  context: SemanticElementValidationContext,
  attribute: string,
  validateScalar: (value: string) => ScalarValidationResult<T>,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): T | undefined {
  const value = readRequiredAttribute(context, attribute);
  return value === undefined
    ? undefined
    : validateScalarValue(context, attribute, value, validateScalar, code, category, rule);
}

export function readOptionalScalar<T>(
  context: SemanticElementValidationContext,
  attribute: string,
  validateScalar: (value: string) => ScalarValidationResult<T>,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): T | undefined {
  const value = readOptionalAttribute(context, attribute);
  return value === undefined
    ? undefined
    : validateScalarValue(context, attribute, value, validateScalar, code, category, rule);
}

export function reportConditionalAttribute(
  context: SemanticElementValidationContext,
  attribute: string,
  expected: string,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): void {
  const actual = getParsedAttribute(context.element, attribute);
  context.errors.push(
    elementError(
      code,
      category,
      rule,
      expected,
      `Semantic attribute ${attribute} violates a conditional presence rule.`,
      context,
      {
        attribute,
        ...(actual === undefined ? {} : { actual }),
      },
    ),
  );
}

export function elementError(
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
  expected: string,
  message: string,
  context: Pick<SemanticElementValidationContext, "id">,
  extra: { readonly attribute?: string; readonly actual?: string } = {},
): ApartmentSvgValidationError {
  return Object.freeze({
    code,
    category,
    rule,
    expected,
    message,
    ...(context.id === undefined ? {} : { elementId: context.id }),
    ...extra,
  });
}

function validateSemanticId(
  rawId: string | undefined,
  registry: SemanticIdRegistry,
  errors: ApartmentSvgValidationError[],
): string | undefined {
  if (rawId === undefined) {
    errors.push(
      idError(
        APARTMENT_SVG_VALIDATION_CODES.id.missing,
        "id.required",
        "a required Apartment SVG Id",
        "A core semantic element is missing its required id attribute.",
        { attribute: APARTMENT_SVG_ATTRIBUTES.id },
      ),
    );
    return undefined;
  }

  const idResult = validateApartmentSvgId(rawId);
  if (!idResult.valid) {
    errors.push(
      idError(
        APARTMENT_SVG_VALIDATION_CODES.id.invalid,
        "id.lexical-form",
        idResult.expected,
        "A core semantic element has an invalid id attribute.",
        { elementId: rawId, attribute: APARTMENT_SVG_ATTRIBUTES.id, actual: rawId },
      ),
    );
    return undefined;
  }

  if (registry.reservedIds.has(rawId) || registry.semanticIds.has(rawId)) {
    errors.push(
      idError(
        APARTMENT_SVG_VALIDATION_CODES.id.duplicate,
        "id.document-uniqueness",
        "an ID unique among core semantic elements and required or extension root groups",
        "A core semantic element ID is already used in the core document structure.",
        { elementId: rawId, attribute: APARTMENT_SVG_ATTRIBUTES.id, actual: rawId },
      ),
    );
    return undefined;
  }

  registry.semanticIds.add(rawId);
  return idResult.value;
}

function validateDataKind(
  element: ParsedXmlElement,
  rules: SemanticElementRules,
  elementId: string | undefined,
  errors: ApartmentSvgValidationError[],
): string | undefined {
  const value = getParsedAttribute(element, APARTMENT_SVG_ATTRIBUTES.dataKind);
  if (value === undefined) {
    errors.push(
      semanticError(
        APARTMENT_SVG_VALIDATION_CODES.semantic.missingAttribute,
        "semantic.required-attribute",
        "a data-kind value permitted for the corresponding core group",
        "A core semantic element is missing its required data-kind attribute.",
        {
          ...(elementId === undefined ? {} : { elementId }),
          attribute: APARTMENT_SVG_ATTRIBUTES.dataKind,
        },
      ),
    );
    return undefined;
  }

  if (!rules.allowedKinds.has(value)) {
    errors.push(
      Object.freeze({
        code: rules.invalidValueCode,
        category: rules.category,
        rule: `${rules.category}.data-kind`,
        expected: [...rules.allowedKinds].map((kind) => JSON.stringify(kind)).join(" | "),
        message: "The semantic element data-kind is not permitted in its corresponding group.",
        ...(elementId === undefined ? {} : { elementId }),
        attribute: APARTMENT_SVG_ATTRIBUTES.dataKind,
        actual: value,
      }),
    );
    return undefined;
  }

  return value;
}

function validateSemanticAttributes(
  element: ParsedXmlElement,
  allowedAttributes: ReadonlySet<string>,
  elementId: string | undefined,
  errors: ApartmentSvgValidationError[],
): void {
  for (const attribute of element.attributes) {
    const name = attribute.name.qualifiedName;
    if (
      attribute.name.namespaceUri === XMLNS_NAMESPACE_URI ||
      name === APARTMENT_SVG_ATTRIBUTES.id ||
      allowedAttributes.has(name) ||
      PRESENTATION_ATTRIBUTES.has(name) ||
      name.startsWith(APARTMENT_SVG_EXTENSION_PREFIXES.attribute)
    ) {
      continue;
    }

    if (name === APARTMENT_SVG_ATTRIBUTES.transform) {
      errors.push(
        semanticError(
          APARTMENT_SVG_VALIDATION_CODES.semantic.prohibitedAttribute,
          "semantic.transform",
          "no transform attribute on a core semantic element",
          "Transform is prohibited on core semantic elements.",
          {
            ...(elementId === undefined ? {} : { elementId }),
            attribute: name,
            actual: attribute.value,
          },
        ),
      );
      continue;
    }

    if (REDUNDANT_GEOMETRY_ATTRIBUTES.has(name)) {
      errors.push(
        semanticError(
          APARTMENT_SVG_VALIDATION_CODES.semantic.prohibitedAttribute,
          "semantic.redundant-geometry-attribute",
          "no redundant geometric attribute",
          "A redundant geometric attribute is prohibited on core semantic elements.",
          {
            ...(elementId === undefined ? {} : { elementId }),
            attribute: name,
            actual: attribute.value,
          },
        ),
      );
      continue;
    }

    errors.push(
      semanticError(
        APARTMENT_SVG_VALIDATION_CODES.semantic.unknownAttribute,
        name.startsWith(APARTMENT_SVG_EXTENSION_PREFIXES.dataAttribute)
          ? "semantic.extension-attribute"
          : "semantic.permitted-svg-attribute",
        name.startsWith(APARTMENT_SVG_EXTENSION_PREFIXES.dataAttribute)
          ? "a defined core data attribute or an extension attribute beginning with data-x-"
          : "a schema-defined geometric attribute or a permitted SVG presentation attribute",
        `Attribute ${name} is not permitted on this core semantic element.`,
        {
          ...(elementId === undefined ? {} : { elementId }),
          attribute: name,
          actual: attribute.value,
        },
      ),
    );
  }
}

function validateNestedSemanticElements(
  element: ParsedXmlElement,
  elementId: string | undefined,
  errors: ApartmentSvgValidationError[],
): void {
  const nested = findNestedSemanticElement(element);
  if (nested === undefined) {
    return;
  }

  errors.push(
    semanticError(
      APARTMENT_SVG_VALIDATION_CODES.semantic.nestedSemanticElement,
      "semantic.no-nesting",
      "no semantic element nested within another semantic element",
      "Nesting semantic elements is prohibited.",
      {
        ...(elementId === undefined ? {} : { elementId }),
        actual: nested.name.qualifiedName,
      },
    ),
  );
}

function findNestedSemanticElement(element: ParsedXmlElement): ParsedXmlElement | undefined {
  for (const child of element.children) {
    if (child.kind !== "element") {
      continue;
    }

    if (
      getParsedAttribute(child, APARTMENT_SVG_ATTRIBUTES.dataKind) !== undefined ||
      (getParsedAttribute(child, APARTMENT_SVG_ATTRIBUTES.id) !== undefined &&
        child.name.localName !== null &&
        SEMANTIC_SHAPE_NAMES.has(child.name.localName))
    ) {
      return child;
    }

    const nested = findNestedSemanticElement(child);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function validateEnumValue<T extends string>(
  context: SemanticElementValidationContext,
  attribute: string,
  value: string,
  permittedValues: ReadonlySet<T>,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): T | undefined {
  const matchedValue = [...permittedValues].find((permitted) => permitted === value);
  if (matchedValue !== undefined) {
    return matchedValue;
  }

  context.errors.push(
    elementError(
      code,
      category,
      rule,
      [...permittedValues].map((permitted) => JSON.stringify(permitted)).join(" | "),
      `Semantic attribute ${attribute} has an invalid enum value.`,
      context,
      { attribute, actual: value },
    ),
  );
  return undefined;
}

function validateScalarValue<T>(
  context: SemanticElementValidationContext,
  attribute: string,
  value: string,
  validateScalar: (value: string) => ScalarValidationResult<T>,
  code: ApartmentSvgValidationCode,
  category: ApartmentSvgValidationCategory,
  rule: string,
): T | undefined {
  const result = validateScalar(value);
  if (result.valid) {
    return result.value;
  }

  context.errors.push(
    elementError(
      code,
      category,
      rule,
      result.expected,
      `Semantic attribute ${attribute} has an invalid scalar value.`,
      context,
      { attribute, actual: value },
    ),
  );
  return undefined;
}

interface SemanticErrorContext {
  readonly elementId?: string;
  readonly attribute?: string;
  readonly actual?: string;
}

function semanticError(
  code: ApartmentSvgValidationCode,
  rule: string,
  expected: string,
  message: string,
  context: SemanticErrorContext = {},
): ApartmentSvgValidationError {
  return Object.freeze({ code, category: "semantic", rule, expected, message, ...context });
}

function idError(
  code: ApartmentSvgValidationCode,
  rule: string,
  expected: string,
  message: string,
  context: SemanticErrorContext = {},
): ApartmentSvgValidationError {
  return Object.freeze({ code, category: "id", rule, expected, message, ...context });
}
