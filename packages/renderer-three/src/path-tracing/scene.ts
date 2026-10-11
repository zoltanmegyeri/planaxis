import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three/webgpu";
import type { BufferGeometry, Material } from "three/webgpu";
import type { ApartmentScene } from "../apartment-scene.js";
import type { RuntimeFinishOptions } from "../runtime-materials.js";

export interface TracingTriangle {
  readonly a: Vector3;
  readonly b: Vector3;
  readonly c: Vector3;
  readonly color: readonly [number, number, number];
  readonly glass: boolean;
  readonly source: string;
}

/** A rendering subset check, never format validation or persistent material repair. */
export function unsupportedTracingInputs(
  model: ArchitecturalModel3D,
  finishes: RuntimeFinishOptions = {},
): string | undefined {
  for (const window of model.windows) {
    if (window.glassType !== undefined && window.glassType !== "clear")
      return `Window ${window.id}: path tracing supports clear or unspecified glass only.`;
  }
  for (const [target, finish] of finishes.assignments ?? []) {
    if (
      finish.textures ||
      finish.metalness !== 0 ||
      finish.roughness < 0.5 ||
      (finish.alpha !== undefined && finish.alpha.mode !== "opaque")
    )
      return `Finish ${target}: path tracing requires opaque, untextured, nonmetallic matte finishes (roughness ≥ 0.5).`;
  }
  return undefined;
}

/** Borrow the actual adapted surface meshes, including reveals and fixed prisms.
 * Visibility/culling/shadow masks affect raster inspection only; all physical
 * triangles remain two-sided in the tracer. Coordinates already are meters.
 */
export function extractTracingTriangles(apartment: ApartmentScene): TracingTriangle[] {
  const result: TracingTriangle[] = [];
  apartment.group.updateMatrixWorld(true);
  apartment.group.traverse((object) => {
    if (!(object instanceof Mesh) || object.userData.visualizationMarker) return;
    const glass = object.parent?.userData.kind === "window";
    const source = object.parent?.userData.sourceId as string | undefined;
    const geometry: BufferGeometry = object.geometry;
    const position = geometry.getAttribute("position");
    const index = geometry.index;
    const count = index?.count ?? position.count;
    for (let offset = 0; offset < count; offset += 3) {
      const group = geometry.groups.find(
        (candidate) => offset >= candidate.start && offset < candidate.start + candidate.count,
      );
      const palette: Material | Material[] = object.material;
      const material = Array.isArray(palette) ? palette[group?.materialIndex ?? 0] : palette;
      if (!(material instanceof MeshStandardMaterial))
        throw new Error("Path tracing encountered an unsupported architectural material.");
      const vertices = [0, 1, 2].map((corner) =>
        new Vector3()
          .fromBufferAttribute(position, index ? index.getX(offset + corner) : offset + corner)
          .applyMatrix4(object.matrixWorld),
      );
      const [a, b, c] = vertices;
      if (!a || !b || !c) throw new Error("Incomplete architectural triangle.");
      result.push({
        a,
        b,
        c,
        // RuntimeMaterials already converted the effective sRGB factor to linear.
        color: [material.color.r, material.color.g, material.color.b],
        glass,
        source: source ?? object.name,
      });
    }
  });
  return result;
}

export interface TracingBvh {
  /** Four RGBA texels per triangle: a, b, c, linear albedo + thin-glass flag. */
  readonly triangles: Float32Array;
  /** Two RGBA texels per preorder node: min + escape, max + triangle (-1 inner). */
  readonly nodes: Float32Array;
  readonly nodeCount: number;
}

/** Deterministic median BVH with escape links: no shader stack or depth cutoff.
 * Inspired by the upstream triangle/AABB texture workflow; packing and traversal
 * are local to this bounded subset (see UPSTREAM.md).
 */
export function buildTracingBvh(input: readonly TracingTriangle[]): TracingBvh {
  if (input.length === 0) throw new Error("Path tracing requires architectural surfaces.");
  const triangles: number[] = [];
  const nodes: number[] = [];
  const visit = (subset: readonly TracingTriangle[]): void => {
    const bounds = new Box3();
    for (const triangle of subset)
      for (const vertex of [triangle.a, triangle.b, triangle.c]) bounds.expandByPoint(vertex);
    const offset = nodes.length;
    nodes.push(...bounds.min.toArray(), 0, ...bounds.max.toArray(), -1);
    if (subset.length === 1) {
      const triangle = subset[0]!;
      nodes[offset + 7] = triangles.length / 16;
      triangles.push(
        ...triangle.a.toArray(),
        0,
        ...triangle.b.toArray(),
        0,
        ...triangle.c.toArray(),
        0,
        ...triangle.color,
        triangle.glass ? 1 : 0,
      );
    } else {
      const size = bounds.getSize(new Vector3());
      const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
      const sorted = [...subset].sort(
        (a, b) => a.a[axis] + a.b[axis] + a.c[axis] - b.a[axis] - b.b[axis] - b.c[axis],
      );
      const middle = Math.floor(sorted.length / 2);
      visit(sorted.slice(0, middle));
      visit(sorted.slice(middle));
    }
    nodes[offset + 3] = nodes.length / 8;
  };
  visit(input);
  // Float textures store exact integer links only below 2^24.
  if (nodes.length / 8 >= 2 ** 24) throw new Error("Architecture exceeds the tracing BVH limit.");
  return {
    triangles: new Float32Array(triangles),
    nodes: new Float32Array(nodes),
    nodeCount: nodes.length / 8,
  };
}
