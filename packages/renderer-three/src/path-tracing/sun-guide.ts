import { Vector3 } from "three/webgpu";
import type { TracingBvh } from "./scene.js";
import { evaluateTracingBsdf, sampleTracingBsdf } from "./bsdf.js";

/** A proposal only: all sampled paths still intersect the real architecture/materials.
 * A horizontal smooth metal can concentrate Sun onto diffuse surfaces. Reverse its visible-GGX
 * distribution to propose those otherwise rare directions, without changing any BSDF or light.
 */
export function reflectedSunRoughness(bvh: TracingBvh): number {
  let roughness = -1;
  const t = bvh.triangles;
  for (let i = 0; i < t.length; i += 28) {
    if (t[i + 7]! > 0.5) continue;
    const material = bvh.materials[t[i + 3]!]!;
    if (material.metalness <= 0.5 || material.roughness > 0.35) continue;
    const a = new Vector3(t[i]!, t[i + 1]!, t[i + 2]!);
    const b = new Vector3(t[i + 4]!, t[i + 5]!, t[i + 6]!);
    const c = new Vector3(t[i + 8]!, t[i + 9]!, t[i + 10]!);
    const normal = b.sub(a).cross(c.sub(a));
    if (normal.lengthSq() === 0 || Math.abs(normal.normalize().y) < 0.999999) continue;
    if (roughness < 0 || material.roughness < roughness) roughness = material.roughness;
  }
  return roughness;
}

/** Numerical PDF/sampling reference in renderer coordinates (Y up). */
export function reflectedSunPdf(roughness: number, sun: Vector3, direction: Vector3): number {
  return evaluateTracingBsdf(
    { color: [1, 1, 1], roughness, metalness: 1 },
    new Vector3(sun.x, sun.z, sun.y),
    new Vector3(-direction.x, -direction.z, -direction.y),
  ).pdf;
}
export function sampleReflectedSun(roughness: number, sun: Vector3, u: number, v: number): Vector3 {
  const sample = sampleTracingBsdf(
    { color: [1, 1, 1], roughness, metalness: 1 },
    new Vector3(sun.x, sun.z, sun.y),
    u,
    v,
    0,
  );
  // Invalid below-reflector samples are absorption, never resampled or assigned another PDF.
  return sample.z <= 0 ? new Vector3() : new Vector3(-sample.x, -sample.z, -sample.y);
}
