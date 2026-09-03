import type { ParsedApartmentSvgDocument } from "@planaxis/parser";

import { APARTMENT_SVG_DOCUMENT_VALUES } from "./schema-vocabulary.js";
import { validateApartmentSvgSemanticSchemas } from "./semantic-schema-validation.js";
import type {
  SchemaValidApartmentSvgDocument,
  SchemaValidSemanticElement,
} from "./schema-valid-apartment-svg.js";
import { validateApartmentSvgDocumentSchemaWithValues } from "./validate-apartment-svg-document-schema.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

export interface ApartmentSvgSchemaValidationSuccess {
  readonly valid: true;
  readonly errors: readonly [];
  readonly document: SchemaValidApartmentSvgDocument;
}

export interface ApartmentSvgSchemaValidationFailure {
  readonly valid: false;
  readonly errors: readonly ApartmentSvgValidationError[];
}

export type ApartmentSvgSchemaValidationResult =
  ApartmentSvgSchemaValidationSuccess | ApartmentSvgSchemaValidationFailure;

const EMPTY_VALIDATION_ERRORS: readonly [] = Object.freeze([]);

/**
 * Validates complete Apartment SVG 2.1 schema conformance. Successful output
 * retains unresolved reference IDs and does not imply referential, geometric,
 * or topological conformance.
 */
export function validateApartmentSvgSchema(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgSchemaValidationResult {
  const documentResult = validateApartmentSvgDocumentSchemaWithValues(document);
  const semanticResult = validateApartmentSvgSemanticSchemas(document);
  const errors = [...documentResult.errors, ...semanticResult.errors];
  if (errors.length > 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  if (documentResult.viewBox === undefined || documentResult.metadata === undefined) {
    throw new Error("Successful document schema validation did not retain its typed values.");
  }

  const semanticElements: readonly SchemaValidSemanticElement[] = [
    ...semanticResult.spaces,
    ...semanticResult.walls,
    ...semanticResult.windows,
    ...semanticResult.doors,
    ...semanticResult.fixedElements,
    ...semanticResult.utilities,
    ...semanticResult.cameras,
  ];
  const semanticElementsById = new Map(
    semanticElements.map((element): readonly [string, SchemaValidSemanticElement] => [
      element.id,
      element,
    ]),
  );
  if (semanticElementsById.size !== semanticElements.length) {
    throw new Error("Successful semantic schema validation produced a duplicate ID.");
  }

  const schemaValidDocument: SchemaValidApartmentSvgDocument = Object.freeze({
    schema: APARTMENT_SVG_DOCUMENT_VALUES.schema,
    schemaVersion: APARTMENT_SVG_DOCUMENT_VALUES.schemaVersion,
    unit: APARTMENT_SVG_DOCUMENT_VALUES.unit,
    viewBox: documentResult.viewBox,
    metadata: documentResult.metadata,
    spaces: semanticResult.spaces,
    walls: semanticResult.walls,
    windows: semanticResult.windows,
    doors: semanticResult.doors,
    fixedElements: semanticResult.fixedElements,
    utilities: semanticResult.utilities,
    cameras: semanticResult.cameras,
    semanticElementsById,
  });

  return Object.freeze({
    valid: true,
    errors: EMPTY_VALIDATION_ERRORS,
    document: schemaValidDocument,
  });
}
