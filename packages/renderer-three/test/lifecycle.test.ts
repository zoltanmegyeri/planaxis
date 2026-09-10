import { createDecimal as decimal } from "@planaxis/geometry";
import { beforeEach, expect, it, vi } from "vitest";
import type { PerspectiveCamera, Scene } from "three/webgpu";
import { modelFixture } from "./model-fixture.js";
import { navigationSurface } from "./navigation-surface.js";
import { Vector3 } from "three/webgpu";

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
import { fullFrameHorizontalFov, verticalFov } from "../src/cameras.js";

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

it("keeps focal-length overrides independent from camera selection and resize", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.resize(800, 400);
  renderer.setModel(modelFixture());
  await renderer.initialize();
  let camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.fov).toBe(50);

  const inspectionPosition = camera.position.clone();
  renderer.setFocalLengthOverride(35);
  camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(35), 2));
  expect(camera.position).toEqual(inspectionPosition);

  renderer.selectCamera("camera-1");
  camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(35), 2));
  const embeddedPosition = camera.position.clone();

  renderer.resize(400, 800);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(35), 0.5));
  expect(camera.position).toEqual(embeddedPosition);

  renderer.setFocalLengthOverride(null);
  expect(camera.fov).toBeCloseTo(verticalFov(70, 0.5));
  expect(camera.position).toEqual(embeddedPosition);

  renderer.selectCamera(null);
  expect(camera.fov).toBe(50);
  renderer.dispose();
});

it.each([16, 24, 35, 50, 70, 85] as const)(
  "applies the supported %s mm projection",
  async (focalLength) => {
    const renderer = createApartmentRenderer(canvas, vi.fn());
    renderer.resize(900, 600);
    renderer.setModel(modelFixture());
    await renderer.initialize();
    renderer.selectCamera("camera-1");
    renderer.setFocalLengthOverride(focalLength);
    const camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
    expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(focalLength), 1.5));
    renderer.dispose();
  },
);

it("anchors Walk to the first camera in document order at floor + 165 cm with neutral pitch", async () => {
  const model = modelFixture();
  const source = model.cameras[0];
  if (!source) throw new Error("Missing camera fixture");
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.resize(800, 400);
  renderer.setModel({
    ...model,
    floor: { ...model.floor, z: decimal("300") },
    cameras: [
      {
        ...source,
        id: "z-first",
        position: { x: decimal("125"), y: decimal("75"), z: decimal("900") },
        heading: decimal("90"),
        pitch: decimal("45"),
        horizontalFov: decimal("80"),
      },
      { ...source, id: "a-second" },
    ],
  });
  await renderer.initialize();
  renderer.selectWalk();
  const camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.position.toArray()).toEqual([1.25, 4.65, 0.75]);
  expect(camera.getWorldDirection(new Vector3()).toArray()).toEqual([
    expect.closeTo(0),
    expect.closeTo(0),
    expect.closeTo(1),
  ]);
  expect(camera.fov).toBeCloseTo(verticalFov(80, 2));
  expect(surface.frames.size).toBe(0);
  renderer.dispose();
});

it("retains Walk pose and independent projection through view changes and resize, then resets on replacement", async () => {
  const model = modelFixture();
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.setModel(model);
  await renderer.initialize();
  renderer.setFocalLengthOverride(35);
  renderer.selectWalk();
  const camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  surface.key("keydown", "KeyW");
  surface.pointer("pointerdown");
  surface.pointer("pointermove", 100, 100);
  surface.frame(1000);
  const position = camera.position.clone();
  const orientation = camera.quaternion.clone();
  renderer.resize(400, 800);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(35), 0.5));
  expect(camera.position).toEqual(position);
  expect(camera.quaternion.toArray()).toEqual(orientation.toArray());
  for (const id of ["camera-1", null]) {
    renderer.selectCamera(id);
    expect(surface.frames.size).toBe(0);
    expect(surface.key("keydown", "ArrowUp").defaultPrevented).toBe(false);
    renderer.selectWalk();
    expect(camera.position).toEqual(position);
    expect(camera.quaternion.toArray()).toEqual(orientation.toArray());
    expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(35), 0.5));
    surface.pointer("pointermove", 500, 500);
    expect(camera.quaternion.toArray()).toEqual(orientation.toArray());
    surface.frame(1000);
    expect(camera.position).toEqual(position);
  }
  renderer.setFocalLengthOverride(null);
  expect(camera.fov).toBeCloseTo(verticalFov(70, 0.5));
  surface.key("keydown", "ShiftLeft");
  surface.key("keydown", "KeyW");
  surface.pointer("pointerdown");
  const source = model.cameras[0];
  if (!source) throw new Error("Missing camera fixture");
  renderer.setModel({
    ...model,
    cameras: [{ ...source, position: { ...source.position, x: decimal("25") } }],
  });
  expect(surface.frames.size).toBe(0);
  expect(camera.fov).toBe(50);
  renderer.selectWalk();
  expect(camera.position.toArray()).toEqual([0.25, 1.65, 0.5]);
  const resetOrientation = camera.quaternion.clone();
  surface.pointer("pointermove", 500, 500);
  expect(camera.quaternion.toArray()).toEqual(resetOrientation.toArray());
  surface.key("keydown", "KeyW", { repeat: true });
  expect(surface.frames.size).toBe(0);
  surface.key("keydown", "KeyW");
  surface.frame(1000);
  expect(camera.position.z).toBeCloseTo(-1);
  renderer.dispose();
  expect(surface.frames.size).toBe(0);
  const renders = gpu.render.mock.calls.length;
  surface.key("keydown", "KeyW");
  surface.pointer("pointerdown");
  surface.pointer("pointermove", 500, 500);
  surface.frame(1000);
  expect(gpu.render).toHaveBeenCalledTimes(renders);
});

it("rejects Walk without an embedded camera and keeps inspection available", async () => {
  const renderer = createApartmentRenderer(navigationSurface().canvas, vi.fn());
  renderer.setModel({ ...modelFixture(), cameras: [] });
  await renderer.initialize();
  const camera = gpu.render.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  const inspection = camera.position.clone();
  expect(() => renderer.selectWalk()).toThrow("Free walk requires at least one camera");
  renderer.resize(800, 400);
  expect(camera.position).toEqual(inspection);
  expect(camera.fov).toBe(50);
  renderer.dispose();
});
