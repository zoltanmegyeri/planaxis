import { APARTMENT_SVG_ATTRIBUTES, APARTMENT_SVG_SEMANTIC_KINDS } from "./schema-vocabulary.js";
import type {
  ReferenceValidApartmentSvgDocument,
  ReferenceValidDoor,
  ReferenceValidFixedElement,
  ReferenceValidRadiator,
  ReferenceValidSemanticElement,
  ReferenceValidUtility,
  ReferenceValidWall,
  ReferenceValidWindow,
} from "./reference-valid-apartment-svg.js";
import type {
  SchemaValidApartmentSvgDocument,
  SchemaValidSemanticElement,
} from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

export interface ApartmentSvgReferenceValidationSuccess {
  readonly valid: true;
  readonly errors: readonly [];
  readonly document: ReferenceValidApartmentSvgDocument;
}

export interface ApartmentSvgReferenceValidationFailure {
  readonly valid: false;
  readonly errors: readonly ApartmentSvgValidationError[];
}

export type ApartmentSvgReferenceValidationResult =
  ApartmentSvgReferenceValidationSuccess | ApartmentSvgReferenceValidationFailure;

const EMPTY_VALIDATION_ERRORS: readonly [] = Object.freeze([]);

type ReferenceTargetKind =
  typeof APARTMENT_SVG_SEMANTIC_KINDS.wall | typeof APARTMENT_SVG_SEMANTIC_KINDS.radiator;

/**
 * Resolves and validates all Apartment SVG 2.1 core references in an already
 * schema-valid document. Geometric and topological rules remain deferred.
 */
export function validateApartmentSvgReferences(
  document: SchemaValidApartmentSvgDocument,
): ApartmentSvgReferenceValidationResult {
  const errors = collectReferenceErrors(document);
  if (errors.length > 0) {
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }

  return Object.freeze({
    valid: true,
    errors: EMPTY_VALIDATION_ERRORS,
    document: buildReferenceValidDocument(document),
  });
}

function collectReferenceErrors(
  document: SchemaValidApartmentSvgDocument,
): ApartmentSvgValidationError[] {
  const errors: ApartmentSvgValidationError[] = [];

  for (const window of document.windows) {
    validateReference(
      document,
      window,
      APARTMENT_SVG_ATTRIBUTES.dataWall,
      window.wallId,
      APARTMENT_SVG_SEMANTIC_KINDS.wall,
      errors,
    );
    if (window.radiatorBelowId !== undefined) {
      validateReference(
        document,
        window,
        APARTMENT_SVG_ATTRIBUTES.dataRadiatorBelow,
        window.radiatorBelowId,
        APARTMENT_SVG_SEMANTIC_KINDS.radiator,
        errors,
      );
    }
  }

  for (const door of document.doors) {
    validateReference(
      document,
      door,
      APARTMENT_SVG_ATTRIBUTES.dataWall,
      door.wallId,
      APARTMENT_SVG_SEMANTIC_KINDS.wall,
      errors,
    );
  }

  for (const fixedElement of document.fixedElements) {
    if (
      fixedElement.kind === APARTMENT_SVG_SEMANTIC_KINDS.radiator &&
      fixedElement.wallId !== undefined
    ) {
      validateReference(
        document,
        fixedElement,
        APARTMENT_SVG_ATTRIBUTES.dataWall,
        fixedElement.wallId,
        APARTMENT_SVG_SEMANTIC_KINDS.wall,
        errors,
      );
    }
  }

  for (const utility of document.utilities) {
    if ("wallId" in utility) {
      validateReference(
        document,
        utility,
        APARTMENT_SVG_ATTRIBUTES.dataWall,
        utility.wallId,
        APARTMENT_SVG_SEMANTIC_KINDS.wall,
        errors,
      );
    }
  }

  return errors;
}

function validateReference(
  document: SchemaValidApartmentSvgDocument,
  referringElement: SchemaValidSemanticElement,
  attribute: string,
  referenceId: string,
  expectedKind: ReferenceTargetKind,
  errors: ApartmentSvgValidationError[],
): void {
  const target = document.semanticElementsById.get(referenceId);
  if (target === undefined) {
    errors.push(
      Object.freeze({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.broken,
        category: "reference",
        rule: "reference.target-exists",
        expected: `an existing core semantic element with data-kind=${JSON.stringify(expectedKind)}`,
        message: `Reference ${attribute} on element ${referringElement.id} does not resolve to a core semantic element.`,
        elementId: referringElement.id,
        attribute,
        actual: referenceId,
      }),
    );
    return;
  }

  if (target.kind !== expectedKind) {
    errors.push(
      Object.freeze({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.wrongKind,
        category: "reference",
        rule: "reference.target-kind",
        expected: expectedKind,
        message: `Reference ${attribute} on element ${referringElement.id} targets ${referenceId}, whose semantic kind is not permitted.`,
        elementId: referringElement.id,
        attribute,
        actual: target.kind,
      }),
    );
  }
}

function buildReferenceValidDocument(
  document: SchemaValidApartmentSvgDocument,
): ReferenceValidApartmentSvgDocument {
  const wallsById = new Map(
    document.walls.map((wall): readonly [string, ReferenceValidWall] => [wall.id, wall]),
  );
  const fixedElements = Object.freeze(
    document.fixedElements.map((fixedElement): ReferenceValidFixedElement => {
      if (fixedElement.kind !== APARTMENT_SVG_SEMANTIC_KINDS.radiator) {
        return fixedElement;
      }

      return Object.freeze({
        ...fixedElement,
        ...(fixedElement.wallId === undefined
          ? {}
          : { wall: requireResolvedTarget(wallsById, fixedElement.wallId, "wall") }),
      });
    }),
  );
  const radiatorsById = new Map(
    fixedElements
      .filter(
        (fixedElement): fixedElement is ReferenceValidRadiator =>
          fixedElement.kind === APARTMENT_SVG_SEMANTIC_KINDS.radiator,
      )
      .map((radiator): readonly [string, ReferenceValidRadiator] => [radiator.id, radiator]),
  );
  const windows = Object.freeze(
    document.windows.map((window): ReferenceValidWindow =>
      Object.freeze({
        ...window,
        wall: requireResolvedTarget(wallsById, window.wallId, "wall"),
        ...(window.radiatorBelowId === undefined
          ? {}
          : {
              radiatorBelow: requireResolvedTarget(
                radiatorsById,
                window.radiatorBelowId,
                "radiator",
              ),
            }),
      }),
    ),
  );
  const doors = Object.freeze(
    document.doors.map((door): ReferenceValidDoor =>
      Object.freeze({
        ...door,
        wall: requireResolvedTarget(wallsById, door.wallId, "wall"),
      }),
    ),
  );
  const utilities = Object.freeze(
    document.utilities.map((utility): ReferenceValidUtility => {
      if (!("wallId" in utility)) {
        return utility;
      }

      return Object.freeze({
        ...utility,
        wall: requireResolvedTarget(wallsById, utility.wallId, "wall"),
      });
    }),
  );
  const semanticElements: readonly ReferenceValidSemanticElement[] = [
    ...document.spaces,
    ...document.walls,
    ...windows,
    ...doors,
    ...fixedElements,
    ...utilities,
    ...document.cameras,
  ];
  const semanticElementsById = new Map(
    semanticElements.map((element): readonly [string, ReferenceValidSemanticElement] => [
      element.id,
      element,
    ]),
  );
  if (semanticElementsById.size !== semanticElements.length) {
    throw new Error("Reference-valid document construction encountered a duplicate semantic ID.");
  }

  return Object.freeze({
    ...document,
    windows,
    doors,
    fixedElements,
    utilities,
    semanticElementsById,
  });
}

function requireResolvedTarget<T>(
  targetsById: ReadonlyMap<string, T>,
  referenceId: string,
  targetDescription: string,
): T {
  const target = targetsById.get(referenceId);
  if (target === undefined) {
    throw new Error(
      `Reference validation succeeded without a resolved ${targetDescription} target for ${referenceId}.`,
    );
  }
  return target;
}
