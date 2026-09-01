export const APARTMENT_SVG_VALIDATION_CODES = Object.freeze({
  root: Object.freeze({
    invalidElementForm: "APSVG-ROOT-001",
    invalidNamespace: "APSVG-ROOT-002",
    missingAttribute: "APSVG-ROOT-003",
    invalidAttributeValue: "APSVG-ROOT-004",
    invalidViewBox: "APSVG-ROOT-005",
    invalidViewBoxExtent: "APSVG-ROOT-006",
  }),
  metadata: Object.freeze({
    missing: "APSVG-METADATA-001",
    duplicate: "APSVG-METADATA-002",
    invalidContentForm: "APSVG-METADATA-003",
    invalidJson: "APSVG-METADATA-004",
    invalidRoot: "APSVG-METADATA-005",
    missingProperty: "APSVG-METADATA-006",
    invalidPropertyType: "APSVG-METADATA-007",
    invalidPropertyValue: "APSVG-METADATA-008",
    unknownProperty: "APSVG-METADATA-009",
    unitsMismatch: "APSVG-METADATA-010",
  }),
  group: Object.freeze({
    missingRequiredGroup: "APSVG-GROUP-001",
    duplicateRequiredGroup: "APSVG-GROUP-002",
    invalidRequiredGroupForm: "APSVG-GROUP-003",
    unknownRootElement: "APSVG-GROUP-004",
    unknownGroup: "APSVG-GROUP-005",
    prohibitedTransform: "APSVG-GROUP-006",
  }),
} as const);

type Values<T> = T[keyof T];

export type ApartmentSvgValidationCode =
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.root>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.metadata>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.group>;

export type ApartmentSvgValidationCategory = "root" | "metadata" | "group";
