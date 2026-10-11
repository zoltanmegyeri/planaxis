import { createDecimal } from "@planaxis/geometry";
import { Color, Mesh, Ray, SRGBColorSpace, Vector3 } from "three/webgpu";
import { expect, it } from "vitest";
import { buildApartmentScene } from "../src/apartment-scene.js";
import {
  buildTracingBvh,
  extractTracingTriangles,
  unsupportedTracingInputs,
} from "../src/path-tracing/scene.js";
import type { TracingTriangle } from "../src/path-tracing/scene.js";
import { modelFixture } from "./model-fixture.js";

function physicalHits(
  triangles: readonly TracingTriangle[],
  origin: Vector3,
  direction: Vector3,
): TracingTriangle[] {
  const ray = new Ray(origin, direction);
  return triangles.filter((t) => ray.intersectTriangle(t.a, t.b, t.c, false, new Vector3()));
}

it("extracts actual surfaces, fixed elements and center-plane glazing, excluding markers and cameras", () => {
  const apartment = buildApartmentScene(modelFixture());
  try {
    const triangles = extractTracingTriangles(apartment);
    expect(triangles.some((t) => t.source === "column-1")).toBe(true);
    expect(
      triangles.some(
        (t) => t.source === "light-1" || t.source === "camera-1" || t.source === "door-1",
      ),
    ).toBe(false);
    const glass = triangles.filter((t) => t.glass);
    expect(glass).toHaveLength(2);
    expect(glass.every((t) => t.source === "window-1")).toBe(true);
    for (const t of glass) {
      for (const v of [t.a, t.b, t.c]) {
        expect(v.z).toBeCloseTo(0.05);
        expect(v.y).toBeGreaterThanOrEqual(0.8 - 1e-6);
        expect(v.y).toBeLessThanOrEqual(2 + 1e-6);
      }
    }
    expect(
      physicalHits(triangles, new Vector3(0.25, 1.5, 1), new Vector3(0, 0, -1)).every(
        (t) => t.glass,
      ),
    ).toBe(true);
    expect(physicalHits(triangles, new Vector3(0.65, 1, 1), new Vector3(0, 0, -1))).toHaveLength(0);
    expect(
      physicalHits(triangles, new Vector3(0.45, 1, 1), new Vector3(0, 0, -1)).some((t) => !t.glass),
    ).toBe(true);
  } finally {
    apartment.dispose();
  }
});

it("keeps zero-thickness boundaries two-sided despite overhead culling, with model-space level offsets", () => {
  const model = modelFixture();
  const apartment = buildApartmentScene({
    ...model,
    floor: { ...model.floor, z: createDecimal("300") },
    ceiling: { ...model.ceiling, z: createDecimal("542") },
  });
  try {
    const ceiling = apartment.group.getObjectByName("ceiling");
    if (!(ceiling instanceof Mesh)) throw new Error("Missing ceiling");
    ceiling.visible = false;
    const triangles = extractTracingTriangles(apartment);
    for (const [source, level] of [
      ["floor", 3],
      ["ceiling", 5.42],
    ] as const) {
      const surfaces = triangles.filter((t) => t.source === source);
      expect(surfaces.length).toBeGreaterThan(0);
      for (const t of surfaces) for (const v of [t.a, t.b, t.c]) expect(v.y).toBeCloseTo(level);
      for (const side of [-1, 1])
        expect(
          physicalHits(surfaces, new Vector3(2, level + side, 2), new Vector3(0, -side, 0)).length,
        ).toBeGreaterThan(0);
    }
  } finally {
    apartment.dispose();
  }
});

it("loads valid windowed, sealed and 1 cm partition controls through the full SVG/model pipeline", () => {
  for (const name of ["windowed", "sealed", "thin-wall"]) {
    const model = modelFixture(
      `../projects/daylight-path-tracing-${name}/architecture/apartment.svg`,
    );
    const apartment = buildApartmentScene(model);
    try {
      expect(model.cameras[0]?.id).toBe("interior");
      expect(model.metadata.location?.northHeading.toString()).toBe("270");
      expect(unsupportedTracingInputs(model)).toBeUndefined();
      const triangles = extractTracingTriangles(apartment);
      const hits = physicalHits(
        triangles,
        new Vector3(name === "thin-wall" ? 4 : 3, 1.4, 4),
        new Vector3(0, 0, 1),
      );
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((t) => t.glass)).toBe(name !== "sealed");
      if (name === "thin-wall") {
        const wall = triangles.filter((t) => t.source === "thin-partition");
        for (const [x, direction] of [
          [3, -1],
          [3.2, 1],
        ] as const)
          expect(
            physicalHits(wall, new Vector3(x, 1.5, 2), new Vector3(-direction, 0, 0)).length,
          ).toBeGreaterThan(0);
      }
    } finally {
      apartment.dispose();
    }
  }
});

it("packs a deterministic BVH with every physical triangle and exact leaf/escape links", () => {
  const apartment = buildApartmentScene(modelFixture());
  try {
    const triangles = extractTracingTriangles(apartment);
    const bvh = buildTracingBvh(triangles);
    expect(buildTracingBvh(triangles)).toEqual(bvh);
    expect(bvh.nodeCount).toBe(triangles.length * 2 - 1);
    const leaves = [];
    for (let i = 0; i < bvh.nodeCount; i++) {
      const escape = bvh.nodes[i * 8 + 3]!;
      expect(escape).toBeGreaterThan(i);
      expect(escape).toBeLessThanOrEqual(bvh.nodeCount);
      const triangle = bvh.nodes[i * 8 + 7]!;
      if (triangle >= 0) leaves.push(triangle);
    }
    expect(leaves.sort((a, b) => a - b)).toEqual(triangles.map((_, i) => i));
    expect(bvh.triangles.length).toBe(triangles.length * 16);
    expect(
      Array.from(bvh.triangles).filter((_, i) => i % 16 === 15 && bvh.triangles[i] === 1),
    ).toHaveLength(2);
  } finally {
    apartment.dispose();
  }
});

it("uses effective sRGB matte base colors and explicitly rejects unsupported finishes and glazing", () => {
  const model = modelFixture();
  const matte = { baseColor: [0.5, 0.25, 0.75] as const, roughness: 0.8, metalness: 0 };
  const options: import("../src/runtime-materials.js").RuntimeFinishOptions = {
    assignments: new Map([["floor", matte]]),
  };
  expect(unsupportedTracingInputs(model, options)).toBeUndefined();
  const apartment = buildApartmentScene(model, options);
  try {
    const floor = extractTracingTriangles(apartment).find((t) => t.source === "floor")!;
    expect(floor.color).toEqual(new Color().setRGB(...matte.baseColor, SRGBColorSpace).toArray());
  } finally {
    apartment.dispose();
  }
  for (const update of [
    { metalness: 0.1 },
    { roughness: 0.49 },
    { alpha: { mode: "blend" as const, opacity: 1 } },
    {
      textures: {
        widthCm: createDecimal("1"),
        heightCm: createDecimal("1"),
        baseColorMap: Symbol(),
      },
    },
  ])
    expect(
      unsupportedTracingInputs(model, {
        assignments: new Map([["floor", { ...matte, ...update }]]),
      }),
    ).toContain("Finish floor");
  for (const glassType of ["frosted", "tinted", "other"] as const)
    expect(
      unsupportedTracingInputs({
        ...model,
        windows: model.windows.map((w) => ({ ...w, glassType })),
      }),
    ).toContain("Window window-1");
});
