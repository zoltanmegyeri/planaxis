import { createDecimal as decimal } from "@planaxis/geometry";
import { beforeEach, expect, it, vi } from "vitest";
import type { PerspectiveCamera, Scene } from "three/webgpu";
import { modelFixture } from "./model-fixture.js";

const gpu = vi.hoisted(() => ({
  init: vi.fn<() => Promise<void>>(),
  render: vi.fn(),
  dispose: vi.fn(),
  setSize: vi.fn(),
  setPixelRatio: vi.fn(),
}));
const orbit = vi.hoisted(() => ({
  dispose: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
vi.mock("three/webgpu", async (original) => {
  const actual = await original<typeof import("three/webgpu")>();
  return {
    ...actual,
    WebGPURenderer: class {
      shadowMap = { enabled: false };
      init = gpu.init;
      render = gpu.render;
      dispose = gpu.dispose;
      setSize = gpu.setSize;
      setPixelRatio = gpu.setPixelRatio;
    },
  };
});
vi.mock("three/addons/controls/OrbitControls.js", async () => {
  const { Vector3 } = await import("three/webgpu");
  return {
    OrbitControls: class {
      target = new Vector3();
      enabled = false;
      update(): void {}
      dispose = orbit.dispose;
      addEventListener = orbit.addEventListener;
      removeEventListener = orbit.removeEventListener;
    },
  };
});
import { createApartmentRenderer } from "../src/index.js";

beforeEach(() => {
  vi.clearAllMocks();
  gpu.init.mockResolvedValue();
});
const canvas = {} as HTMLCanvasElement;
it("resizes embedded FOV, caps DPR, replaces models and releases owned resources", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.resize(800, 400, 4);
  renderer.setModel(modelFixture());
  await renderer.initialize();
  renderer.selectCamera("camera-1");
  const camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  const fov = camera.fov;
  renderer.resize(400, 800, 1);
  expect(camera.aspect).toBe(0.5);
  expect(camera.fov).toBeGreaterThan(fov);
  expect(gpu.setPixelRatio).toHaveBeenCalledWith(2);
  expect(gpu.setSize).toHaveBeenCalledWith(400, 800, false);
  const scene = gpu.render.mock.calls.at(-1)?.[0] as Scene;
  const first = scene.children.find((object) => object.type === "Group");
  renderer.setModel(modelFixture());
  expect(first?.children).toHaveLength(0);
  expect(scene.children.filter((object) => object.type === "Group")).toHaveLength(1);
  renderer.selectCamera(null);
  expect(camera.fov).toBe(50);
  renderer.dispose();
  renderer.dispose();
  const count = gpu.render.mock.calls.length;
  renderer.render();
  expect(gpu.render).toHaveBeenCalledTimes(count);
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  expect(orbit.dispose).toHaveBeenCalledTimes(1);
  expect(scene.children).toHaveLength(0);
});
it("defers backend disposal until pending initialization settles and never renders stale models", async () => {
  let finish = (): void => {};
  gpu.init.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  const pending = renderer.initialize();
  renderer.dispose();
  expect(gpu.dispose).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  expect(gpu.render).not.toHaveBeenCalled();
});
it("reports initialization and draw failures", async () => {
  gpu.init.mockRejectedValueOnce(new Error("No rendering backend"));
  const failed = createApartmentRenderer(canvas, vi.fn());
  await expect(failed.initialize()).rejects.toThrow("No rendering backend");
  failed.dispose();
  const onError = vi.fn();
  const renderer = createApartmentRenderer(canvas, onError);
  await renderer.initialize();
  renderer.setModel(modelFixture());
  gpu.render.mockImplementationOnce(() => {
    throw new Error("Draw failed");
  });
  renderer.render();
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Draw failed" }));
  renderer.dispose();
});

it("keeps distant valid embedded cameras within the scene clipping range", async () => {
  const model = modelFixture();
  const source = model.cameras[0];
  if (!source) throw new Error("Missing source camera");
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel({
    ...model,
    cameras: [{ ...source, position: { ...source.position, z: decimal("1000000") } }],
  });
  await renderer.initialize();
  renderer.selectCamera(source.id);
  const camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.far).toBeGreaterThan(10000);
  renderer.dispose();
});
