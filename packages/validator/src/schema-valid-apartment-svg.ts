import type { Decimal, Point2D } from "@planaxis/geometry";

export interface SchemaValidApartmentSvgViewBox {
  readonly minX: Decimal;
  readonly minY: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
}

export interface SchemaValidApartmentSvgMetadata {
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
  readonly location?: SchemaValidApartmentSvgLocation;
}

export interface SchemaValidApartmentSvgLocation {
  readonly latitude: Decimal;
  readonly longitude: Decimal;
  readonly northHeading: Decimal;
  readonly elevationMeters?: Decimal;
  readonly timeZone?: string;
}

export type ApartmentSvgStatus = "fixed" | "modifiable" | "proposal";

export type ApartmentSvgSpaceFunction =
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

export type ApartmentSvgSpaceEnclosure = "closed" | "partial" | "open";

export interface SchemaValidSpace {
  readonly id: string;
  readonly kind: "zone";
  readonly points: readonly Point2D[];
  readonly name: string;
  readonly function: ApartmentSvgSpaceFunction;
  readonly functionDescription?: string;
  readonly enclosure: ApartmentSvgSpaceEnclosure;
}

export type ApartmentSvgWallAxis = "x" | "y";
export type ApartmentSvgWallClass = "interior" | "exterior";

export interface SchemaValidWall {
  readonly id: string;
  readonly kind: "wall";
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
  readonly axis: ApartmentSvgWallAxis;
  readonly wallHeight?: Decimal;
  readonly wallClass: ApartmentSvgWallClass;
  readonly status: ApartmentSvgStatus;
}

export type ApartmentSvgWindowOpeningType = "fixed" | "casement" | "tilt" | "tilt-turn" | "sliding";
export type ApartmentSvgWindowFrameMaterial = "wood" | "plastic" | "aluminium" | "steel" | "other";
export type ApartmentSvgWindowGlassType = "clear" | "frosted" | "tinted" | "other";

export interface SchemaValidWindow {
  readonly id: string;
  readonly kind: "window";
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
  readonly wallId: string;
  readonly sillHeight: Decimal;
  readonly openingHeight: Decimal;
  readonly openingType?: ApartmentSvgWindowOpeningType;
  readonly frameMaterial?: ApartmentSvgWindowFrameMaterial;
  readonly frameMaterialDescription?: string;
  readonly frameColor?: string;
  readonly glassType?: ApartmentSvgWindowGlassType;
  readonly glassTypeDescription?: string;
  readonly radiatorBelowId?: string;
  readonly status: ApartmentSvgStatus;
}

interface SchemaValidDoorBase {
  readonly id: string;
  readonly kind: "door";
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
  readonly wallId: string;
  readonly openingHeight: Decimal;
  readonly status: ApartmentSvgStatus;
}

export type ApartmentSvgDoorType = "hinged" | "sliding" | "opening-only";

export interface SchemaValidHingedDoor extends SchemaValidDoorBase {
  readonly doorType: "hinged";
  readonly hinge: Point2D;
  readonly openLeaf: Point2D;
}

export interface SchemaValidSlidingDoor extends SchemaValidDoorBase {
  readonly doorType: "sliding";
}

export interface SchemaValidOpeningOnlyDoor extends SchemaValidDoorBase {
  readonly doorType: "opening-only";
}

export type SchemaValidDoor =
  SchemaValidHingedDoor | SchemaValidSlidingDoor | SchemaValidOpeningOnlyDoor;

export type ApartmentSvgFixedElementKind =
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

interface SchemaValidFixedElementBase {
  readonly id: string;
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
  readonly baseZ: Decimal;
  readonly elementHeight: Decimal;
  readonly status: ApartmentSvgStatus;
}

export interface SchemaValidRadiator extends SchemaValidFixedElementBase {
  readonly kind: "radiator";
  readonly wallId?: string;
}

export interface SchemaValidFixedObject extends SchemaValidFixedElementBase {
  readonly kind: "fixed-object";
  readonly typeDescription: string;
}

export interface SchemaValidOtherFixedElement extends SchemaValidFixedElementBase {
  readonly kind: Exclude<ApartmentSvgFixedElementKind, "radiator" | "fixed-object">;
}

export type SchemaValidFixedElement =
  SchemaValidRadiator | SchemaValidFixedObject | SchemaValidOtherFixedElement;

export type ApartmentSvgUtilityKind =
  "socket" | "ethernet" | "tv-coax" | "light-switch" | "ceiling-light" | "wall-light";

interface SchemaValidUtilityBase {
  readonly id: string;
  readonly cx: Decimal;
  readonly cy: Decimal;
  readonly radius: Decimal;
  readonly z: Decimal;
  readonly status?: ApartmentSvgStatus;
}

export interface SchemaValidWallUtility extends SchemaValidUtilityBase {
  readonly kind: Exclude<ApartmentSvgUtilityKind, "ceiling-light">;
  readonly wallId: string;
}

export interface SchemaValidCeilingLight extends SchemaValidUtilityBase {
  readonly kind: "ceiling-light";
}

export type SchemaValidUtility = SchemaValidWallUtility | SchemaValidCeilingLight;

export interface SchemaValidCamera {
  readonly id: string;
  readonly kind: "camera";
  readonly cx: Decimal;
  readonly cy: Decimal;
  readonly radius: Decimal;
  readonly z: Decimal;
  readonly heading: Decimal;
  readonly pitch: Decimal;
  readonly horizontalFov: Decimal;
}

export type SchemaValidSemanticElement =
  | SchemaValidSpace
  | SchemaValidWall
  | SchemaValidWindow
  | SchemaValidDoor
  | SchemaValidFixedElement
  | SchemaValidUtility
  | SchemaValidCamera;

/**
 * Complete Apartment SVG schema output. References remain unresolved and no
 * geometric or topological conformance is implied by this type.
 */
export interface SchemaValidApartmentSvgDocument {
  readonly schema: "apartment-svg";
  readonly schemaVersion: "2.1";
  readonly unit: "cm";
  readonly viewBox: SchemaValidApartmentSvgViewBox;
  readonly metadata: SchemaValidApartmentSvgMetadata;
  readonly spaces: readonly SchemaValidSpace[];
  readonly walls: readonly SchemaValidWall[];
  readonly windows: readonly SchemaValidWindow[];
  readonly doors: readonly SchemaValidDoor[];
  readonly fixedElements: readonly SchemaValidFixedElement[];
  readonly utilities: readonly SchemaValidUtility[];
  readonly cameras: readonly SchemaValidCamera[];
  readonly semanticElementsById: ReadonlyMap<string, SchemaValidSemanticElement>;
}
