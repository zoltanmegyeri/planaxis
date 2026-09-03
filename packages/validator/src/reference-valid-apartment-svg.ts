import type {
  SchemaValidApartmentSvgDocument,
  SchemaValidCamera,
  SchemaValidCeilingLight,
  SchemaValidFixedObject,
  SchemaValidHingedDoor,
  SchemaValidOpeningOnlyDoor,
  SchemaValidOtherFixedElement,
  SchemaValidRadiator,
  SchemaValidSlidingDoor,
  SchemaValidSpace,
  SchemaValidWall,
  SchemaValidWallUtility,
  SchemaValidWindow,
} from "./schema-valid-apartment-svg.js";

export type ReferenceValidSpace = SchemaValidSpace;
export type ReferenceValidWall = SchemaValidWall;
export type ReferenceValidCamera = SchemaValidCamera;
export type ReferenceValidFixedObject = SchemaValidFixedObject;
export type ReferenceValidOtherFixedElement = SchemaValidOtherFixedElement;
export type ReferenceValidCeilingLight = SchemaValidCeilingLight;

export interface ReferenceValidRadiator extends SchemaValidRadiator {
  readonly wall?: ReferenceValidWall;
}

export interface ReferenceValidWindow extends SchemaValidWindow {
  readonly wall: ReferenceValidWall;
  readonly radiatorBelow?: ReferenceValidRadiator;
}

interface ReferenceValidDoorRelationship {
  readonly wall: ReferenceValidWall;
}

export interface ReferenceValidHingedDoor
  extends SchemaValidHingedDoor, ReferenceValidDoorRelationship {}

export interface ReferenceValidSlidingDoor
  extends SchemaValidSlidingDoor, ReferenceValidDoorRelationship {}

export interface ReferenceValidOpeningOnlyDoor
  extends SchemaValidOpeningOnlyDoor, ReferenceValidDoorRelationship {}

export type ReferenceValidDoor =
  ReferenceValidHingedDoor | ReferenceValidSlidingDoor | ReferenceValidOpeningOnlyDoor;

export type ReferenceValidFixedElement =
  ReferenceValidRadiator | ReferenceValidFixedObject | ReferenceValidOtherFixedElement;

export interface ReferenceValidWallUtility extends SchemaValidWallUtility {
  readonly wall: ReferenceValidWall;
}

export type ReferenceValidUtility = ReferenceValidWallUtility | ReferenceValidCeilingLight;

export type ReferenceValidSemanticElement =
  | ReferenceValidSpace
  | ReferenceValidWall
  | ReferenceValidWindow
  | ReferenceValidDoor
  | ReferenceValidFixedElement
  | ReferenceValidUtility
  | ReferenceValidCamera;

/**
 * Apartment SVG output whose core references exist and target the required
 * semantic kinds. Geometric and topological conformance is not implied.
 */
export interface ReferenceValidApartmentSvgDocument extends Omit<
  SchemaValidApartmentSvgDocument,
  "windows" | "doors" | "fixedElements" | "utilities" | "semanticElementsById"
> {
  readonly windows: readonly ReferenceValidWindow[];
  readonly doors: readonly ReferenceValidDoor[];
  readonly fixedElements: readonly ReferenceValidFixedElement[];
  readonly utilities: readonly ReferenceValidUtility[];
  readonly semanticElementsById: ReadonlyMap<string, ReferenceValidSemanticElement>;
}
