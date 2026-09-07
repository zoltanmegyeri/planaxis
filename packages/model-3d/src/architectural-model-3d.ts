import type { HorizontalPolygonSurface3D, Point3D, RectangularPrism3D } from "@planaxis/geometry";
import type {
  ApartmentCamera,
  ApartmentCeilingLight,
  ApartmentFixedObject,
  ApartmentHingedDoor,
  ApartmentMetadata,
  ApartmentOpeningOnlyDoor,
  ApartmentOtherFixedElement,
  ApartmentRadiator,
  ApartmentSlidingDoor,
  ApartmentWall,
  ApartmentWallUtility,
  ApartmentWindow,
} from "@planaxis/model";

/** The complete wall envelope; openings remain separate semantic voids. */
export interface ArchitecturalWall3D extends Omit<ApartmentWall, "footprint"> {
  readonly volume: RectangularPrism3D;
}

export interface ArchitecturalWindow3D extends Omit<
  ApartmentWindow,
  "footprint" | "wall" | "radiatorBelow"
> {
  readonly opening: RectangularPrism3D;
  readonly wall: ArchitecturalWall3D;
  readonly radiatorBelow?: ArchitecturalRadiator3D;
}

/** Hinge and leaf endpoints remain exact plan-view reference geometry. */
export interface ArchitecturalHingedDoor3D extends Omit<ApartmentHingedDoor, "footprint" | "wall"> {
  readonly opening: RectangularPrism3D;
  readonly wall: ArchitecturalWall3D;
}

export interface ArchitecturalSlidingDoor3D extends Omit<
  ApartmentSlidingDoor,
  "footprint" | "wall"
> {
  readonly opening: RectangularPrism3D;
  readonly wall: ArchitecturalWall3D;
}

export interface ArchitecturalOpeningOnlyDoor3D extends Omit<
  ApartmentOpeningOnlyDoor,
  "footprint" | "wall"
> {
  readonly opening: RectangularPrism3D;
  readonly wall: ArchitecturalWall3D;
}

export type ArchitecturalDoor3D =
  ArchitecturalHingedDoor3D | ArchitecturalSlidingDoor3D | ArchitecturalOpeningOnlyDoor3D;

export interface ArchitecturalRadiator3D extends Omit<
  ApartmentRadiator,
  "footprint" | "baseZ" | "wall"
> {
  readonly volume: RectangularPrism3D;
  readonly wall?: ArchitecturalWall3D;
}

export interface ArchitecturalFixedObject3D extends Omit<
  ApartmentFixedObject,
  "footprint" | "baseZ"
> {
  readonly volume: RectangularPrism3D;
}

export interface ArchitecturalOtherFixedElement3D extends Omit<
  ApartmentOtherFixedElement,
  "footprint" | "baseZ"
> {
  readonly volume: RectangularPrism3D;
}

export type ArchitecturalFixedElement3D =
  ArchitecturalRadiator3D | ArchitecturalFixedObject3D | ArchitecturalOtherFixedElement3D;

export interface ArchitecturalWallUtility3D extends Omit<
  ApartmentWallUtility,
  "position" | "z" | "wall"
> {
  readonly position: Point3D;
  readonly wall: ArchitecturalWall3D;
}

export interface ArchitecturalCeilingLight3D extends Omit<ApartmentCeilingLight, "position" | "z"> {
  readonly position: Point3D;
}

export type ArchitecturalUtility3D = ArchitecturalWallUtility3D | ArchitecturalCeilingLight3D;

/** Heading, pitch, and horizontal FOV retain their exact source degree values. */
export interface ArchitecturalCamera3D extends Omit<ApartmentCamera, "position" | "z"> {
  readonly position: Point3D;
}

export type ArchitecturalSourceElement3D =
  | ArchitecturalWall3D
  | ArchitecturalWindow3D
  | ArchitecturalDoor3D
  | ArchitecturalFixedElement3D
  | ArchitecturalUtility3D
  | ArchitecturalCamera3D;

/**
 * Trusted renderer-independent architecture in centimeters, with source X/Y
 * unchanged and model-space Z = level.baseZ + localZ. Heights are dimensions;
 * window sillHeight remains the source level-local measurement.
 * Floor and ceiling are zero-thickness boundaries without source element IDs.
 */
export interface ArchitecturalModel3D {
  readonly metadata: ApartmentMetadata;
  readonly floor: HorizontalPolygonSurface3D;
  readonly ceiling: HorizontalPolygonSurface3D;
  readonly walls: readonly ArchitecturalWall3D[];
  readonly windows: readonly ArchitecturalWindow3D[];
  readonly doors: readonly ArchitecturalDoor3D[];
  readonly fixedElements: readonly ArchitecturalFixedElement3D[];
  readonly utilities: readonly ArchitecturalUtility3D[];
  readonly cameras: readonly ArchitecturalCamera3D[];
  readonly sourceElementsById: ReadonlyMap<string, ArchitecturalSourceElement3D>;
}
