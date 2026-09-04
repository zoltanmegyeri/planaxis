import type { Decimal, Point2D, Rect2D } from "@planaxis/geometry";

export type ApartmentStatus = "fixed" | "modifiable" | "proposal";

export type ApartmentSpaceFunction =
  | "living-room"
  | "dining"
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "toilet"
  | "hall"
  | "corridor"
  | "entrance"
  | "home-office"
  | "storage"
  | "utility"
  | "balcony"
  | "other";

export type ApartmentSpaceEnclosure = "closed" | "partial" | "open";

export type ApartmentWallAxis = "x" | "y";

export type ApartmentWallClass = "interior" | "exterior";

export type ApartmentWindowOpeningType = "fixed" | "casement" | "tilt" | "tilt-turn" | "sliding";

export type ApartmentWindowFrameMaterial = "wood" | "plastic" | "aluminium" | "steel" | "other";

export type ApartmentWindowGlassType = "clear" | "frosted" | "tinted" | "other";

export type ApartmentFixedElementKind =
  | "radiator"
  | "column"
  | "shaft"
  | "chimney"
  | "boiler"
  | "built-in"
  | "air-conditioner"
  | "stair"
  | "mechanical-box"
  | "fixed-object";

export type ApartmentUtilityKind =
  "socket" | "ethernet" | "tv-coax" | "light-switch" | "ceiling-light" | "wall-light";

export interface ApartmentLocation {
  readonly latitude: Decimal;
  readonly longitude: Decimal;
  readonly northHeading: Decimal;
  readonly elevationMeters?: Decimal;
  readonly timeZone?: string;
}

export interface ApartmentMetadata {
  readonly schema: "apartment-svg/2.1";
  readonly project: {
    readonly name: string;
    readonly units: "cm";
  };
  readonly coordinateSystem: {
    readonly x: "right";
    readonly y: "down";
    readonly z: "up";
    readonly headingDegrees: {
      readonly 0: "+x";
      readonly 90: "+y";
      readonly 180: "-x";
      readonly 270: "-y";
    };
  };
  readonly level: {
    readonly id: string;
    readonly baseZ: Decimal;
    readonly defaultCeilingHeight: Decimal;
  };
  readonly location?: ApartmentLocation;
}

export interface ApartmentSpace {
  readonly id: string;
  readonly kind: "zone";
  readonly boundary: readonly Point2D[];
  readonly name: string;
  readonly function: ApartmentSpaceFunction;
  readonly functionDescription?: string;
  readonly enclosure: ApartmentSpaceEnclosure;
}

export interface LineSegment2D {
  readonly start: Point2D;
  readonly end: Point2D;
}

export interface ApartmentWall {
  readonly id: string;
  readonly kind: "wall";
  readonly footprint: Rect2D;
  readonly axis: ApartmentWallAxis;
  readonly explicitHeight?: Decimal;
  readonly wallClass: ApartmentWallClass;
  readonly status: ApartmentStatus;
  readonly length: Decimal;
  readonly thickness: Decimal;
  readonly effectiveHeight: Decimal;
  readonly centerline: LineSegment2D;
}

export interface ApartmentWindow {
  readonly id: string;
  readonly kind: "window";
  readonly footprint: Rect2D;
  readonly wall: ApartmentWall;
  readonly sillHeight: Decimal;
  readonly openingHeight: Decimal;
  readonly openingWidth: Decimal;
  readonly openingType?: ApartmentWindowOpeningType;
  readonly frameMaterial?: ApartmentWindowFrameMaterial;
  readonly frameMaterialDescription?: string;
  readonly frameColor?: string;
  readonly glassType?: ApartmentWindowGlassType;
  readonly glassTypeDescription?: string;
  readonly radiatorBelow?: ApartmentRadiator;
  readonly status: ApartmentStatus;
}

interface ApartmentDoorBase {
  readonly id: string;
  readonly kind: "door";
  readonly footprint: Rect2D;
  readonly wall: ApartmentWall;
  readonly openingHeight: Decimal;
  readonly openingWidth: Decimal;
  readonly status: ApartmentStatus;
}

export interface ApartmentHingedDoor extends ApartmentDoorBase {
  readonly doorType: "hinged";
  readonly hinge: Point2D;
  readonly openLeaf: Point2D;
  readonly leafLength: Decimal;
  readonly closedFreeEndpoint: Point2D;
}

export interface ApartmentSlidingDoor extends ApartmentDoorBase {
  readonly doorType: "sliding";
}

export interface ApartmentOpeningOnlyDoor extends ApartmentDoorBase {
  readonly doorType: "opening-only";
}

export type ApartmentDoor = ApartmentHingedDoor | ApartmentSlidingDoor | ApartmentOpeningOnlyDoor;

interface ApartmentFixedElementBase {
  readonly id: string;
  readonly footprint: Rect2D;
  readonly baseZ: Decimal;
  readonly height: Decimal;
  readonly status: ApartmentStatus;
}

export interface ApartmentRadiator extends ApartmentFixedElementBase {
  readonly kind: "radiator";
  readonly wall?: ApartmentWall;
}

export interface ApartmentFixedObject extends ApartmentFixedElementBase {
  readonly kind: "fixed-object";
  readonly typeDescription: string;
}

export interface ApartmentOtherFixedElement extends ApartmentFixedElementBase {
  readonly kind: Exclude<ApartmentFixedElementKind, "radiator" | "fixed-object">;
}

export type ApartmentFixedElement =
  ApartmentRadiator | ApartmentFixedObject | ApartmentOtherFixedElement;

interface ApartmentUtilityBase {
  readonly id: string;
  readonly position: Point2D;
  readonly z: Decimal;
  readonly status?: ApartmentStatus;
}

export interface ApartmentWallUtility extends ApartmentUtilityBase {
  readonly kind: Exclude<ApartmentUtilityKind, "ceiling-light">;
  readonly wall: ApartmentWall;
}

export interface ApartmentCeilingLight extends ApartmentUtilityBase {
  readonly kind: "ceiling-light";
}

export type ApartmentUtility = ApartmentWallUtility | ApartmentCeilingLight;

export interface ApartmentCamera {
  readonly id: string;
  readonly kind: "camera";
  readonly position: Point2D;
  readonly z: Decimal;
  readonly heading: Decimal;
  readonly pitch: Decimal;
  readonly horizontalFov: Decimal;
}

export type ApartmentSemanticElement =
  | ApartmentSpace
  | ApartmentWall
  | ApartmentWindow
  | ApartmentDoor
  | ApartmentFixedElement
  | ApartmentUtility
  | ApartmentCamera;

/**
 * Trusted, normalized in-memory apartment model produced only after complete
 * Apartment SVG schema, reference, geometric, and topological validation.
 */
export interface ValidatedApartment2D {
  readonly bounds: Rect2D;
  readonly metadata: ApartmentMetadata;
  readonly spaces: readonly ApartmentSpace[];
  readonly walls: readonly ApartmentWall[];
  readonly windows: readonly ApartmentWindow[];
  readonly doors: readonly ApartmentDoor[];
  readonly fixedElements: readonly ApartmentFixedElement[];
  readonly utilities: readonly ApartmentUtility[];
  readonly cameras: readonly ApartmentCamera[];
  readonly semanticElementsById: ReadonlyMap<string, ApartmentSemanticElement>;
}
