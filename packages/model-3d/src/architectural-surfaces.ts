import type { HorizontalPolygonSurface3D, Point3D } from "@planaxis/geometry";

export type WallSide = "side-negative" | "side-positive";
export type OpeningReveal = "reveal-start" | "reveal-end" | "reveal-top" | "reveal-bottom";
export type HorizontalFinishTargetId = "floor" | "ceiling";
export type WallSideFinishTargetId = `wall:${string}:${WallSide}`;
export type RevealFinishTargetId = `wall:${string}:opening:${string}:${OpeningReveal}`;
export type BaseFinishTargetId =
  HorizontalFinishTargetId | WallSideFinishTargetId | RevealFinishTargetId;
export type SpaceFinishTargetId =
  `space:${string}:${HorizontalFinishTargetId | WallSideFinishTargetId}`;
export type FinishTargetId = BaseFinishTargetId | SpaceFinishTargetId;

export function horizontalFinishTargetId(kind: HorizontalFinishTargetId): HorizontalFinishTargetId {
  return kind;
}

export function wallSideFinishTargetId(wallId: string, side: WallSide): WallSideFinishTargetId {
  return `wall:${wallId}:${side}`;
}

export function revealFinishTargetId(
  wallId: string,
  openingId: string,
  reveal: OpeningReveal,
): RevealFinishTargetId {
  return `wall:${wallId}:opening:${openingId}:${reveal}`;
}

export function spaceFinishTargetId(
  spaceId: string,
  base: HorizontalFinishTargetId | WallSideFinishTargetId,
): SpaceFinishTargetId {
  return `space:${spaceId}:${base}`;
}

export type SurfaceAxis = "x" | "y" | "z";
export type SurfaceSign = "negative" | "positive";

/** Exact centimeter rectangle: min/max agree on normalAxis and increase on the other axes. */
export interface RectangularSurfacePatch3D {
  readonly kind: "rectangle";
  readonly min: Point3D;
  readonly max: Point3D;
  readonly normalAxis: SurfaceAxis;
  readonly normalSign: SurfaceSign;
}

export interface HorizontalSurfacePatch3D extends HorizontalPolygonSurface3D {
  readonly kind: "horizontal";
  readonly normalSign: SurfaceSign;
}

export type ArchitecturalSurfacePatch3D = RectangularSurfacePatch3D | HorizontalSurfacePatch3D;

/** One physical surface may have disconnected patches. No material or mesh state is stored. */
export type ArchitecturalSurface3D =
  | {
      readonly kind: "floor" | "ceiling";
      readonly finishTargetId: HorizontalFinishTargetId;
      readonly patches: readonly HorizontalSurfacePatch3D[];
    }
  | {
      readonly kind: "wall-side";
      readonly sourceId: string;
      readonly side: WallSide;
      readonly finishTargetId: WallSideFinishTargetId;
      readonly patches: readonly RectangularSurfacePatch3D[];
    }
  | {
      readonly kind: "opening-reveal";
      readonly sourceId: string;
      readonly openingId: string;
      readonly reveal: OpeningReveal;
      readonly finishTargetId: RevealFinishTargetId;
      readonly patches: readonly RectangularSurfacePatch3D[];
    }
  | {
      readonly kind: "wall-structure";
      readonly sourceId: string;
      readonly patches: readonly RectangularSurfacePatch3D[];
    };

export interface BaseFinishTarget {
  readonly scope: "base";
  readonly id: BaseFinishTargetId;
}

/** Coverage on an existing base surface, never an additional physical render surface. */
export interface SpaceFinishTarget {
  readonly scope: "space";
  readonly id: SpaceFinishTargetId;
  readonly spaceId: string;
  readonly baseTargetId: HorizontalFinishTargetId | WallSideFinishTargetId;
  readonly coverage: readonly ArchitecturalSurfacePatch3D[];
}

export type FinishTarget = BaseFinishTarget | SpaceFinishTarget;

export interface ArchitecturalSurfaceSet3D {
  readonly surfaces: readonly ArchitecturalSurface3D[];
  readonly finishTargets: readonly FinishTarget[];
}
