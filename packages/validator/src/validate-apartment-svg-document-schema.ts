import type { ParsedApartmentSvgDocument } from "@planaxis/parser";

import { validateApartmentSvgTopLevelStructure } from "./group-validation.js";
import { validateApartmentSvgMetadataWithValues } from "./metadata-validation.js";
import { validateApartmentSvgRootWithValues } from "./root-validation.js";
import type {
  SchemaValidApartmentSvgMetadata,
  SchemaValidApartmentSvgViewBox,
} from "./schema-valid-apartment-svg.js";
import {
  createApartmentSvgValidationResult,
  type ApartmentSvgValidationError,
  type ApartmentSvgValidationResult,
} from "./validation-result.js";
import { getParsedAttribute } from "./xml-element.js";

export function validateApartmentSvgDocumentSchema(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgValidationResult {
  return createApartmentSvgValidationResult(
    validateApartmentSvgDocumentSchemaWithValues(document).errors,
  );
}

export interface ApartmentSvgDocumentSchemaValidationWithValues {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly viewBox?: SchemaValidApartmentSvgViewBox;
  readonly metadata?: SchemaValidApartmentSvgMetadata;
}

export function validateApartmentSvgDocumentSchemaWithValues(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgDocumentSchemaValidationWithValues {
  const rootResult = validateApartmentSvgRootWithValues(document);
  const rootDataUnit = getParsedAttribute(document.rootElement, "data-unit");
  const metadataResult = validateApartmentSvgMetadataWithValues(document, rootDataUnit);
  const groupErrors = validateApartmentSvgTopLevelStructure(document);
  const errors = Object.freeze([...rootResult.errors, ...metadataResult.errors, ...groupErrors]);

  return Object.freeze({
    errors,
    ...(rootResult.viewBox === undefined ? {} : { viewBox: rootResult.viewBox }),
    ...(metadataResult.metadata === undefined ? {} : { metadata: metadataResult.metadata }),
  });
}
