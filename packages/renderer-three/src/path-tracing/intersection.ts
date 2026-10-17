import type { Vector3 } from "three/webgpu";

/** Ray-aligned common-edge test, locally derived from Woop/Benthin/Wald 2013 and PBRT 4 §6.5.
 * Shared vertices undergo identical translation/shear, avoiding independently rounded u+v tests.
 * WebGL2 has no float64 fallback; real sealed-room readback separately audits float32 behavior.
 */
export const intersectionShader = /* glsl */ `
// Canonical operand order makes reversed shared edges exact negatives even with FMA contraction.
float commonEdge(vec2 a, vec2 b) {
  bool reverse = a.x < b.x || (a.x == b.x && a.y < b.y);
  vec2 p = reverse ? b : a, q = reverse ? a : b;
  float value = p.x*q.y-p.y*q.x;
  return reverse ? -value : value;
}
float alignedTriangle(vec3 origin, vec3 direction, vec3 a, vec3 b, vec3 c, out vec2 barycentric) {
  vec3 ad = abs(direction);
  int z = ad.x > ad.y ? (ad.x > ad.z ? 0 : 2) : (ad.y > ad.z ? 1 : 2);
  int x = (z + 1) % 3, y = (x + 1) % 3;
  vec3 p = a-origin, q = b-origin, r = c-origin;
  vec2 shear = vec2(direction[x],direction[y])/direction[z];
  vec2 ap = vec2(p[x],p[y])-shear*p[z];
  vec2 bp = vec2(q[x],q[y])-shear*q[z];
  vec2 cp = vec2(r[x],r[y])-shear*r[z];
  float u = commonEdge(cp,bp);
  float v = commonEdge(ap,cp);
  float w = commonEdge(bp,ap);
  if ((min(u,min(v,w)) < 0.0 && max(u,max(v,w)) > 0.0)) return FAR;
  float determinant = u+v+w;
  if (determinant == 0.0) return FAR;
  vec3 geometric = cross(b-a,c-a);
  float denominator = dot(direction,geometric);
  if (denominator == 0.0) return FAR;
  float distance = dot(a-origin,geometric)/denominator;
  if (distance < 0.0) return FAR;
  barycentric = vec2(v,w)/determinant;
  return distance;
}
`;

/** Float32 numerical reference for shared-edge tests, not authoritative geometry or a second engine. */
export function intersectTracingTriangle(
  origin: Vector3,
  direction: Vector3,
  vertices: readonly Vector3[],
): { distance: number; barycentric: readonly [number, number] } | undefined {
  const f = Math.fround;
  const d = direction.toArray().map(f),
    o = origin.toArray().map(f);
  const z =
    Math.abs(d[0]!) > Math.abs(d[1]!)
      ? Math.abs(d[0]!) > Math.abs(d[2]!)
        ? 0
        : 2
      : Math.abs(d[1]!) > Math.abs(d[2]!)
        ? 1
        : 2;
  const x = (z + 1) % 3,
    y = (x + 1) % 3;
  const shear = [f(d[x]! / d[z]!), f(d[y]! / d[z]!)];
  const points = vertices.map((vertex) => {
    const p = vertex.toArray().map((value, i) => f(f(value) - o[i]!));
    return [f(p[x]! - f(shear[0]! * p[z]!)), f(p[y]! - f(shear[1]! * p[z]!)), p[z]!];
  });
  const [a, b, c] = points;
  if (!a || !b || !c) throw new RangeError("Triangle reference requires three vertices.");
  const cross = (a: number[], b: number[]): number => {
    const reverse = a[0]! < b[0]! || (a[0] === b[0] && a[1]! < b[1]!);
    const p = reverse ? b : a,
      q = reverse ? a : b;
    const result = f(f(p[0]! * q[1]!) - f(p[1]! * q[0]!));
    return reverse ? -result : result;
  };
  const u = cross(c, b),
    v = cross(a, c),
    w = cross(b, a),
    determinant = f(f(u + v) + w);
  if ((Math.min(u, v, w) < 0 && Math.max(u, v, w) > 0) || determinant === 0) return undefined;
  const edge = (i: number): number[] =>
    vertices[i]!.toArray().map((v, j) => f(f(v) - f(vertices[0]!.getComponent(j))));
  const e1 = edge(1),
    e2 = edge(2);
  const normal = [
    f(f(e1[1]! * e2[2]!) - f(e1[2]! * e2[1]!)),
    f(f(e1[2]! * e2[0]!) - f(e1[0]! * e2[2]!)),
    f(f(e1[0]! * e2[1]!) - f(e1[1]! * e2[0]!)),
  ];
  const dot = (a: number[], b: number[]): number =>
    f(f(f(a[0]! * b[0]!) + f(a[1]! * b[1]!)) + f(a[2]! * b[2]!));
  const delta = vertices[0]!.toArray().map((v, j) => f(f(v) - o[j]!));
  const denominator = dot(d, normal);
  if (denominator === 0) return undefined;
  const distance = f(dot(delta, normal) / denominator);
  if (distance < 0) return undefined;
  return { distance, barycentric: [f(v / determinant), f(w / determinant)] };
}
