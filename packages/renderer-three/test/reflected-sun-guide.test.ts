import { expect, it } from "vitest";
import { MeshStandardMaterial, Vector3 } from "three/webgpu";
import { buildTracingBvh } from "../src/path-tracing/scene.js";
import { evaluateTracingBsdf } from "../src/path-tracing/bsdf.js";
import {
  reflectedSunPdf,
  reflectedSunRoughness,
  sampleReflectedSun,
} from "../src/path-tracing/sun-guide.js";

it("derives a proposal from actual horizontal smooth-metal triangles, without changing their materials", () => {
  const material = new MeshStandardMaterial({ metalness: 1, roughness: 0.08 });
  const triangle = {
    a: new Vector3(0, 0, 0),
    b: new Vector3(5, 0, 0),
    c: new Vector3(5, 0, 7),
    color: [0.7, 0.7, 0.7] as const,
    glass: false,
    source: "horizontal-reflector",
    material,
  };
  expect(reflectedSunRoughness(buildTracingBvh([triangle]))).toBe(0.08);
  expect(reflectedSunRoughness(buildTracingBvh([{ ...triangle, glass: true }]))).toBe(-1);
  expect(reflectedSunRoughness(buildTracingBvh([{ ...triangle, c: new Vector3(5, 7, 0) }]))).toBe(
    -1,
  );
  material.metalness = 0;
  expect(reflectedSunRoughness(buildTracingBvh([triangle]))).toBe(-1);
  expect(material.roughness).toBe(0.08);
  material.dispose();
});

it("preserves independently known hemisphere and concentrated-cap integrals with a full-support mixture", () => {
  const sun = new Vector3(0.2, 0.9, 0.3).normalize();
  const axis = new Vector3(sun.x, -sun.y, sun.z);
  const cap = Math.cos(0.05),
    expectedCap = 2 * Math.PI * (1 - cap);
  let cosineIntegral = 0,
    capIntegral = 0;
  const n = 200000;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n,
      v = (i * 0.61803398875) % 1;
    const guide = (i * 0.41421356237) % 1 < 0.5;
    const d = guide
      ? sampleReflectedSun(0.08, sun, u, v)
      : new Vector3(
          Math.sqrt(u) * Math.cos(2 * Math.PI * v),
          -Math.sqrt(1 - u),
          Math.sqrt(u) * Math.sin(2 * Math.PI * v),
        );
    if (d.lengthSq() === 0) continue;
    const pdf = 0.5 * (-d.y / Math.PI) + 0.5 * reflectedSunPdf(0.08, sun, d);
    cosineIntegral += -d.y / pdf / n;
    if (d.dot(axis) > cap) capIntegral += 1 / pdf / n;
  }
  expect(cosineIntegral).toBeCloseTo(Math.PI, 2);
  // Analytic spherical-cap solid angle; QMC boundary discretization, not renderer-derived energy.
  expect(Math.abs(capIntegral / expectedCap - 1)).toBeLessThan(0.015);
});

it("reduces the variance of a diffuse receiver's reflected-Sun integral without a material gain", () => {
  const sun = new Vector3(0.2, 0.9, 0.3).normalize();
  const floor = { color: [0.7, 0.7, 0.7], roughness: 0.08, metalness: 1 };
  const localSun = new Vector3(sun.x, sun.z, sun.y);
  const n = 200000;
  const estimates: { mean: number; variance: number }[] = [];
  for (const guided of [false, true]) {
    let sum = 0,
      squares = 0;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n,
        v = (i * 0.61803398875) % 1;
      const d =
        guided && (i * 0.41421356237) % 1 < 0.5
          ? sampleReflectedSun(0.08, sun, u, v)
          : new Vector3(
              Math.sqrt(u) * Math.cos(2 * Math.PI * v),
              -Math.sqrt(1 - u),
              Math.sqrt(u) * Math.sin(2 * Math.PI * v),
            );
      let value = 0;
      if (d.lengthSq() > 0) {
        const density = guided
          ? 0.5 * (-d.y / Math.PI) + 0.5 * reflectedSunPdf(0.08, sun, d)
          : -d.y / Math.PI;
        const f = evaluateTracingBsdf(floor, localSun, new Vector3(-d.x, -d.z, -d.y)).value[0]!;
        value = ((0.7 / Math.PI) * -d.y * f * sun.y) / density;
      }
      sum += value;
      squares += value * value;
    }
    estimates.push({ mean: sum / n, variance: squares / n - (sum / n) ** 2 });
  }
  const [original, guided] = estimates;
  const se = Math.sqrt((original!.variance + guided!.variance) / n);
  expect(Math.abs(original!.mean - guided!.mean)).toBeLessThan(4 * se);
  expect(guided!.variance).toBeLessThan(original!.variance / 100);
});
