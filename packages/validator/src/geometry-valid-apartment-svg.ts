import type { ReferenceValidApartmentSvgDocument } from "./reference-valid-apartment-svg.js";

declare const geometryValidApartmentSvgDocumentBrand: unique symbol;

/**
 * Final trusted Apartment SVG representation after schema, reference,
 * geometric, and topological validation have all succeeded.
 */
export interface GeometryValidApartmentSvgDocument extends ReferenceValidApartmentSvgDocument {
  readonly [geometryValidApartmentSvgDocumentBrand]: true;
}
