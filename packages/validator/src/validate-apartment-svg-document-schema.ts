import type { ParsedApartmentSvgDocument } from "@planaxis/parser";

import { validateApartmentSvgTopLevelStructure } from "./group-validation.js";
import { validateApartmentSvgMetadata } from "./metadata-validation.js";
import { validateApartmentSvgRoot } from "./root-validation.js";
import {
  createApartmentSvgValidationResult,
  type ApartmentSvgValidationResult,
} from "./validation-result.js";
import { getParsedAttribute } from "./xml-element.js";

export function validateApartmentSvgDocumentSchema(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgValidationResult {
  const rootErrors = validateApartmentSvgRoot(document);
  const rootDataUnit = getParsedAttribute(document.rootElement, "data-unit");
  const metadataErrors = validateApartmentSvgMetadata(document, rootDataUnit);
  const groupErrors = validateApartmentSvgTopLevelStructure(document);

  return createApartmentSvgValidationResult([...rootErrors, ...metadataErrors, ...groupErrors]);
}
