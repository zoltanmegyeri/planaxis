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
import { prepareTracingLights, sampleTracingLight } from "../src/path-tracing/luminaires.js";
import type { RuntimeLuminaire } from "../src/runtime-luminaires.js";
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

it("validates the luminaire review architectures and exposes the real baffle and 1 cm sealed partition", () => {
  for (const filename of ["apartment", "windowed"]) {
    const apartment = buildApartmentScene(
      modelFixture(`../projects/path-traced-luminaires/architecture/${filename}.svg`),
    );
    try {
      const triangles = extractTracingTriangles(apartment);
      const baffle = triangles.filter((t) => t.source === "cove-baffle");
      expect(baffle).toHaveLength(12);
      // A floor-to-strip segment crosses the real 5 cm thick baffle.
      const receiver = new Vector3(3.8, 0.01, 3);
      const strip = new Vector3(3.8, 2.1, 0.8);
      const ray = new Ray(receiver, strip.clone().sub(receiver).normalize());
      const hits = baffle
        .map((t) => ray.intersectTriangle(t.a, t.b, t.c, false, new Vector3()))
        .filter((hit) => hit && hit.distanceTo(receiver) < strip.distanceTo(receiver));
      expect(hits.length).toBeGreaterThan(0);
      // Ceiling beyond the baffle has a physically open source route and room route.
      const bounce = new Vector3(3.8, 2.59, 1.5);
      const toStrip = new Ray(bounce, strip.clone().sub(bounce).normalize());
      expect(
        baffle.some((t) => {
          const hit = toStrip.intersectTriangle(t.a, t.b, t.c, false, new Vector3());
          return hit && hit.distanceTo(bounce) < strip.distanceTo(bounce);
        }),
      ).toBe(false);
      const partition = triangles.filter((t) => t.source === "thin-partition");
      expect(
        physicalHits(partition, new Vector3(1, 1.5, 2), new Vector3(1, 0, 0)).length,
      ).toBeGreaterThan(0);
    } finally {
      apartment.dispose();
    }
  }
});

it("checks finite sampled segments for every source against actual opaque architecture and clear panes", () => {
  const apartment = buildApartmentScene(
    modelFixture("../projects/path-traced-luminaires/architecture/windowed.svg"),
  );
  try {
    const triangles = extractTracingTriangles(apartment);
    const common = { positionCm: { x: 330, y: 220, z: 230 }, lumens: 6000, kelvin: 3000 };
    const orientation = { headingDegrees: 0, pitchDegrees: 90, rollDegrees: 25 };
    const sources: RuntimeLuminaire[] = [
      { ...common, type: "point" },
      { ...common, type: "spot", orientation, beamAngleDegrees: 60 },
      { ...common, type: "linear", orientation, lengthCm: 180 },
      { ...common, type: "area", orientation, widthCm: 80, heightCm: 40 },
    ];
    const segmentHits = (origin: Vector3, endpoint: Vector3): TracingTriangle[] => {
      const ray = new Ray(origin, endpoint.clone().sub(origin).normalize());
      return triangles.filter((triangle) => {
        const hit = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, new Vector3());
        return hit !== null && hit.distanceTo(origin) < endpoint.distanceTo(origin);
      });
    };
    for (const source of sources) {
      const light = prepareTracingLights([source]).lights[0]!;
      const endpoint = sampleTracingLight(light, 0.5, 0.5).position;
      const receiver = new Vector3(3.3, 1.5, 3.5);
      expect(segmentHits(receiver, endpoint)).toHaveLength(0);
      // An infinite ray does hit the ceiling beyond the sampled source.
      expect(
        physicalHits(triangles, receiver, endpoint.clone().sub(receiver).normalize()).length,
      ).toBeGreaterThan(0);
      expect(
        segmentHits(new Vector3(1, 1.5, 2.2), endpoint).some(
          (t) => t.source === "thin-partition" && !t.glass,
        ),
      ).toBe(true);
      const blocked = prepareTracingLights([{ ...source, positionCm: { x: 450, y: 220, z: 50 } }])
        .lights[0]!;
      expect(
        segmentHits(
          new Vector3(3.3, 0.5, 3.5),
          sampleTracingLight(blocked, 0.5, 0.5).position,
        ).some((t) => t.source === "shadow-blocker" && !t.glass),
      ).toBe(true);
    }
    const paneHits = segmentHits(new Vector3(4, 1.4, 4), new Vector3(4, 1.4, 5.5));
    expect(paneHits.length).toBeGreaterThan(0);
    expect(paneHits.every((t) => t.glass)).toBe(true);
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
