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
  semantic: Object.freeze({
    invalidElementType: "APSVG-SEMANTIC-001",
    invalidNamespace: "APSVG-SEMANTIC-002",
    missingAttribute: "APSVG-SEMANTIC-003",
    prohibitedAttribute: "APSVG-SEMANTIC-004",
    unknownAttribute: "APSVG-SEMANTIC-005",
    nestedSemanticElement: "APSVG-SEMANTIC-006",
  }),
  id: Object.freeze({
    missing: "APSVG-ID-001",
    invalid: "APSVG-ID-002",
    duplicate: "APSVG-ID-003",
  }),
  zone: Object.freeze({
    invalidAttributeValue: "APSVG-ZONE-101",
    malformedPoints: "APSVG-ZONE-102",
    invalidPointNumber: "APSVG-ZONE-103",
    conditionalAttribute: "APSVG-ZONE-104",
  }),
  wall: Object.freeze({
    invalidAttributeValue: "APSVG-WALL-101",
  }),
  window: Object.freeze({
    invalidAttributeValue: "APSVG-WINDOW-101",
    conditionalAttribute: "APSVG-WINDOW-102",
  }),
  door: Object.freeze({
    invalidAttributeValue: "APSVG-DOOR-101",
    conditionalAttribute: "APSVG-DOOR-102",
  }),
  fixedElement: Object.freeze({
    invalidAttributeValue: "APSVG-FIXED-101",
    conditionalAttribute: "APSVG-FIXED-102",
  }),
  utility: Object.freeze({
    invalidAttributeValue: "APSVG-UTILITY-101",
    conditionalAttribute: "APSVG-UTILITY-102",
  }),
  camera: Object.freeze({
    invalidAttributeValue: "APSVG-CAMERA-101",
  }),
} as const);

type Values<T> = T[keyof T];

export type ApartmentSvgValidationCode =
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.root>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.metadata>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.group>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.semantic>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.id>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.zone>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.wall>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.window>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.door>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.fixedElement>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.utility>
  | Values<typeof APARTMENT_SVG_VALIDATION_CODES.camera>;

export type ApartmentSvgValidationCategory =
  | "root"
  | "metadata"
  | "group"
  | "semantic"
  | "id"
  | "zone"
  | "wall"
  | "window"
  | "door"
  | "fixed-element"
  | "utility"
  | "camera";
