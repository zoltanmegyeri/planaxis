import type { Decimal } from "@planaxis/geometry";
import type { ApartmentSpace } from "@planaxis/model";
import type { ArchitecturalModel3D } from "./architectural-model-3d.js";
import { horizontalFinishTargetId, spaceFinishTargetId } from "./architectural-surfaces.js";
import type {
  ArchitecturalSurface3D,
  ArchitecturalSurfacePatch3D,
  ArchitecturalSurfaceSet3D,
  FinishTarget,
  RectangularSurfacePatch3D,
  SpaceFinishTarget,
} from "./architectural-surfaces.js";
import { deriveWallSurfaces, minDecimal, maxDecimal } from "./wall-surfaces.js";

/** Derives physical surfaces and optional semantic coverage from trusted exact architecture. */
export function deriveArchitecturalSurfaces(
  model: ArchitecturalModel3D,
): ArchitecturalSurfaceSet3D {
  const surfaces: ArchitecturalSurface3D[] = (["floor", "ceiling"] as const).map((kind) => ({
    kind,
    finishTargetId: horizontalFinishTargetId(kind),
    patches: [
      {
        kind: "horizontal",
        ...model[kind],
        normalSign: kind === "floor" ? "positive" : "negative",
      },
    ],
  }));
  surfaces.push(...deriveWallSurfaces(model));
  const finishTargets: FinishTarget[] = surfaces.flatMap((surface) =>
    "finishTargetId" in surface ? [{ scope: "base", id: surface.finishTargetId }] : [],
  );
  for (const space of model.spaces) {
    for (const kind of ["floor", "ceiling"] as const) {
      const base = horizontalFinishTargetId(kind);
      finishTargets.push({
        scope: "space",
        id: spaceFinishTargetId(space.id, base),
        spaceId: space.id,
        baseTargetId: base,
        coverage: [
          {
            kind: "horizontal",
            boundary: space.boundary,
            z: model[kind].z,
            normalSign: kind === "floor" ? "positive" : "negative",
          },
        ],
      });
    }
    for (const surface of surfaces) {
      if (surface.kind !== "wall-side") continue;
      const coverage = surface.patches.flatMap((patch) => adjacentCoverage(space, patch));
      if (coverage.length === 0) continue;
      const target: SpaceFinishTarget = {
        scope: "space",
        id: spaceFinishTargetId(space.id, surface.finishTargetId),
        spaceId: space.id,
        baseTargetId: surface.finishTargetId,
        coverage,
      };
      finishTargets.push(target);
    }
  }
  // Freeze owned derived structures; trusted source polygons and decimals are shared unchanged.
  for (const surface of surfaces) {
    freezePatches(surface.patches);
    Object.freeze(surface);
  }
  for (const target of finishTargets) {
    if (target.scope === "space") freezePatches(target.coverage);
    Object.freeze(target);
  }
  return Object.freeze({
    surfaces: Object.freeze(surfaces),
    finishTargets: Object.freeze(finishTargets),
  });
}

function freezePatches(patches: readonly ArchitecturalSurfacePatch3D[]): void {
  for (const patch of patches) {
    if (patch.kind === "rectangle") {
      Object.freeze(patch.min);
      Object.freeze(patch.max);
    }
    Object.freeze(patch);
  }
  Object.freeze(patches);
}

function adjacentCoverage(
  space: ApartmentSpace,
  patch: RectangularSurfacePatch3D,
): RectangularSurfacePatch3D[] {
  const transverse = patch.normalAxis;
  if (transverse === "z") return [];
  const longitudinal = transverse === "x" ? "y" : "x";
  const coordinate = patch.min[transverse];
  const intervals: { start: Decimal; end: Decimal }[] = [];
  for (const [i, start] of space.boundary.entries()) {
    const end = space.boundary[(i + 1) % space.boundary.length];
    // Polygon topology uses exact segment contact (as in geometry's segment predicates).
    // A near-parallel diagonal or a nearby noncontacting edge does not create adjacency.
    if (!end || !start[transverse].eq(coordinate) || !end[transverse].eq(coordinate)) continue;
    const low = maxDecimal(
      patch.min[longitudinal],
      minDecimal(start[longitudinal], end[longitudinal]),
    );
    const high = minDecimal(
      patch.max[longitudinal],
      maxDecimal(start[longitudinal], end[longitudinal]),
    );
    if (low.lt(high)) intervals.push({ start: low, end: high });
  }
  // Merge consecutive collinear polygon edges without introducing segment identities.
  intervals.sort((a, b) => a.start.comparedTo(b.start));
  const merged: { start: Decimal; end: Decimal }[] = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start.lte(previous.end))
      previous.end = maxDecimal(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged.map(({ start, end }) => ({
    ...patch,
    min: { ...patch.min, [longitudinal]: start },
    max: { ...patch.max, [longitudinal]: end },
  }));
}
