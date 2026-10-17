import { expect, it } from "vitest";
import { Vector3 } from "three/webgpu";
import { intersectTracingTriangle } from "../src/path-tracing/intersection.js";

it("hits shared architectural edges from both sides under float32 arithmetic", () => {
  const a = new Vector3(0.2, 0, 0.2),
    b = new Vector3(0.2, 2.6, 0.2);
  const c = new Vector3(0.2, 2.6, 6.8),
    d = new Vector3(0.2, 0, 6.8);
  for (const side of [-1, 1]) {
    const origin = new Vector3(0.2 + side * 8, 1.6, 0.9);
    for (let i = 1; i < 10000; i++) {
      const point = a.clone().lerp(c, i / 10000);
      const direction = point.clone().sub(origin).normalize();
      const first = intersectTracingTriangle(origin, direction, [a, b, c]);
      const second = intersectTracingTriangle(origin, direction, [a, c, d]);
      expect(first ?? second, `side ${side}, edge sample ${i}`).toBeDefined();
      const hit = first ?? second!;
      expect(hit.distance).toBeCloseTo(point.distanceTo(origin), 4);
    }
  }
});
it("preserves barycentrics, zero-distance contacts, parallel rejection and exterior misses", () => {
  const a = new Vector3(),
    b = new Vector3(1, 0, 0),
    c = new Vector3(0, 1, 0);
  const vertices = [a, b, c];
  const hit = intersectTracingTriangle(new Vector3(0.2, 0.3, 1), new Vector3(0, 0, -1), vertices)!;
  expect(hit.distance).toBe(1);
  expect(hit.barycentric[0]).toBeCloseTo(0.2, 6);
  expect(hit.barycentric[1]).toBeCloseTo(0.3, 6);
  expect(
    intersectTracingTriangle(new Vector3(0.2, 0.3, 0.000001), new Vector3(0, 0, -1), vertices)!
      .distance,
  ).toBeCloseTo(0.000001, 10);
  expect(
    intersectTracingTriangle(new Vector3(2, 2, 1), new Vector3(0, 0, -1), vertices),
  ).toBeUndefined();
  expect(
    intersectTracingTriangle(new Vector3(0.2, 0.3, 1), new Vector3(1, 0, 0), vertices),
  ).toBeUndefined();
});

it("keeps near-horizontal rays on a ceiling contact at zero distance", () => {
  const ceiling = Math.fround(2.6);
  const a = new Vector3(0, ceiling, 0),
    b = new Vector3(9, ceiling, 0),
    c = new Vector3(9, ceiling, 7),
    d = new Vector3(0, ceiling, 7);
  for (let i = 1; i < 10000; i++) {
    const origin = new Vector3(
      0.2 + 8.6 * ((i * 0.61803398875) % 1),
      ceiling,
      0.2 + 6.6 * ((i * 0.41421356237) % 1),
    );
    const direction = new Vector3(
      Math.cos(i),
      0.001 + (0.03 * (i % 97)) / 97,
      Math.sin(i),
    ).normalize();
    const first = intersectTracingTriangle(origin, direction, [a, b, c]);
    const second = intersectTracingTriangle(origin, direction, [a, c, d]);
    expect(first ?? second).toBeDefined();
    expect(Math.abs((first ?? second)!.distance)).toBe(0);
  }
});
