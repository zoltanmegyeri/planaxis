import { ShapeUtils, Vector2 } from "three/webgpu";

/** Renderer-only centimeter coordinates in a base target's physical U/V plane. */
export type RenderPolygon = readonly Vector2[];

export function triangulatePolygon(polygon: RenderPolygon): RenderPolygon[] {
  return ShapeUtils.triangulateShape([...polygon], []).map((triangle) =>
    triangle.map((index) => {
      const point = polygon[index];
      if (!point) throw new Error("Missing triangulated surface point.");
      return point;
    }),
  );
}

/** Splits a convex cell by a convex coverage triangle, returning disjoint convex pieces.
 * This is draw tessellation only; it never changes the exact architectural surface model.
 */
export function partitionByTriangle(
  cell: RenderPolygon,
  triangle: RenderPolygon,
): { outside: RenderPolygon[]; inside: RenderPolygon } {
  if (!boundsOverlap(cell, triangle)) return { outside: [cell], inside: [] };
  const boundary = ShapeUtils.isClockWise([...triangle]) ? [...triangle].reverse() : triangle;
  const outside: RenderPolygon[] = [];
  let inside = cell;
  for (const [index, a] of boundary.entries()) {
    const b = boundary[(index + 1) % boundary.length];
    if (!b) throw new Error("Missing coverage edge.");
    const positive: Vector2[] = [];
    const negative: Vector2[] = [];
    const side = (p: Vector2): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    for (const [i, p] of inside.entries()) {
      const q = inside[(i + 1) % inside.length];
      if (!q) throw new Error("Missing cell edge.");
      const pSide = side(p),
        qSide = side(q);
      if (pSide >= 0) positive.push(p);
      if (pSide <= 0) negative.push(p);
      if ((pSide < 0 && qSide > 0) || (pSide > 0 && qSide < 0)) {
        const intersection = p.clone().lerp(q, pSide / (pSide - qSide));
        // Both sides share the identical intersection before Float32 buffer conversion.
        positive.push(intersection);
        negative.push(intersection);
      }
    }
    if (hasArea(negative)) outside.push(negative);
    inside = hasArea(positive) ? positive : [];
    if (inside.length === 0) break;
  }
  return { outside, inside };
}

function hasArea(polygon: RenderPolygon): boolean {
  return polygon.length >= 3 && Math.abs(ShapeUtils.area([...polygon])) > 0;
}

function boundsOverlap(a: RenderPolygon, b: RenderPolygon): boolean {
  return (["x", "y"] as const).every(
    (axis) =>
      Math.min(...a.map((point) => point[axis])) < Math.max(...b.map((point) => point[axis])) &&
      Math.max(...a.map((point) => point[axis])) > Math.min(...b.map((point) => point[axis])),
  );
}
