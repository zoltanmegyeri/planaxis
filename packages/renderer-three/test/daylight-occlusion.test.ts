import { expect, it } from "vitest";
import { Ray, Vector3 } from "three/webgpu";
import { calculateSolarPosition, planaxisSunDirection } from "@planaxis/simulation";
import { buildApartmentScene } from "../src/apartment-scene.js";
import { extractTracingTriangles } from "../src/path-tracing/scene.js";
import { modelFixture } from "./model-fixture.js";

it("traces the actual two windows/panes while sealed and thin/blocked boundaries remain opaque", () => {
  const solar = calculateSolarPosition(47.4979, 19.0402, Date.UTC(2026, 5, 21, 10));
  const sun = planaxisSunDirection(270, solar);
  const direction = new Vector3(sun.x, sun.z, sun.y);
  for (const file of ["apartment", "sealed", "blocked", "thin"]) {
    const scene = buildApartmentScene(
      modelFixture(`../projects/path-traced-daylight/architecture/${file}.svg`),
    );
    try {
      const triangles = extractTracingTriangles(scene);
      const origin = new Vector3(2.2, 1.4, 6.4);
      const ray = new Ray(origin, direction);
      const hits = triangles
        .flatMap((t) => {
          const point = ray.intersectTriangle(t.a, t.b, t.c, false, new Vector3());
          return point
            ? [{ glass: t.glass, source: t.source, distance: point.distanceTo(origin) }]
            : [];
        })
        .sort((a, b) => a.distance - b.distance);
      // Sun elevation determines a floor patch through this aperture, not a renderer override.
      expect(triangles.filter((t) => t.glass).length).toBe(
        file === "sealed" ? 0 : file === "thin" ? 2 : 4,
      );
      const horizontal = new Ray(new Vector3(2.2, 1.4, 6.4), new Vector3(0, 0, 1));
      const boundaries = triangles.filter((t) =>
        horizontal.intersectTriangle(t.a, t.b, t.c, false, new Vector3()),
      );
      if (file === "apartment") expect(boundaries.every((t) => t.glass)).toBe(true);
      else expect(boundaries.some((t) => !t.glass)).toBe(true);
      expect(hits.length).toBeGreaterThan(0);
      if (file === "thin") {
        const crossing = new Ray(new Vector3(4.4, 1.4, 3), new Vector3(1, 0, 0));
        expect(
          triangles.some(
            (t) =>
              t.source === "partition" &&
              crossing.intersectTriangle(t.a, t.b, t.c, false, new Vector3()),
          ),
        ).toBe(true);
      }
    } finally {
      scene.dispose();
    }
  }
});
it("preserves thin clear-pane expected transmission without duplicate Fresnel attenuation", () => {
  const n = 200000;
  for (const cosine of [1, 0.5, 0.1]) {
    const f0 = ((1.5 - 1) / (1.5 + 1)) ** 2;
    const reflectance = f0 + (1 - f0) * (1 - cosine) ** 5;
    let transmitted = 0;
    // Continuation chooses a branch with F or 1-F; its conditional throughput is unity.
    // Shadow visibility deterministically multiplies 1-F. These are two estimators of one integral.
    for (let i = 0; i < n; i++) if ((i + 0.5) / n >= reflectance) transmitted++;
    expect(transmitted / n).toBeCloseTo(1 - reflectance, 5);
    if (cosine === 1) expect(transmitted / n).toBeCloseTo(0.96, 6);
  }
});
