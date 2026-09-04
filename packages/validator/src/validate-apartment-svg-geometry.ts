import type { GeometryValidApartmentSvgDocument } from "./geometry-valid-apartment-svg.js";
import type { ReferenceValidApartmentSvgDocument } from "./reference-valid-apartment-svg.js";
import { collectSemanticContainmentErrors } from "./semantic-containment-validation.js";
import { collectSpatialRestrictionErrors } from "./spatial-restriction-validation.js";
import { validateApartmentSvgWallAndOpeningGeometry } from "./validate-apartment-svg-wall-and-opening-geometry.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";
import { collectZoneGeometryErrors } from "./zone-geometry-validation.js";

export interface ApartmentSvgGeometryValidationSuccess {
  readonly valid: true;
  readonly errors: readonly [];
  readonly document: GeometryValidApartmentSvgDocument;
}

export interface ApartmentSvgGeometryValidationFailure {
  readonly valid: false;
  readonly errors: readonly ApartmentSvgValidationError[];
}

export type ApartmentSvgGeometryValidationResult =
  ApartmentSvgGeometryValidationSuccess | ApartmentSvgGeometryValidationFailure;

const EMPTY_VALIDATION_ERRORS: readonly [] = Object.freeze([]);

/**
 * Runs the complete Apartment SVG 2.1 geometric and topological validation
 * stage after reference validation.
 */
export function validateApartmentSvgGeometry(
  document: ReferenceValidApartmentSvgDocument,
): ApartmentSvgGeometryValidationResult {
  const wallAndOpeningResult = validateApartmentSvgWallAndOpeningGeometry(document);
  if (!wallAndOpeningResult.valid) return wallAndOpeningResult;

  const errors = [
    ...collectZoneGeometryErrors(document),
    ...collectSemanticContainmentErrors(document),
    ...collectSpatialRestrictionErrors(document),
  ];
  if (errors.length > 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  return Object.freeze({
    valid: true,
    errors: EMPTY_VALIDATION_ERRORS,
    document: document as GeometryValidApartmentSvgDocument,
  });
}
