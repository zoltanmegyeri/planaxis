import type { ParsedApartmentSvgDocument, ParsedXmlElement } from "@planaxis/parser";

import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_EXTENSION_PREFIXES,
  APARTMENT_SVG_GROUP_IDS,
  APARTMENT_SVG_REQUIRED_GROUP_IDS,
  SVG_NAMESPACE_URI,
} from "./schema-vocabulary.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";
import { getParsedAttribute } from "./xml-element.js";

const REQUIRED_GROUP_ID_SET = new Set<string>(APARTMENT_SVG_REQUIRED_GROUP_IDS);
const PERMITTED_ROOT_ELEMENT_NAMES = new Set(["style", "defs", "title", "desc"]);

export function validateApartmentSvgTopLevelStructure(
  document: ParsedApartmentSvgDocument,
): readonly ApartmentSvgValidationError[] {
  const errors: ApartmentSvgValidationError[] = [];

  for (const requiredGroupId of APARTMENT_SVG_REQUIRED_GROUP_IDS) {
    validateRequiredGroup(document, requiredGroupId, errors);
  }

  for (const element of document.rootElements) {
    validateRootElementPermission(element, errors);
  }

  return errors;
}

function validateRequiredGroup(
  document: ParsedApartmentSvgDocument,
  requiredGroupId: string,
  errors: ApartmentSvgValidationError[],
): void {
  const elementsWithId = document.rootElements.filter(
    (element) => getParsedAttribute(element, APARTMENT_SVG_ATTRIBUTES.id) === requiredGroupId,
  );
  const canonicalGroups = elementsWithId.filter((element) =>
    isSvgElement(element, APARTMENT_SVG_ELEMENT_NAMES.group),
  );
  const invalidForms = elementsWithId.filter(
    (element) => !isSvgElement(element, APARTMENT_SVG_ELEMENT_NAMES.group),
  );

  for (const invalidForm of invalidForms) {
    errors.push(
      groupError(
        APARTMENT_SVG_VALIDATION_CODES.group.invalidRequiredGroupForm,
        "group.required-form",
        `a direct SVG g element with id ${JSON.stringify(requiredGroupId)}`,
        `Required group ID ${requiredGroupId} is carried by an invalid root-level element form.`,
        {
          elementId: requiredGroupId,
          actual: invalidForm.name.qualifiedName,
        },
      ),
    );
  }

  if (canonicalGroups.length === 0) {
    if (invalidForms.length === 0) {
      errors.push(
        groupError(
          APARTMENT_SVG_VALIDATION_CODES.group.missingRequiredGroup,
          "group.required-multiplicity",
          `exactly one direct SVG g element with id ${JSON.stringify(requiredGroupId)}`,
          `Required top-level group ${requiredGroupId} is missing.`,
          { elementId: requiredGroupId },
        ),
      );
    }
    return;
  }

  if (canonicalGroups.length > 1) {
    errors.push(
      groupError(
        APARTMENT_SVG_VALIDATION_CODES.group.duplicateRequiredGroup,
        "group.required-multiplicity",
        `exactly one direct SVG g element with id ${JSON.stringify(requiredGroupId)}`,
        `Required top-level group ${requiredGroupId} occurs more than once.`,
        { elementId: requiredGroupId, actual: String(canonicalGroups.length) },
      ),
    );
    return;
  }

  const group = canonicalGroups[0];
  const transform =
    group === undefined ? undefined : getParsedAttribute(group, APARTMENT_SVG_ATTRIBUTES.transform);
  if (
    group !== undefined &&
    requiredGroupId !== APARTMENT_SVG_GROUP_IDS.annotations &&
    transform !== undefined
  ) {
    errors.push(
      groupError(
        APARTMENT_SVG_VALIDATION_CODES.group.prohibitedTransform,
        "group.core-transform",
        "no transform attribute on a required core semantic group container",
        `Transform is prohibited on core group ${requiredGroupId}.`,
        {
          elementId: requiredGroupId,
          attribute: APARTMENT_SVG_ATTRIBUTES.transform,
          actual: transform,
        },
      ),
    );
  }
}

function validateRootElementPermission(
  element: ParsedXmlElement,
  errors: ApartmentSvgValidationError[],
): void {
  if (element.name.localName === APARTMENT_SVG_ELEMENT_NAMES.metadata) {
    return;
  }

  if (
    element.name.localName !== null &&
    PERMITTED_ROOT_ELEMENT_NAMES.has(element.name.localName) &&
    element.name.namespaceUri === SVG_NAMESPACE_URI
  ) {
    return;
  }

  const elementId = getParsedAttribute(element, APARTMENT_SVG_ATTRIBUTES.id);
  if (isSvgElement(element, APARTMENT_SVG_ELEMENT_NAMES.group)) {
    if (elementId !== undefined && REQUIRED_GROUP_ID_SET.has(elementId)) {
      return;
    }

    if (elementId?.startsWith(APARTMENT_SVG_EXTENSION_PREFIXES.group) === true) {
      return;
    }

    errors.push(
      groupError(
        APARTMENT_SVG_VALIDATION_CODES.group.unknownGroup,
        "group.extension-form",
        "a required group ID or an extension group ID beginning with x-",
        "An unknown non-extension top-level group is not permitted.",
        elementId === undefined ? { actual: "missing id" } : { elementId, actual: elementId },
      ),
    );
    return;
  }

  if (elementId !== undefined && REQUIRED_GROUP_ID_SET.has(elementId)) {
    return;
  }

  errors.push(
    groupError(
      APARTMENT_SVG_VALIDATION_CODES.group.unknownRootElement,
      "group.permitted-root-element",
      "metadata, a required or extension g, style, defs, title, or desc",
      `Root-level element ${element.name.qualifiedName} is not permitted.`,
      {
        ...(elementId === undefined ? {} : { elementId }),
        actual: element.name.qualifiedName,
      },
    ),
  );
}

function isSvgElement(element: ParsedXmlElement, localName: string): boolean {
  return element.name.localName === localName && element.name.namespaceUri === SVG_NAMESPACE_URI;
}

interface GroupErrorContext {
  readonly elementId?: string;
  readonly attribute?: string;
  readonly actual?: string;
}

function groupError(
  code: ApartmentSvgValidationError["code"],
  rule: string,
  expected: string,
  message: string,
  context: GroupErrorContext = {},
): ApartmentSvgValidationError {
  return Object.freeze({
    code,
    category: "group",
    rule,
    expected,
    message,
    ...context,
  });
}
