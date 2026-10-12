import { expect, it, vi } from "vitest";
import { ProgressiveAccumulator } from "../src/path-tracing/progressive.js";
import { navigationSurface } from "./navigation-surface.js";

it("accumulates only the active inputs, pauses without losing the image and resumes the same samples", () => {
  const surface = navigationSurface();
  const draw = vi.fn(),
    changed = vi.fn(),
    failed = vi.fn();
  const accumulation = new ProgressiveAccumulator(
    surface.window as unknown as Window,
    draw,
    changed,
    failed,
  );
  accumulation.setInputs("scene/camera/daylight/buffer");
  accumulation.setActive(true);
  surface.frame(16);
  surface.frame(16);
  expect(draw.mock.calls).toEqual([[0], [1]]);
  accumulation.setPaused(true);
  expect(surface.frames.size).toBe(0);
  surface.frame(16);
  expect(accumulation.samples).toBe(2);
  accumulation.setPaused(false);
  surface.frame(16);
  expect(draw).toHaveBeenLastCalledWith(2);
  expect(accumulation.setInputs("scene/camera/daylight/buffer")).toBe(false);
  expect(accumulation.samples).toBe(3);
  accumulation.setInputs("new-camera");
  surface.frame(16);
  expect(draw).toHaveBeenLastCalledWith(0);
  expect(accumulation.samples).toBe(1);
  accumulation.setActive(false);
  expect(surface.frames.size).toBe(0);
  accumulation.setActive(true);
  accumulation.dispose();
  surface.frame(16);
  expect(draw).toHaveBeenCalledTimes(4);
  expect(failed).not.toHaveBeenCalled();
});

it("cancels failed tracing without a stale sample increment or further scheduled work", () => {
  const surface = navigationSurface();
  const error = new Error("Shader failure");
  const failed = vi.fn();
  const accumulation = new ProgressiveAccumulator(
    surface.window as unknown as Window,
    () => {
      throw error;
    },
    vi.fn(),
    failed,
  );
  accumulation.setActive(true);
  surface.frame(16);
  expect(failed).toHaveBeenCalledExactlyOnceWith(error);
  expect(accumulation.samples).toBe(0);
  expect(surface.frames.size).toBe(0);
});

it("unprojects forward WebGL, forward WebGPU and reversed depth into the same camera rays", async () => {
  const { PerspectiveCamera, Vector3, WebGLCoordinateSystem, WebGPUCoordinateSystem } =
    await import("three/webgpu");
  const { cameraNearClipDepth, cameraRayProjectionKey } =
    await import("../src/path-tracing/projection.js");
  const camera = new PerspectiveCamera(60, 16 / 9, 0.01, 100);
  const rays: number[][] = [];
  const keys: (readonly number[])[] = [];
  for (const [coordinates, reversed] of [
    [WebGLCoordinateSystem, false],
    [WebGPUCoordinateSystem, false],
    [WebGPUCoordinateSystem, true],
  ] as const) {
    camera.coordinateSystem = coordinates;
    // Three's renderer owns this internal depth flag; emulate that documented bridge.
    Object.assign(camera, { _reversedDepth: reversed });
    camera.updateProjectionMatrix();
    const ray = new Vector3(0.3, -0.2, cameraNearClipDepth(camera))
      .applyMatrix4(camera.projectionMatrixInverse)
      .normalize();
    expect(ray.z).toBeLessThan(0);
    rays.push(ray.toArray());
    keys.push(cameraRayProjectionKey(camera));
  }
  for (const ray of rays) ray.forEach((value, i) => expect(value).toBeCloseTo(rays[0]![i]!, 10));
  expect(keys[1]).toEqual(keys[0]);
  expect(keys[2]).toEqual(keys[0]);
  for (const update of [
    { fov: 65 },
    { aspect: 2 },
    { near: 0.1 },
    { far: 200 },
    { filmOffset: 1 },
    { zoom: 2 },
  ]) {
    Object.assign(camera, update);
    camera.updateProjectionMatrix();
    expect(cameraRayProjectionKey(camera)).not.toEqual(keys[0]);
  }
});
