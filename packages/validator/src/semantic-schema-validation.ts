import type { ParsedApartmentSvgDocument, ParsedXmlElement } from "@planaxis/parser";

import { validateCameraSchema } from "./camera-schema-validation.js";
import { validateDoorSchema } from "./door-schema-validation.js";
import { validateFixedElementSchema } from "./fixed-element-schema-validation.js";
import { createSemanticIdRegistry, SVG_NAMESPACE_URI } from "./semantic-element-validation.js";
import type {
  SchemaValidCamera,
  SchemaValidDoor,
  SchemaValidFixedElement,
  SchemaValidSpace,
  SchemaValidUtility,
  SchemaValidWall,
  SchemaValidWindow,
} from "./schema-valid-apartment-svg.js";
import { validateSpaceSchema } from "./space-schema-validation.js";
import { validateUtilitySchema } from "./utility-schema-validation.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";
import { validateWallSchema } from "./wall-schema-validation.js";
import { validateWindowSchema } from "./window-schema-validation.js";
import { getParsedAttribute } from "./xml-element.js";

type CoreGroupId =
  "spaces" | "walls" | "windows" | "doors" | "fixed-elements" | "utilities" | "cameras";

export interface SemanticSchemaValidationResult {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly spaces: readonly SchemaValidSpace[];
  readonly walls: readonly SchemaValidWall[];
  readonly windows: readonly SchemaValidWindow[];
  readonly doors: readonly SchemaValidDoor[];
  readonly fixedElements: readonly SchemaValidFixedElement[];
  readonly utilities: readonly SchemaValidUtility[];
  readonly cameras: readonly SchemaValidCamera[];
}

export function validateApartmentSvgSemanticSchemas(
  document: ParsedApartmentSvgDocument,
): SemanticSchemaValidationResult {
  const errors: ApartmentSvgValidationError[] = [];
  const idRegistry = createSemanticIdRegistry(document);
  const spaces: SchemaValidSpace[] = [];
  const walls: SchemaValidWall[] = [];
  const windows: SchemaValidWindow[] = [];
  const doors: SchemaValidDoor[] = [];
  const fixedElements: SchemaValidFixedElement[] = [];
  const utilities: SchemaValidUtility[] = [];
  const cameras: SchemaValidCamera[] = [];

  validateGroupElements(document, "spaces", (element) => {
    const result = validateSpaceSchema(element, idRegistry);
    errors.push(...result.errors);
    if (result.value !== undefined) spaces.push(result.value);
  });
  validateGroupElements(document, "walls", (element) => {
    const result = validateWallSchema(element, idRegistry);
    errors.push(...result.errors);
    if (result.value !== undefined) walls.push(result.value);
  });
  validateGroupElements(document, "windows", (element) => {
    const result = validateWindowSchema(element, idRegistry);
    errors.push(...result.errors);
    if (result.value !== undefined) windows.push(result.value);
  });
  validateGroupElements(document, "doors", (element) => {
    const result = validateDoorSchema(element, idRegistry);
    errors.push(...result.errors);
    if (result.value !== undefined) doors.push(result.value);
  });
  validateGroupElements(document, "fixed-elements", (element) => {
    const result = validateFixedElementSchema(element, idRegistry);
    errors.push(...result.errors);
    if (result.value !== undefined) fixedElements.push(result.value);
  });
  validateGroupElements(document, "utilities", (element) => {
    const result = validateUtilitySchema(element, idRegistry);
    errors.push(...result.errors);
    if (result.value !== undefined) utilities.push(result.value);
  });
  validateGroupElements(document, "cameras", (element) => {
    const result = validateCameraSchema(element, idRegistry);
    errors.push(...result.errors);
    if (result.value !== undefined) cameras.push(result.value);
  });

  return Object.freeze({
    errors: Object.freeze(errors),
    spaces: Object.freeze(spaces),
    walls: Object.freeze(walls),
    windows: Object.freeze(windows),
    doors: Object.freeze(doors),
    fixedElements: Object.freeze(fixedElements),
    utilities: Object.freeze(utilities),
    cameras: Object.freeze(cameras),
  });
}

function validateGroupElements(
  document: ParsedApartmentSvgDocument,
  groupId: CoreGroupId,
  validateElement: (element: ParsedXmlElement) => void,
): void {
  const matchingGroups = document.rootElements.filter(
    (element) =>
      element.name.localName === "g" &&
      element.name.namespaceUri === SVG_NAMESPACE_URI &&
      getParsedAttribute(element, "id") === groupId,
  );
  if (matchingGroups.length !== 1) {
    return;
  }

  const group = matchingGroups[0];
  if (group === undefined) {
    throw new Error("A uniquely matched semantic group was not available.");
  }
  for (const child of group.children) {
    if (child.kind === "element") {
      validateElement(child);
    }
  }
}
