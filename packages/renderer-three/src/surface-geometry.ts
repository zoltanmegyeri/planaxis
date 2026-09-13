import type {
  ArchitecturalSurface3D,
  BaseFinishTargetId,
  HorizontalSurfacePatch3D,
} from "@planaxis/model-3d";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three/webgpu";
import { meters, rendererPoint } from "./coordinates.js";

/** Triangulates exact surfaces at the renderer boundary, preserving base target draw ranges. */
export function surfaceGeometry(surfaces: readonly ArchitecturalSurface3D[]): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const finishTargetRanges: { finishTargetId: BaseFinishTargetId; start: number; count: number }[] =
    [];
  for (const surface of surfaces) {
    const start = indices.length;
    for (const patch of surface.patches) {
      const offset = positions.length / 3;
      if (patch.kind === "horizontal") {
        const polygon = horizontalGeometry(patch);
        try {
          positions.push(...polygon.getAttribute("position").array);
          const triangles = polygon.getIndex();
          if (triangles)
            for (let i = 0; i < triangles.count; i++) indices.push(offset + triangles.getX(i));
        } finally {
          polygon.dispose();
        }
      } else {
        const [u, v] =
          patch.normalAxis === "x"
            ? (["y", "z"] as const)
            : patch.normalAxis === "y"
              ? (["z", "x"] as const)
              : (["x", "y"] as const);
        for (const [upperU, upperV] of [
          [false, false],
          [true, false],
          [true, true],
          [false, true],
        ]) {
          positions.push(
            ...rendererPoint({
              ...patch.min,
              [u]: (upperU ? patch.max : patch.min)[u],
              [v]: (upperV ? patch.max : patch.min)[v],
            }).toArray(),
          );
        }
        // (X,Y,Z) -> (X,Z,Y) changes handedness; reverse positive model winding.
        const winding = patch.normalSign === "positive" ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
        indices.push(...winding.map((index) => offset + index));
      }
    }
    if ("finishTargetId" in surface)
      finishTargetRanges.push({
        finishTargetId: surface.finishTargetId,
        start,
        count: indices.length - start,
      });
  }
  const geometry = new BufferGeometry();
  // Shared boundary coordinates receive identical Float32 conversion, avoiding local-cell cracks.
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.finishTargetRanges = finishTargetRanges;
  return geometry;
}

function horizontalGeometry(patch: HorizontalSurfacePatch3D): BufferGeometry {
  const shape = new Shape(
    patch.boundary.map((point) => new Vector2(meters(point.x), meters(point.y))),
  );
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, meters(patch.z), 0);
  if (patch.normalSign === "positive") {
    const index = geometry.getIndex();
    if (index)
      for (let i = 0; i < index.count; i += 3) {
        const first = index.getX(i);
        index.setX(i, index.getX(i + 2));
        index.setX(i + 2, first);
      }
  }
  return geometry;
}
