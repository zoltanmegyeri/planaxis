import { readFileSync } from "node:fs";
import { buildArchitecturalModel3D } from "@planaxis/model-3d";
import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import { parseApartmentSvg } from "@planaxis/parser";
import {
  buildValidatedApartment2D,
  validateApartmentSvgSchema,
  validateApartmentSvgReferences,
  validateApartmentSvgGeometry,
} from "@planaxis/validator";

export function modelFixture(name = "minimal-semantic-schema.svg"): ArchitecturalModel3D {
  const source = readFileSync(new URL(`../../../fixtures/valid/${name}`, import.meta.url), "utf8");
  const parsed = parseApartmentSvg(source);
  if (!parsed.ok) throw new Error("Invalid fixture XML");
  const schema = validateApartmentSvgSchema(parsed.document);
  if (!schema.valid) throw new Error("Invalid fixture schema");
  const refs = validateApartmentSvgReferences(schema.document);
  if (!refs.valid) throw new Error("Invalid fixture references");
  const geometry = validateApartmentSvgGeometry(refs.document);
  if (!geometry.valid) throw new Error(JSON.stringify(geometry.errors));
  return buildArchitecturalModel3D(buildValidatedApartment2D(geometry.document));
}
