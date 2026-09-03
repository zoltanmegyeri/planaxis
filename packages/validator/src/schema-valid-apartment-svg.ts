import type { Decimal, Point2D } from "@planaxis/geometry";

import type {
  APARTMENT_SVG_DOCUMENT_VALUES,
  APARTMENT_SVG_DOOR_TYPE_VALUES,
  APARTMENT_SVG_FIXED_ELEMENT_KIND_VALUES,
  APARTMENT_SVG_METADATA_COORDINATE_VALUES,
  APARTMENT_SVG_SEMANTIC_KINDS,
  APARTMENT_SVG_SPACE_ENCLOSURE_VALUES,
  APARTMENT_SVG_SPACE_FUNCTION_VALUES,
  APARTMENT_SVG_STATUS_VALUES,
  APARTMENT_SVG_UTILITY_KIND_VALUES,
  APARTMENT_SVG_WALL_AXIS_VALUES,
  APARTMENT_SVG_WALL_CLASS_VALUES,
  APARTMENT_SVG_WINDOW_FRAME_MATERIAL_VALUES,
  APARTMENT_SVG_WINDOW_GLASS_TYPE_VALUES,
  APARTMENT_SVG_WINDOW_OPENING_TYPE_VALUES,
} from "./schema-vocabulary.js";

type VocabularyValue<T> = T[keyof T];

export interface SchemaValidApartmentSvgViewBox {
  readonly minX: Decimal;
  readonly minY: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
}

export interface SchemaValidApartmentSvgMetadata {
  readonly schema: typeof APARTMENT_SVG_DOCUMENT_VALUES.metadataSchema;
  readonly project: {
    readonly name: string;
    readonly units: typeof APARTMENT_SVG_DOCUMENT_VALUES.unit;
  };
  readonly coordinateSystem: {
    readonly x: typeof APARTMENT_SVG_METADATA_COORDINATE_VALUES.x;
    readonly y: typeof APARTMENT_SVG_METADATA_COORDINATE_VALUES.y;
    readonly z: typeof APARTMENT_SVG_METADATA_COORDINATE_VALUES.z;
    readonly headingDegrees: {
      readonly 0: typeof APARTMENT_SVG_METADATA_COORDINATE_VALUES.heading0;
      readonly 90: typeof APARTMENT_SVG_METADATA_COORDINATE_VALUES.heading90;
      readonly 180: typeof APARTMENT_SVG_METADATA_COORDINATE_VALUES.heading180;
      readonly 270: typeof APARTMENT_SVG_METADATA_COORDINATE_VALUES.heading270;
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

export type ApartmentSvgStatus = VocabularyValue<typeof APARTMENT_SVG_STATUS_VALUES>;

export type ApartmentSvgSpaceFunction = VocabularyValue<typeof APARTMENT_SVG_SPACE_FUNCTION_VALUES>;

export type ApartmentSvgSpaceEnclosure = VocabularyValue<
  typeof APARTMENT_SVG_SPACE_ENCLOSURE_VALUES
>;

export interface SchemaValidSpace {
  readonly id: string;
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.zone;
  readonly points: readonly Point2D[];
  readonly name: string;
  readonly function: ApartmentSvgSpaceFunction;
  readonly functionDescription?: string;
  readonly enclosure: ApartmentSvgSpaceEnclosure;
}

export type ApartmentSvgWallAxis = VocabularyValue<typeof APARTMENT_SVG_WALL_AXIS_VALUES>;
export type ApartmentSvgWallClass = VocabularyValue<typeof APARTMENT_SVG_WALL_CLASS_VALUES>;

export interface SchemaValidWall {
  readonly id: string;
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.wall;
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
  readonly axis: ApartmentSvgWallAxis;
  readonly wallHeight?: Decimal;
  readonly wallClass: ApartmentSvgWallClass;
  readonly status: ApartmentSvgStatus;
}

export type ApartmentSvgWindowOpeningType = VocabularyValue<
  typeof APARTMENT_SVG_WINDOW_OPENING_TYPE_VALUES
>;
export type ApartmentSvgWindowFrameMaterial = VocabularyValue<
  typeof APARTMENT_SVG_WINDOW_FRAME_MATERIAL_VALUES
>;
export type ApartmentSvgWindowGlassType = VocabularyValue<
  typeof APARTMENT_SVG_WINDOW_GLASS_TYPE_VALUES
>;

export interface SchemaValidWindow {
  readonly id: string;
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.window;
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
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.door;
  readonly x: Decimal;
  readonly y: Decimal;
  readonly width: Decimal;
  readonly height: Decimal;
  readonly wallId: string;
  readonly openingHeight: Decimal;
  readonly status: ApartmentSvgStatus;
}

export type ApartmentSvgDoorType = VocabularyValue<typeof APARTMENT_SVG_DOOR_TYPE_VALUES>;

export interface SchemaValidHingedDoor extends SchemaValidDoorBase {
  readonly doorType: typeof APARTMENT_SVG_DOOR_TYPE_VALUES.hinged;
  readonly hinge: Point2D;
  readonly openLeaf: Point2D;
}

export interface SchemaValidSlidingDoor extends SchemaValidDoorBase {
  readonly doorType: typeof APARTMENT_SVG_DOOR_TYPE_VALUES.sliding;
}

export interface SchemaValidOpeningOnlyDoor extends SchemaValidDoorBase {
  readonly doorType: typeof APARTMENT_SVG_DOOR_TYPE_VALUES.openingOnly;
}

export type SchemaValidDoor =
  SchemaValidHingedDoor | SchemaValidSlidingDoor | SchemaValidOpeningOnlyDoor;

export type ApartmentSvgFixedElementKind = VocabularyValue<
  typeof APARTMENT_SVG_FIXED_ELEMENT_KIND_VALUES
>;

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
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.radiator;
  readonly wallId?: string;
}

export interface SchemaValidFixedObject extends SchemaValidFixedElementBase {
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.fixedObject;
  readonly typeDescription: string;
}

export interface SchemaValidOtherFixedElement extends SchemaValidFixedElementBase {
  readonly kind: Exclude<
    ApartmentSvgFixedElementKind,
    typeof APARTMENT_SVG_SEMANTIC_KINDS.radiator | typeof APARTMENT_SVG_SEMANTIC_KINDS.fixedObject
  >;
}

export type SchemaValidFixedElement =
  SchemaValidRadiator | SchemaValidFixedObject | SchemaValidOtherFixedElement;

export type ApartmentSvgUtilityKind = VocabularyValue<typeof APARTMENT_SVG_UTILITY_KIND_VALUES>;

interface SchemaValidUtilityBase {
  readonly id: string;
  readonly cx: Decimal;
  readonly cy: Decimal;
  readonly radius: Decimal;
  readonly z: Decimal;
  readonly status?: ApartmentSvgStatus;
}

export interface SchemaValidWallUtility extends SchemaValidUtilityBase {
  readonly kind: Exclude<ApartmentSvgUtilityKind, typeof APARTMENT_SVG_SEMANTIC_KINDS.ceilingLight>;
  readonly wallId: string;
}

export interface SchemaValidCeilingLight extends SchemaValidUtilityBase {
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.ceilingLight;
}

export type SchemaValidUtility = SchemaValidWallUtility | SchemaValidCeilingLight;

export interface SchemaValidCamera {
  readonly id: string;
  readonly kind: typeof APARTMENT_SVG_SEMANTIC_KINDS.camera;
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
  readonly schema: typeof APARTMENT_SVG_DOCUMENT_VALUES.schema;
  readonly schemaVersion: typeof APARTMENT_SVG_DOCUMENT_VALUES.schemaVersion;
  readonly unit: typeof APARTMENT_SVG_DOCUMENT_VALUES.unit;
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
