import { createDecimal } from "@planaxis/geometry";
import type { FinishTargetId, RuntimePbrMaterial } from "@planaxis/model-3d";
import {
  Color,
  DataTexture,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three/webgpu";
import { expect, it, vi } from "vitest";
import { buildApartmentScene } from "../src/apartment-scene.js";
import {
  extractTracingTriangles,
  buildTracingBvh,
  tracingTangentFrame,
  unsupportedTracingInputs,
} from "../src/path-tracing/scene.js";
import { prepareTracingMaterials, effectiveTracingFactors } from "../src/path-tracing/materials.js";
import {
  evaluateTracingBsdf,
  sampleTracingBsdf,
  tracingMisWeight,
} from "../src/path-tracing/bsdf.js";
import { modelFixture } from "./model-fixture.js";

it("retains every map role, factor and native image size without changing shared sources", () => {
  const source = new DataTexture(new Uint8Array(8 * 16 * 4), 8, 16);
  source.flipY = false;
  source.repeat.set(3, 4);
  source.offset.set(0.3, 0.2);
  const normal = new DataTexture(new Uint8Array(4 * 2 * 4), 4, 2);
  const reference = Symbol(),
    normalReference = Symbol();
  const dispose = vi.spyOn(source, "dispose");
  const finish: RuntimePbrMaterial = {
    baseColor: [0.5, 0.25, 0.75],
    roughness: 0.8,
    metalness: 0.6,
    ambientOcclusionStrength: 0.4,
    textures: {
      widthCm: createDecimal("20"),
      heightCm: createDecimal("40"),
      baseColorMap: reference,
      roughnessMap: reference,
      metalnessMap: reference,
      ambientOcclusionMap: reference,
      normalMap: normalReference,
    },
  };
  const scene = buildApartmentScene(modelFixture(), {
    assignments: new Map([["floor", finish]]),
    resolveTexture: (r) => (r === reference ? source : normal),
  });
  const triangle = extractTracingTriangles(scene).find((t) => t.source === "floor")!;
  const material = triangle.material!;
  const input = prepareTracingMaterials([material], 16);
  expect(input.images).toHaveLength(2);
  expect(input.images.map((i) => [i.width, i.height])).toEqual([
    [8, 16],
    [4, 2],
  ]);
  expect(Array.from(input.records).slice(4, 11)).toEqual([
    expect.closeTo(0.6),
    expect.closeTo(0.4),
    0,
    0,
    0,
    1,
    0,
  ]);
  const factors = effectiveTracingFactors(material, {
    baseColor: [0.5, 0.25, 0.75, 0],
    roughness: [0.1, 0.25, 0.9],
    metalness: [0.1, 0.25, 0.9],
    ambientOcclusion: [0.25, 0.9, 0.9],
  });
  const linear = new Color().setRGB(0.5, 0.25, 0.75, SRGBColorSpace).toArray();
  for (let i = 0; i < 3; i++) expect(factors.color[i]).toBeCloseTo(linear[i]! ** 2, 10);
  expect(factors.roughness).toBeCloseTo(0.2);
  expect(factors.metalness).toBeCloseTo(0.54);
  expect(factors.ao).toBeCloseTo(0.7);
  material.aoMapIntensity = 0;
  expect(effectiveTracingFactors(material, { ambientOcclusion: [0] }).ao).toBe(1);
  material.aoMapIntensity = 1;
  expect(effectiveTracingFactors(material, { ambientOcclusion: [1] }).ao).toBe(1);
  expect(source.repeat.toArray()).toEqual([3, 4]);
  expect(source.offset.toArray()).toEqual([0.3, 0.2]);
  expect(source.colorSpace).not.toBe(SRGBColorSpace);
  scene.dispose();
  expect(dispose).not.toHaveBeenCalled();
  source.dispose();
  normal.dispose();
});

it("rejects unavailable image/capacity/alpha inputs without omitting a map", () => {
  const material = new MeshStandardMaterial();
  material.map = new DataTexture(new Uint8Array(4 * 4 * 4), 4, 4);
  expect(() => prepareTracingMaterials([material], 3)).toThrow("capacity");
  const second = new MeshStandardMaterial();
  second.map = new DataTexture(new Uint8Array(4 * 4 * 4), 4, 4);
  expect(() => prepareTracingMaterials([material, second], 4)).toThrow("capacity");
  (material.map.image as { width: number }).width = 0;
  expect(() => prepareTracingMaterials([material], 16)).toThrow("ready");
  material.transparent = true;
  expect(() => prepareTracingMaterials([material], 16)).toThrow("opaque");
});

it("packs ordinary 2K maps tightly instead of allocating device-wide empty rows", () => {
  const materials = Array.from({ length: 9 }, () => {
    const material = new MeshStandardMaterial();
    // Only source headers are needed to verify packing; no large pixel arrays are allocated.
    material.map = new DataTexture(new Uint8Array(4), 2048, 2048);
    return material;
  });
  try {
    const result = prepareTracingMaterials(materials, 16384);
    expect([result.width, result.height]).toEqual([6144, 6144]);
    expect(result.width * result.height).toBe(9 * 2048 ** 2);
    for (const [index, image] of result.images.entries()) {
      expect(image.texture).toBe(materials[index]!.map);
      expect([image.width, image.height]).toEqual([2048, 2048]);
      expect(result.records[index * 12 + 6]).toBe(index);
    }
  } finally {
    for (const material of materials) {
      material.map!.dispose();
      material.dispose();
    }
  }
});

it("retains native sizes/IDs and nonoverlapping regions for mixed 4K, 2K and nonsquare maps", () => {
  const sizes = [
    [600, 600],
    ...Array.from({ length: 3 }, () => [2048, 2048]),
    ...Array.from({ length: 5 }, () => [4096, 4096]),
    ...Array.from({ length: 3 }, () => [2048, 1024]),
    [1000, 333],
  ];
  const materials = sizes.map(([width, height]) => {
    const material = new MeshStandardMaterial();
    material.map = new DataTexture(new Uint8Array(4), width!, height!);
    return material;
  });
  try {
    const input = prepareTracingMaterials(materials, 16384);
    const nativeArea = sizes.reduce((sum, [w, h]) => sum + w! * h!, 0);
    expect(input.width * input.height).toBeLessThan(nativeArea * 1.3);
    for (const [i, image] of input.images.entries()) {
      expect([image.width, image.height]).toEqual(sizes[i]);
      expect(image.x + image.width).toBeLessThanOrEqual(input.width);
      expect(image.y + image.height).toBeLessThanOrEqual(input.height);
      expect(Array.from(input.imageRecords.slice(i * 4, i * 4 + 4))).toEqual([
        image.x,
        image.y,
        ...sizes[i]!,
      ]);
      for (const other of input.images.slice(i + 1))
        expect(
          image.x + image.width <= other.x ||
            other.x + other.width <= image.x ||
            image.y + image.height <= other.y ||
            other.y + other.height <= image.y,
        ).toBe(true);
    }
  } finally {
    for (const material of materials) {
      material.map!.dispose();
      material.dispose();
    }
  }
});

it("keeps barycentric UVs and material groups across actual floor/ceiling overrides and reveals", () => {
  const model = modelFixture();
  const finish: RuntimePbrMaterial = {
    baseColor: [0.8, 0.8, 0.8],
    roughness: 0,
    metalness: 1,
    textures: { widthCm: createDecimal("25"), heightCm: createDecimal("50") },
  };
  const assignments = new Map<FinishTargetId, RuntimePbrMaterial>([
    ["floor", finish],
    ["ceiling", finish],
    ["space:space-1:floor", { ...finish, metalness: 0 }],
    ["wall:wall-1:side-negative", finish],
    ["wall:wall-1:side-positive", finish],
    ["wall:wall-1:opening:window-1:reveal-top", finish],
  ]);
  expect(unsupportedTracingInputs(model, { assignments })).toBeUndefined();
  const scene = buildApartmentScene(model, { assignments });
  try {
    const triangles = extractTracingTriangles(scene),
      floor = triangles.filter((t) => t.source === "floor");
    expect(new Set(floor.map((t) => t.material!.metalness))).toEqual(new Set([0, 1]));
    for (const t of triangles.filter((t) => ["floor", "ceiling"].includes(t.source))) {
      const physical = t.a
        .clone()
        .multiplyScalar(0.2)
        .addScaledVector(t.b, 0.3)
        .addScaledVector(t.c, 0.5);
      const uv = t
        .uv![0].clone()
        .multiplyScalar(0.2)
        .addScaledVector(t.uv![1], 0.3)
        .addScaledVector(t.uv![2], 0.5);
      expect(uv.x).toBeCloseTo(physical.x * 4, 5);
      expect(uv.y).toBeCloseTo(physical.z * 2 * (t.source === "floor" ? 1 : -1), 5);
      expect(t.tangent!.equals(new Vector3(1, 0, 0))).toBe(true);
      expect(t.bitangent!.z).toBe(t.source === "floor" ? 1 : -1);
    }
    const walls = triangles.filter((t) => t.source === "wall-1" && t.material!.metalness === 1);
    expect(walls.some((t) => t.tangent!.x > 0.9)).toBe(true);
    expect(walls.some((t) => t.tangent!.x < -0.9)).toBe(true);
    expect(walls.filter((t) => Math.abs(t.bitangent!.y) > 0.9).length).toBeGreaterThan(2);
    const bvh = buildTracingBvh(triangles);
    expect(bvh.materials).toContain(floor[0]!.material);
  } finally {
    scene.dispose();
  }
});

it("solves asymmetric +U/+V detail independently of winding and stable negative/repeated coordinates", () => {
  const a = new Vector3(0, 0, 0),
    b = new Vector3(1, 0, 0),
    c = new Vector3(0, 0, 1);
  const uv = [new Vector2(-2, -3), new Vector2(2, -3), new Vector2(-2, -1)];
  const frame = tracingTangentFrame(a, b, c, uv),
    reverse = tracingTangentFrame(a, c, b, [uv[0]!, uv[2]!, uv[1]!]);
  expect(reverse.tangent.equals(frame.tangent)).toBe(true);
  expect(reverse.bitangent.equals(frame.bitangent)).toBe(true);
  expect(frame.tangent.toArray()).toEqual([1, 0, 0]);
  expect(frame.bitangent.toArray()).toEqual([0, 0, 1]);
  const geometric = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const original = geometric.clone();
  const neutral = frame.tangent
    .clone()
    .multiplyScalar(0)
    .addScaledVector(frame.bitangent, 0)
    .add(geometric)
    .normalize();
  expect(neutral).toEqual(geometric);
  const detail = frame.tangent
    .clone()
    .multiplyScalar(0.3)
    .addScaledVector(frame.bitangent, 0.4)
    .addScaledVector(geometric, Math.sqrt(0.75));
  expect(detail.x).toBeCloseTo(0.3);
  expect(detail.z).toBeCloseTo(0.4);
  expect(geometric).toEqual(original);
  expect(
    evaluateTracingBsdf(
      { color: [1, 1, 1], metalness: 0, roughness: 0.5 },
      detail,
      new Vector3(0, 1, 0),
      detail,
      geometric,
    ).pdf,
  ).toBe(0);
});

it.each([0, 0.0001, 0.08, 0.35, 0.65, 1])(
  "keeps GGX sampling finite, passive and normalized at roughness %s",
  (roughness) => {
    const view = new Vector3(0, 0, 1);
    for (const metalness of [0, 0.5, 1]) {
      const s = { color: [0.8, 0.6, 0.4], roughness, metalness };
      let energy = 0;
      const count = 16000;
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count,
          v = (i * 0.6180339887498949) % 1,
          lobe = (i * 0.4142135623730951) % 1;
        const light = sampleTracingBsdf(s, view, u, v, lobe),
          e = evaluateTracingBsdf(s, view, light);
        expect(Number.isFinite(e.pdf)).toBe(true);
        if (e.pdf > 0) {
          const weight = (e.value[0]! * light.z) / e.pdf;
          expect(Number.isFinite(weight)).toBe(true);
          energy += weight / count;
        }
      }
      expect(energy).toBeGreaterThan(0.15);
      expect(energy).toBeLessThanOrEqual(1.002);
      if (roughness < 0.001 && metalness === 1) expect(energy).toBeCloseTo(0.8, 2); // polished colored mirror, no diffuse energy
    }
  },
);

it("agrees with independent hemisphere quadrature, is reciprocal and retains glossy source weights", () => {
  const s = { color: [0.7, 0.5, 0.3], roughness: 0.7, metalness: 0.4 },
    view = new Vector3(0, 0, 1);
  let integral = 0,
    estimated = 0;
  const n = 40000;
  for (let i = 0; i < n; i++) {
    const z = (i + 0.5) / n,
      angle = 2 * Math.PI * ((i * 0.61803398875) % 1),
      r = Math.sqrt(1 - z * z);
    const light = new Vector3(r * Math.cos(angle), r * Math.sin(angle), z);
    integral += (evaluateTracingBsdf(s, view, light).value[0]! * z * 2 * Math.PI) / n;
    const sampled = sampleTracingBsdf(s, view, z, (i * 0.61803398875) % 1, (i * 0.41421356237) % 1);
    const e = evaluateTracingBsdf(s, view, sampled);
    if (e.pdf > 0) estimated += (e.value[0]! * sampled.z) / e.pdf / n;
  }
  expect(estimated).toBeCloseTo(integral, 2);
  const light = new Vector3(0.6, 0, 0.8);
  expect(evaluateTracingBsdf(s, view, light).value).toEqual(
    evaluateTracingBsdf(s, light, view).value,
  );
  for (const [a, b] of [
    [0.02, 500],
    [300000, 0.2],
    [1, 1],
  ])
    expect(tracingMisWeight(a!, b!) + tracingMisWeight(b!, a!)).toBeCloseTo(1, 12);
});

it("retains finite GGX evaluation at extremely grazing directions without normal-offset leaks", () => {
  for (const roughness of [0, 0.001, 0.5, 1])
    for (const metalness of [0, 0.5, 1]) {
      const s = { color: [0.8, 0.7, 0.6], roughness, metalness };
      const view = new Vector3(1, 0, 1e-25).normalize(),
        light = new Vector3(-1, 0, 1e-25).normalize();
      const e = evaluateTracingBsdf(s, view, light);
      expect(e.value.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
      expect(Number.isFinite(e.pdf)).toBe(true);
    }
});

it("does not create energy in a white furnace at normal or grazing incidence", () => {
  const count = 20000;
  for (const roughness of [0, 0.08, 0.35, 0.7, 1])
    for (const metalness of [0, 0.5, 1])
      for (const cosine of [1, 0.5, 0.1, 0.01]) {
        const view = new Vector3(Math.sqrt(1 - cosine ** 2), 0, cosine);
        const surface = { color: [1, 1, 1], roughness, metalness };
        let reflected = 0;
        for (let i = 0; i < count; i++) {
          const light = sampleTracingBsdf(
            surface,
            view,
            (i + 0.5) / count,
            (i * 0.6180339887498949) % 1,
            (i * 0.4142135623730951) % 1,
          );
          const evaluation = evaluateTracingBsdf(surface, view, light);
          if (evaluation.pdf > 0)
            reflected += (evaluation.value[0]! * light.z) / evaluation.pdf / count;
        }
        expect(reflected, JSON.stringify({ roughness, metalness, cosine })).toBeLessThanOrEqual(
          1.002,
        );
      }
});
