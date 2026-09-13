import { createDecimal } from "@planaxis/geometry";
import type { Decimal, Point3D, RectangularPrism3D } from "@planaxis/geometry";
import type { ArchitecturalModel3D, ArchitecturalWall3D } from "./architectural-model-3d.js";
import { revealFinishTargetId, wallSideFinishTargetId } from "./architectural-surfaces.js";
import type {
  ArchitecturalSurface3D,
  OpeningReveal,
  RectangularSurfacePatch3D,
  SurfaceAxis,
} from "./architectural-surfaces.js";

import { createSurfaceMapping } from "./surface-mapping.js";
interface Bounds {
  readonly min: Point3D;
  readonly max: Point3D;
}
interface Opening {
  readonly id: string;
  readonly bounds: Bounds;
}
const AXES = ["x", "y", "z"] as const;
const TWO = createDecimal("2");

function prismBounds(prism: RectangularPrism3D): Bounds {
  const { x, y, width, height } = prism.footprint;
  return {
    min: { x, y, z: prism.verticalRange.minZ },
    max: { x: x.plus(width), y: y.plus(height), z: prism.verticalRange.maxZ },
  };
}

/** Opening thickness matches are validated upstream; every void spans the full wall thickness. */
function wallCells(wall: ArchitecturalWall3D, openings: readonly Opening[]): Bounds[] {
  const envelope = prismBounds(wall.volume);
  const cuts = (axis: SurfaceAxis): Decimal[] => {
    const coordinates = [
      envelope.min[axis],
      envelope.max[axis],
      ...openings.flatMap(({ bounds }) =>
        [bounds.min[axis], bounds.max[axis]].filter(
          (value) => value.gt(envelope.min[axis]) && value.lt(envelope.max[axis]),
        ),
      ),
    ];
    return [...new Map(coordinates.map((value) => [value.toString(), value])).values()].sort(
      (a, b) => a.comparedTo(b),
    );
  };
  const longitudinal = cuts(wall.axis);
  const vertical = cuts("z");
  const cells: Bounds[] = [];
  for (const [i, start] of longitudinal.entries()) {
    const end = longitudinal[i + 1];
    if (end === undefined) continue;
    for (const [j, bottom] of vertical.entries()) {
      const top = vertical[j + 1];
      if (top === undefined) continue;
      const middle = start.plus(end).dividedBy(TWO);
      const height = bottom.plus(top).dividedBy(TWO);
      if (
        openings.some(
          ({ bounds }) =>
            middle.gt(bounds.min[wall.axis]) &&
            middle.lt(bounds.max[wall.axis]) &&
            height.gt(bounds.min.z) &&
            height.lt(bounds.max.z),
        )
      )
        continue;
      cells.push({
        min: { ...envelope.min, [wall.axis]: start, z: bottom },
        max: { ...envelope.max, [wall.axis]: end, z: top },
      });
    }
  }
  return cells;
}

/** Exact boundary of the retained-cell union, including deterministic source ownership. */
export function deriveWallSurfaces(model: ArchitecturalModel3D): ArchitecturalSurface3D[] {
  const walls = model.walls.map((wall) => {
    const openings = [...model.windows, ...model.doors]
      .filter((opening) => opening.wall.id === wall.id)
      .map((opening) => ({ id: opening.id, bounds: prismBounds(opening.opening) }));
    return { wall, openings, cells: wallCells(wall, openings) };
  });
  return walls.flatMap(({ wall, openings, cells }, index) => {
    const faces = boundaryFaces(cells);
    const neighbors = walls.flatMap((other, otherIndex) =>
      otherIndex === index
        ? []
        : other.cells.map((bounds) => ({ bounds, ownsCoplanarFace: otherIndex < index })),
    );
    const exposed = faces.flatMap((face) => {
      let fragments = [face];
      for (const { bounds, ownsCoplanarFace } of neighbors) {
        const coordinate = face.min[face.normalAxis];
        const min = bounds.min[face.normalAxis];
        const max = bounds.max[face.normalAxis];
        // Equal outward patches belong to the earlier source wall, as in the original adapter.
        const covered =
          face.normalSign === "positive"
            ? min.lte(coordinate) &&
              (max.gt(coordinate) || (ownsCoplanarFace && max.eq(coordinate)))
            : max.gte(coordinate) &&
              (min.lt(coordinate) || (ownsCoplanarFace && min.eq(coordinate)));
        if (covered)
          fragments = fragments.flatMap((fragment) => subtractRectangle(fragment, bounds));
      }
      return fragments;
    });
    const transverse = wall.axis === "x" ? "y" : "x";
    const result: ArchitecturalSurface3D[] = (["side-negative", "side-positive"] as const).map(
      (side) => ({
        kind: "wall-side",
        sourceId: wall.id,
        side,
        finishTargetId: wallSideFinishTargetId(wall.id, side),
        mapping: createSurfaceMapping(
          transverse,
          side === "side-negative" ? "negative" : "positive",
          prismBounds(wall.volume)[side === "side-negative" ? "min" : "max"][transverse],
          model.floor.z,
        ),
        patches: exposed.filter(
          (face) =>
            face.normalAxis === transverse &&
            face.normalSign === (side === "side-negative" ? "negative" : "positive"),
        ),
      }),
    );
    const reveals = new Map<
      string,
      { openingId: string; reveal: OpeningReveal; patches: RectangularSurfacePatch3D[] }
    >();
    const structural: RectangularSurfacePatch3D[] = [];
    for (const face of exposed) {
      if (face.normalAxis === transverse) continue;
      const owner = openings
        .map((opening) => ({ opening, reveal: revealForFace(face, wall.axis, opening.bounds) }))
        .find((candidate) => candidate.reveal !== undefined);
      if (!owner || owner.reveal === undefined) {
        structural.push(face);
        continue;
      }
      const id = revealFinishTargetId(wall.id, owner.opening.id, owner.reveal);
      const entry = reveals.get(id) ?? {
        openingId: owner.opening.id,
        reveal: owner.reveal,
        patches: [],
      };
      entry.patches.push(face);
      reveals.set(id, entry);
    }
    for (const { openingId, reveal, patches } of reveals.values()) {
      const face = patches[0];
      if (!face) throw new Error("Missing reveal surface.");
      result.push({
        kind: "opening-reveal",
        sourceId: wall.id,
        openingId,
        reveal,
        finishTargetId: revealFinishTargetId(wall.id, openingId, reveal),
        mapping: createSurfaceMapping(
          face.normalAxis,
          face.normalSign,
          face.min[face.normalAxis],
          model.floor.z,
        ),
        patches,
      });
    }
    if (structural.length)
      result.push({ kind: "wall-structure", sourceId: wall.id, patches: structural });
    return result;
  });
}

function boundaryFaces(cells: readonly Bounds[]): RectangularSurfacePatch3D[] {
  const faces = new Map<string, RectangularSurfacePatch3D>();
  for (const cell of cells)
    for (const axis of AXES)
      for (const sign of ["negative", "positive"] as const) {
        const coordinate = (sign === "negative" ? cell.min : cell.max)[axis];
        const min = { ...cell.min, [axis]: coordinate };
        const max = { ...cell.max, [axis]: coordinate };
        const key = [
          axis,
          ...AXES.flatMap((dimension) => [min[dimension].toString(), max[dimension].toString()]),
        ].join(",");
        // Every cell uses the same longitudinal/vertical grid, so internal faces match exactly.
        if (!faces.delete(key))
          faces.set(key, { kind: "rectangle", min, max, normalAxis: axis, normalSign: sign });
      }
  return [...faces.values()];
}

function revealForFace(
  face: RectangularSurfacePatch3D,
  longitudinal: "x" | "y",
  opening: Bounds,
): OpeningReveal | undefined {
  const axis = face.normalAxis;
  const other = axis === "z" ? longitudinal : "z";
  if (axis !== "z" && axis !== longitudinal) return undefined;
  if (!face.min[other].lt(opening.max[other]) || !face.max[other].gt(opening.min[other]))
    return undefined;
  if (face.normalSign === "positive" && face.min[axis].eq(opening.min[axis]))
    return axis === "z" ? "reveal-bottom" : "reveal-start";
  if (face.normalSign === "negative" && face.min[axis].eq(opening.max[axis]))
    return axis === "z" ? "reveal-top" : "reveal-end";
  return undefined;
}

/** Subtract projected coverage without moving architectural coordinates. */
function subtractRectangle(
  face: RectangularSurfacePatch3D,
  cut: Bounds,
): RectangularSurfacePatch3D[] {
  const [u, v] = AXES.filter((axis) => axis !== face.normalAxis);
  if (u === undefined || v === undefined) throw new Error("Missing surface projection axes.");
  const a = face.min[u],
    b = face.max[u],
    c = face.min[v],
    d = face.max[v];
  const left = maxDecimal(a, cut.min[u]),
    right = minDecimal(b, cut.max[u]);
  const bottom = maxDecimal(c, cut.min[v]),
    top = minDecimal(d, cut.max[v]);
  if (left.gte(right) || bottom.gte(top)) return [face];
  const fragments = [
    [a, left, c, d],
    [right, b, c, d],
    [left, right, c, bottom],
    [left, right, top, d],
  ] as const;
  return fragments.flatMap(([minU, maxU, minV, maxV]) => {
    if (minU.gte(maxU) || minV.gte(maxV)) return [];
    return [
      {
        ...face,
        min: { ...face.min, [u]: minU, [v]: minV },
        max: { ...face.max, [u]: maxU, [v]: maxV },
      },
    ];
  });
}

export function minDecimal(a: Decimal, b: Decimal): Decimal {
  return a.lte(b) ? a : b;
}
export function maxDecimal(a: Decimal, b: Decimal): Decimal {
  return a.gte(b) ? a : b;
}
