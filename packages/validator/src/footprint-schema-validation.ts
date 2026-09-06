import type { ParsedXmlElement } from "@planaxis/parser";

import { readPolygonPoints } from "./polygon-points-validation.js";
import {
  APARTMENT_SVG_ATTRIBUTES,
  APARTMENT_SVG_ELEMENT_NAMES,
  APARTMENT_SVG_GROUP_IDS,
  APARTMENT_SVG_SEMANTIC_KINDS,
} from "./schema-vocabulary.js";
import { validateCommonSemanticElement } from "./semantic-element-validation.js";
import type { SemanticIdRegistry } from "./semantic-element-validation.js";
import type { SchemaValidFootprint } from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const ALLOWED_ATTRIBUTES = new Set([
  APARTMENT_SVG_ATTRIBUTES.points,
  APARTMENT_SVG_ATTRIBUTES.dataKind,
]);
const ALLOWED_KINDS = new Set([APARTMENT_SVG_SEMANTIC_KINDS.footprint]);

export interface FootprintSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly value?: SchemaValidFootprint;
}

export function validateFootprintSchema(
  element: ParsedXmlElement,
  idRegistry: SemanticIdRegistry,
): FootprintSchemaValidationResult {
  const context = validateCommonSemanticElement(
    element,
    {
      groupId: APARTMENT_SVG_GROUP_IDS.footprint,
      elementName: APARTMENT_SVG_ELEMENT_NAMES.polygon,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedKinds: ALLOWED_KINDS,
      invalidValueCode: APARTMENT_SVG_VALIDATION_CODES.footprint.invalidAttributeValue,
      category: "footprint",
    },
    idRegistry,
  );
  // Polygon topology, orthogonality, and containment belong to geometric validation.
  const points = readPolygonPoints(context, "footprint");
  const errors = Object.freeze(context.errors);
  if (
    errors.length > 0 ||
    context.id === undefined ||
    context.kind === undefined ||
    points === undefined
  ) {
    return Object.freeze({ errors });
  }
  return Object.freeze({
    errors,
    value: Object.freeze({ id: context.id, kind: APARTMENT_SVG_SEMANTIC_KINDS.footprint, points }),
  });
}
