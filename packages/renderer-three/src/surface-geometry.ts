import {
  createSurfaceMapping,
  resolveRuntimeFinish,
  surfaceMappingDistances,
} from "@planaxis/model-3d";
import type {
  ArchitecturalSurface3D,
  ArchitecturalSurfacePatch3D,
  BaseFinishTargetId,
  FinishTarget,
  FinishTargetId,
  PhysicalSurfaceMapping,
  RuntimeFinishAssignments,
  RuntimePbrMaterial,
} from "@planaxis/model-3d";
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from "three/webgpu";
import { rendererMappedPoint } from "./coordinates.js";
import { partitionByTriangle, triangulatePolygon } from "./finish-partition.js";
import type { RenderPolygon } from "./finish-partition.js";

interface SurfaceGeometryOptions {
  readonly targets: readonly FinishTarget[];
  readonly assignments: RuntimeFinishAssignments;
  readonly materialIndex: (material: RuntimePbrMaterial | undefined) => number;
}
interface FinishRegion {
  readonly polygon: RenderPolygon;
  readonly targetId: FinishTargetId | undefined;
  readonly material: RuntimePbrMaterial | undefined;
}

/** Tessellates physical target coverage into disjoint draw groups with physically scaled UVs. */
export function surfaceGeometry(
  surfaces: readonly ArchitecturalSurface3D[],
  options?: SurfaceGeometryOptions,
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const groups: { start: number; count: number; materialIndex: number }[] = [];
  const finishTargetRanges: { finishTargetId: BaseFinishTargetId; start: number; count: number }[] =
    [];
  const resolvedFinishTargetRanges: {
    finishTargetId: FinishTargetId;
    start: number;
    count: number;
  }[] = [];
  for (const surface of surfaces) {
    const start = indices.length;
    for (const patch of surface.patches) {
      // Untargeted structural caps remain neutral; their UV frame has no finish semantics.
      const mapping = "mapping" in surface ? surface.mapping : structuralMapping(patch);
      const polygon = projectPatch(patch, mapping);
      const target =
        "finishTargetId" in surface
          ? options?.targets.find((target) => target.id === surface.finishTargetId)
          : undefined;
      const material =
        target && options ? resolveRuntimeFinish(target, options.assignments) : undefined;
      const overrides =
        target && options
          ? options.targets.filter(
              (candidate) =>
                candidate.scope === "space" &&
                candidate.baseTargetId === target.id &&
                options.assignments.has(candidate.id),
            )
          : [];
      // Rectangular patches stay quads unless coverage actually needs partitioning.
      const cells = patch.kind === "horizontal" ? triangulatePolygon(polygon) : [polygon];
      let regions: FinishRegion[] = cells.map((polygon) => ({
        polygon,
        material,
        targetId: target?.id ?? ("finishTargetId" in surface ? surface.finishTargetId : undefined),
      }));
      for (const override of overrides) {
        if (override.scope !== "space" || !options) continue;
        for (const coverage of override.coverage) {
          for (const triangle of triangulatePolygon(projectPatch(coverage, mapping))) {
            regions = regions.flatMap((region) => {
              // A previously assigned region cannot overlap another validated space's interior.
              if (region.targetId !== target?.id) return [region];
              const { outside, inside } = partitionByTriangle(region.polygon, triangle);
              return [
                ...outside.map((polygon) => ({ ...region, polygon })),
                ...(inside.length
                  ? [
                      {
                        polygon: inside,
                        targetId: override.id,
                        material: resolveRuntimeFinish(override, options.assignments),
                      },
                    ]
                  : []),
              ];
            });
          }
        }
      }
      for (const region of regions) {
        const offset = positions.length / 3;
        const regionStart = indices.length;
        const points = ShapeUtils.isClockWise([...region.polygon])
          ? [...region.polygon].reverse()
          : region.polygon;
        const width = region.material?.textures?.widthCm.toNumber() ?? 1;
        const height = region.material?.textures?.heightCm.toNumber() ?? 1;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
          throw new RangeError("Physical texture dimensions exceed renderer numeric range.");
        for (const point of points) {
          positions.push(...rendererMappedPoint(point.x, point.y, mapping));
          uvs.push(point.x / width, point.y / height);
        }
        // U × V is the model outward normal; the renderer basis reverses handedness.
        for (let i = 1; i + 1 < points.length; i++)
          indices.push(offset, offset + i + 1, offset + i);
        const count = indices.length - regionStart;
        const materialIndex = options?.materialIndex(region.material) ?? 0;
        const previous = groups.at(-1);
        if (previous && previous.materialIndex === materialIndex) previous.count += count;
        else groups.push({ start: regionStart, count, materialIndex });
        if (region.targetId)
          resolvedFinishTargetRanges.push({
            finishTargetId: region.targetId,
            start: regionStart,
            count,
          });
      }
    }
    if ("finishTargetId" in surface)
      finishTargetRanges.push({
        finishTargetId: surface.finishTargetId,
        start,
        count: indices.length - start,
      });
  }
  // Allocate only after partitioning/material resolution succeeds, so errors leak no geometry.
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.computeVertexNormals();
  geometry.userData.finishTargetRanges = finishTargetRanges;
  geometry.userData.resolvedFinishTargetRanges = resolvedFinishTargetRanges;
  return geometry;
}

function structuralMapping(patch: ArchitecturalSurfacePatch3D): PhysicalSurfaceMapping {
  if (patch.kind !== "rectangle") throw new Error("Expected structural rectangle.");
  return createSurfaceMapping(
    patch.normalAxis,
    patch.normalSign,
    patch.min[patch.normalAxis],
    patch.min.z,
  );
}

function projectPatch(
  patch: ArchitecturalSurfacePatch3D,
  mapping: PhysicalSurfaceMapping,
): RenderPolygon {
  const points =
    patch.kind === "horizontal"
      ? patch.boundary.map((p) => ({ ...p, z: patch.z }))
      : (() => {
          const axes = (["x", "y", "z"] as const).filter((axis) => axis !== patch.normalAxis);
          const [u, v] = axes;
          if (!u || !v) throw new Error("Missing surface axes.");
          return [
            patch.min,
            { ...patch.min, [u]: patch.max[u] },
            patch.max,
            { ...patch.min, [v]: patch.max[v] },
          ];
        })();
  return points.map((point) => {
    const distance = surfaceMappingDistances(mapping, point);
    return new Vector2(distance.uCm.toNumber(), distance.vCm.toNumber());
  });
}
