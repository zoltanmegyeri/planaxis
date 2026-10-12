import { beforeEach, expect, it, vi } from "vitest";
import { DataTexture } from "three";
import { PathTracingBackend } from "../src/path-tracing/backend.js";
import { prepareTracingLights } from "../src/path-tracing/luminaires.js";
import { buildTracingBvh } from "../src/path-tracing/scene.js";
import { Vector3 } from "three/webgpu";

const gpu = vi.hoisted(() => ({ capacity: 1024, upload: vi.fn(), error: 0, disposed: vi.fn() }));
const gl = {
  FRAMEBUFFER: 1,
  FRAMEBUFFER_COMPLETE: 2,
  NO_ERROR: 0,
  getExtension: () => ({}),
  checkFramebufferStatus: () => 2,
  getError: () => gpu.error,
};
vi.mock("three", async (original) => {
  const actual = await original<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      capabilities = { maxTextureSize: gpu.capacity };
      debug = {};
      initTexture = gpu.upload;
      setRenderTarget = vi.fn();
      getContext = () => gl;
      dispose = gpu.disposed;
      forceContextLoss = vi.fn();
    },
  };
});

function backend(): PathTracingBackend {
  const canvas = Object.assign(new EventTarget(), {
    style: {},
    setAttribute: vi.fn(),
    getContext: () => gl,
    remove: vi.fn(),
  });
  return new PathTracingBackend(
    {
      ownerDocument: { createElement: () => canvas },
      parentElement: { append: vi.fn() },
    } as unknown as HTMLCanvasElement,
    vi.fn(),
  );
}
const lights = prepareTracingLights([
  { type: "point", positionCm: { x: 1, y: 2, z: 3 }, lumens: 1000, kelvin: 3000 },
]);
const bvh = buildTracingBvh([
  {
    a: new Vector3(),
    b: new Vector3(1, 0, 0),
    c: new Vector3(0, 1, 0),
    color: [1, 1, 1],
    glass: false,
    source: "triangle",
  },
]);
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  gpu.upload.mockReset();
  gpu.capacity = 1024;
  gpu.error = 0;
});

it("owns uploaded light textures independently of borrowed/replaced architectural data", () => {
  const instance = backend();
  const dispose = vi.spyOn(DataTexture.prototype, "dispose");
  instance.setScene(bvh);
  instance.setLuminaires(lights);
  const first = gpu.upload.mock.calls.at(-1)![0] as DataTexture;
  expect(first.image.data?.slice(0, lights.records.length)).toEqual(lights.records);
  instance.setScene(bvh);
  expect(dispose.mock.contexts).not.toContain(first);
  instance.setLuminaires(prepareTracingLights([]));
  expect(dispose.mock.contexts.filter((texture) => texture === first)).toHaveLength(1);
  instance.dispose();
  instance.dispose();
  expect(dispose).toHaveBeenCalledTimes(6);
  expect(gpu.disposed).toHaveBeenCalledOnce();
});

it("reports actual device capacity without truncation and releases partial upload allocations", () => {
  gpu.capacity = 2;
  const instance = backend();
  const dispose = vi.spyOn(DataTexture.prototype, "dispose");
  expect(() => instance.setLuminaires(lights)).toThrow("texture capacity");
  expect(gpu.upload).not.toHaveBeenCalled();
  instance.dispose();
  const next = backend();
  gpu.error = 1285;
  expect(() => next.setLuminaires(prepareTracingLights([]))).toThrow("upload failed");
  expect(dispose).toHaveBeenCalledOnce();
  next.dispose();
});

it("retains the previous set until a replacement has uploaded successfully", () => {
  const instance = backend();
  instance.setLuminaires(lights);
  const previous = gpu.upload.mock.calls.at(-1)![0];
  const dispose = vi.spyOn(DataTexture.prototype, "dispose");
  gpu.upload.mockImplementationOnce(() => {
    throw new Error("Upload allocation failed");
  });
  expect(() => instance.setLuminaires(prepareTracingLights([]))).toThrow("allocation failed");
  expect(dispose.mock.contexts).not.toContain(previous);
  expect(dispose).toHaveBeenCalledOnce();
  instance.dispose();
  expect(dispose.mock.contexts).toContain(previous);
});
