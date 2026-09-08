import { buildArchitecturalModel3D } from "@planaxis/model-3d";
import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import type { ValidatedApartment2D } from "@planaxis/model";
import { parseApartmentSvg } from "@planaxis/parser";
import type { ApartmentSvgParseError } from "@planaxis/parser";
import {
  buildValidatedApartment2D,
  validateApartmentSvgGeometry,
  validateApartmentSvgReferences,
  validateApartmentSvgSchema,
} from "@planaxis/validator";
import type { ApartmentSvgValidationError } from "@planaxis/validator";

export type DocumentResult =
  | { status: "valid"; model: ValidatedApartment2D; architecturalModel: ArchitecturalModel3D }
  | { status: "invalid"; stage: "Parser"; error: ApartmentSvgParseError }
  | {
      status: "invalid";
      stage: "Schema" | "Reference" | "Geometry";
      errors: readonly ApartmentSvgValidationError[];
    };

/** Compose shared trusted stages; unexpected exceptions remain application failures. */
export function processDocument(source: string): DocumentResult {
  const parsed = parseApartmentSvg(source);
  if (!parsed.ok) return { status: "invalid", stage: "Parser", error: parsed.error };
  const schema = validateApartmentSvgSchema(parsed.document);
  if (!schema.valid) return { status: "invalid", stage: "Schema", errors: schema.errors };
  const references = validateApartmentSvgReferences(schema.document);
  if (!references.valid)
    return { status: "invalid", stage: "Reference", errors: references.errors };
  const geometry = validateApartmentSvgGeometry(references.document);
  if (!geometry.valid) return { status: "invalid", stage: "Geometry", errors: geometry.errors };
  const model = buildValidatedApartment2D(geometry.document);
  return { status: "valid", model, architecturalModel: buildArchitecturalModel3D(model) };
}
