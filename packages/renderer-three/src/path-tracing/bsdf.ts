import { Vector3 } from "three/webgpu";

/** Numerical reference for renderer review/integration tests; directions point away from the hit.
 * Matches the isotropic shader model. These values never become architectural/persistent data.
 */
export interface TracingBsdf {
  readonly color: readonly number[];
  readonly roughness: number;
  readonly metalness: number;
}
export const MIN_GGX_ALPHA = 0.001;
/** D <= 1/(pi*a²), G1/NV <= 2/a, G2/F <= 1, plus bounded diffuse. */
export const MAX_GGX_COSINE_WEIGHT = 1 / (2 * Math.PI * MIN_GGX_ALPHA ** 3) + 1 / Math.PI;
const luminance = (c: readonly number[]): number =>
  c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
export function specularProbability(s: TracingBsdf): number {
  const f0 = s.color.map((c) => 0.04 * (1 - s.metalness) + c * s.metalness);
  const specular = luminance(f0),
    diffuse = luminance(s.color) * (1 - s.metalness);
  return diffuse === 0 ? 1 : Math.max(0.1, Math.min(0.9, specular / (specular + diffuse)));
}
export function evaluateTracingBsdf(
  s: TracingBsdf,
  view: Vector3,
  light: Vector3,
  normal = new Vector3(0, 0, 1),
  geometric = normal,
): { value: number[]; pdf: number } {
  const nv = normal.dot(view),
    nl = normal.dot(light);
  if (nv <= 0 || nl <= 0 || geometric.dot(light) <= 0) return { value: [0, 0, 0], pdf: 0 };
  const half = view.clone().add(light);
  half
    .divideScalar(Math.max(Math.abs(half.x), Math.abs(half.y), Math.abs(half.z), 1e-30))
    .normalize();
  const nh = Math.max(0, normal.dot(half));
  const a = Math.max(MIN_GGX_ALPHA, s.roughness ** 2);
  const denominator = normal.clone().cross(half).lengthSq() + a * a * nh * nh;
  const d = (a * a) / (Math.PI * denominator ** 2);
  const smith = (c: number): number => 2 / (c + Math.sqrt(a * a + (1 - a * a) * c * c));
  const g1 = smith(nv),
    g2 = smith(nl),
    p = specularProbability(s);
  return {
    value: s.color.map((color) => {
      const f0 = 0.04 * (1 - s.metalness) + color * s.metalness;
      const f = f0 + (1 - f0) * (1 - Math.max(0, view.dot(half))) ** 5;
      const transmission =
        (1 - (f0 + (1 - f0) * (1 - nv) ** 5)) * (1 - (f0 + (1 - f0) * (1 - nl) ** 5));
      return (transmission * color * (1 - s.metalness)) / Math.PI + (f * d * g1 * g2) / 4;
    }),
    pdf: ((1 - p) * nl) / Math.PI + (p * d * g1) / 4,
  };
}
export function sampleTracingBsdf(
  s: TracingBsdf,
  view: Vector3,
  u: number,
  v: number,
  lobe: number,
): Vector3 {
  const radius = Math.sqrt(u),
    angle = 2 * Math.PI * v;
  if (lobe >= specularProbability(s))
    return new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), Math.sqrt(1 - u));
  const a = Math.max(MIN_GGX_ALPHA, s.roughness ** 2);
  const stretched = new Vector3(a * view.x, a * view.y, view.z).normalize();
  const side =
    stretched.x ** 2 + stretched.y ** 2 > 0
      ? new Vector3(-stretched.y, stretched.x, 0).normalize()
      : new Vector3(1, 0, 0);
  const up = stretched.clone().cross(side);
  const x = radius * Math.cos(angle),
    blend = 0.5 * (1 + stretched.z);
  const y = (1 - blend) * Math.sqrt(Math.max(0, 1 - x * x)) + blend * radius * Math.sin(angle);
  const hemisphere = side
    .multiplyScalar(x)
    .addScaledVector(up, y)
    .addScaledVector(stretched, Math.sqrt(Math.max(0, 1 - x * x - y * y)));
  const half = new Vector3(
    a * hemisphere.x,
    a * hemisphere.y,
    Math.max(0, hemisphere.z),
  ).normalize();
  return view.clone().negate().reflect(half);
}
export function tracingMisWeight(own: number, other: number): number {
  return 1 / (1 + (other / Math.max(own, 1e-30)) ** 2);
}
