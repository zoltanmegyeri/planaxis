export type {
  ArchitecturalCamera3D,
  ArchitecturalCeilingLight3D,
  ArchitecturalDoor3D,
  ArchitecturalFixedElement3D,
  ArchitecturalFixedObject3D,
  ArchitecturalHingedDoor3D,
  ArchitecturalModel3D,
  ArchitecturalOpeningOnlyDoor3D,
  ArchitecturalOtherFixedElement3D,
  ArchitecturalRadiator3D,
  ArchitecturalSlidingDoor3D,
  ArchitecturalSourceElement3D,
  ArchitecturalUtility3D,
  ArchitecturalWall3D,
  ArchitecturalWallUtility3D,
  ArchitecturalWindow3D,
} from "./architectural-model-3d.js";
export { buildArchitecturalModel3D } from "./build-architectural-model-3d.js";
export { deriveArchitecturalSurfaces } from "./derive-architectural-surfaces.js";
export {
  horizontalFinishTargetId,
  wallSideFinishTargetId,
  revealFinishTargetId,
  spaceFinishTargetId,
} from "./architectural-surfaces.js";
export type {
  ArchitecturalSurface3D,
  ArchitecturalSurfacePatch3D,
  ArchitecturalSurfaceSet3D,
  BaseFinishTarget,
  BaseFinishTargetId,
  FinishTarget,
  FinishTargetId,
  HorizontalFinishTargetId,
  HorizontalSurfacePatch3D,
  OpeningReveal,
  RectangularSurfacePatch3D,
  RevealFinishTargetId,
  SpaceFinishTarget,
  SpaceFinishTargetId,
  SurfaceAxis,
  SurfaceSign,
  WallSide,
  WallSideFinishTargetId,
} from "./architectural-surfaces.js";

export { createSurfaceMapping, surfaceMappingDistances } from "./surface-mapping.js";
export type { PhysicalSurfaceMapping } from "./surface-mapping.js";
export { resolveRuntimeFinish, validateRuntimePbrMaterial } from "./runtime-pbr-material.js";
export type {
  RuntimePbrMaterial,
  RuntimePbrTextures,
  RuntimeTextureReference,
  RuntimeFinishAssignments,
} from "./runtime-pbr-material.js";
