import type { ArchitecturalWall3D } from "@planaxis/model-3d";
import type { RectangularPrism3D } from "@planaxis/geometry";
import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from "three/webgpu";
import { rendererBox } from "./coordinates.js";

/** Partition along every opening edge; omit void cells, retaining all piers and lintels. */
export function wallCells(
  wall: ArchitecturalWall3D,
  openings: readonly RectangularPrism3D[],
): Box3[] {
  const envelope = rendererBox(wall.volume);
  const axis = wall.axis === "x" ? "x" : "z";
  const voids = openings.map(rendererBox);
  const cuts = (dimension: "x" | "y" | "z"): number[] =>
    [
      ...new Set([
        envelope.min[dimension],
        envelope.max[dimension],
        ...voids
          .flatMap((box) => [box.min[dimension], box.max[dimension]])
          .filter((value) => value > envelope.min[dimension] && value < envelope.max[dimension]),
      ]),
    ].sort((a, b) => a - b);
  const longitudinal = cuts(axis);
  const vertical = cuts("y");
  const cells: Box3[] = [];
  for (const [i, start] of longitudinal.entries()) {
    const end = longitudinal[i + 1];
    if (end === undefined) continue;
    for (const [j, bottom] of vertical.entries()) {
      const top = vertical[j + 1];
      if (top === undefined) continue;
      const middle = (start + end) / 2;
      const height = (bottom + top) / 2;
      if (
        voids.some(
          (box) =>
            middle > box.min[axis] &&
            middle < box.max[axis] &&
            height > box.min.y &&
            height < box.max.y,
        )
      )
        continue;
      const min = envelope.min.clone();
      const max = envelope.max.clone();
      min[axis] = start;
      max[axis] = end;
      min.y = bottom;
      max.y = top;
      cells.push(new Box3(min, max));
    }
  }
  return cells;
}

/** Preserve source ownership while emitting only the boundary of the complete wall union. */
export function buildWallGeometries(
  walls: readonly { wall: ArchitecturalWall3D; openings: readonly RectangularPrism3D[] }[],
): BufferGeometry[] {
  const cells = walls.map(({ wall, openings }) => wallCells(wall, openings));
  return cells.map((owned, index) =>
    boundaryGeometry(
      owned,
      cells.flatMap((others, otherIndex) =>
        otherIndex === index
          ? []
          : others.map((bounds) => ({ bounds, ownsCoplanarFace: otherIndex < index })),
      ),
    ),
  );
}

function boundaryGeometry(
  cells: readonly Box3[],
  neighbors: readonly { bounds: Box3; ownsCoplanarFace: boolean }[],
): BufferGeometry {
  const faces = new Map<string, { corners: Vector3[]; sign: number }>();
  for (const cell of cells) {
    for (const axis of [0, 1, 2]) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      for (const sign of [-1, 1]) {
        const coordinate = (sign === -1 ? cell.min : cell.max).getComponent(axis);
        const key = [
          axis,
          coordinate,
          cell.min.getComponent(u),
          cell.max.getComponent(u),
          cell.min.getComponent(v),
          cell.max.getComponent(v),
        ].join(",");
        // All cells use the same longitudinal/vertical grid, so shared faces match exactly.
        if (faces.delete(key)) continue;
        const corners = [
          [false, false],
          [true, false],
          [true, true],
          [false, true],
        ].map(([upperU, upperV]) =>
          new Vector3()
            .setComponent(axis, coordinate)
            .setComponent(u, (upperU ? cell.max : cell.min).getComponent(u))
            .setComponent(v, (upperV ? cell.max : cell.min).getComponent(v)),
        );
        faces.set(key, { corners, sign });
      }
    }
  }
  const positions: number[] = [];
  const indices: number[] = [];
  for (const { corners, sign } of faces.values()) {
    const first = corners[0];
    const opposite = corners[2];
    if (!first || !opposite) throw new Error("Missing wall face corners");
    const axis = [0, 1, 2].find(
      (dimension) => first.getComponent(dimension) === opposite.getComponent(dimension),
    );
    if (axis === undefined) throw new Error("Wall face is not axis-aligned");
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const coordinate = first.getComponent(axis);
    let fragments = [
      [
        first.getComponent(u),
        opposite.getComponent(u),
        first.getComponent(v),
        opposite.getComponent(v),
      ] as Rectangle,
    ];
    for (const { bounds, ownsCoplanarFace } of neighbors) {
      const min = bounds.min.getComponent(axis);
      const max = bounds.max.getComponent(axis);
      // Remove buried/contact faces. Equal outward faces belong to the earlier source wall.
      const covered =
        sign === 1
          ? min <= coordinate && (max > coordinate || (ownsCoplanarFace && max === coordinate))
          : max >= coordinate && (min < coordinate || (ownsCoplanarFace && min === coordinate));
      if (!covered) continue;
      const cut: Rectangle = [
        bounds.min.getComponent(u),
        bounds.max.getComponent(u),
        bounds.min.getComponent(v),
        bounds.max.getComponent(v),
      ];
      fragments = fragments.flatMap((fragment) => subtractRectangle(fragment, cut));
    }
    for (const [minU, maxU, minV, maxV] of fragments) {
      const offset = positions.length / 3;
      for (const [a, b] of [
        [minU, minV],
        [maxU, minV],
        [maxU, maxV],
        [minU, maxV],
      ] as const) {
        positions.push(
          ...new Vector3()
            .setComponent(axis, coordinate)
            .setComponent(u, a)
            .setComponent(v, b)
            .toArray(),
        );
      }
      const winding = sign === 1 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      indices.push(...winding.map((index) => offset + index));
    }
  }
  const geometry = new BufferGeometry();
  // Shared boundary coordinates undergo the same Float32 conversion, avoiding cell-local cracks.
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type Rectangle = readonly [minU: number, maxU: number, minV: number, maxV: number];

/** Subtract a projected neighbor footprint without moving any architectural surface. */
function subtractRectangle(face: Rectangle, cut: Rectangle): Rectangle[] {
  const [a, b, c, d] = face;
  const left = Math.max(a, cut[0]);
  const right = Math.min(b, cut[1]);
  const bottom = Math.max(c, cut[2]);
  const top = Math.min(d, cut[3]);
  if (left >= right || bottom >= top) return [face];
  const fragments: Rectangle[] = [
    [a, left, c, d],
    [right, b, c, d],
    [left, right, c, bottom],
    [left, right, top, d],
  ];
  return fragments.filter(([minU, maxU, minV, maxV]) => minU < maxU && minV < maxV);
}
