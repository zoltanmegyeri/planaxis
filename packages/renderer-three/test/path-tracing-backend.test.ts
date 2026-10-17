import { beforeEach, expect, it, vi } from "vitest";
import {
  DataTexture,
  FloatType,
  MeshStandardMaterial,
  Mesh,
  Scene,
  ShaderMaterial,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
} from "three";
import { PathTracingBackend } from "../src/path-tracing/backend.js";
import { prepareTracingLights } from "../src/path-tracing/luminaires.js";
import { buildTracingBvh } from "../src/path-tracing/scene.js";
import { Color, PerspectiveCamera, Vector3 } from "three/webgpu";

const gpu = vi.hoisted(() => ({
  capacity: 1024,
  upload: vi.fn(),
  error: 0,
  disposed: vi.fn(),
  render: vi.fn(),
  target: vi.fn(),
  status: 2,
  read: vi.fn(),
}));
const gl = {
  FRAMEBUFFER: 1,
  FRAMEBUFFER_COMPLETE: 2,
  NO_ERROR: 0,
  OUT_OF_MEMORY: 1285,
  getExtension: () => ({}),
  checkFramebufferStatus: () => gpu.status,
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
      readRenderTargetPixels = gpu.read;
      setRenderTarget = gpu.target;
      setScissorTest = vi.fn();
      setViewport = vi.fn();
      setScissor = vi.fn();
      clear = vi.fn();
      render = gpu.render;
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
  gpu.status = 2;
});

it("stores decoded byte maps in RGBA8 and preserves non-byte runtime image precision", () => {
  const instance = backend();
  const material = new MeshStandardMaterial();
  const source = new DataTexture(new Uint8Array([128, 64, 32, 0]), 1, 1);
  material.map = source;
  instance.setScene({ ...bvh, materials: [material] });
  const first = gpu.target.mock.calls.find(
    ([target]) => target?.width === 1 && target.texture.type === UnsignedByteType,
  )?.[0] as WebGLRenderTarget;
  expect(first.texture.type).toBe(UnsignedByteType);
  expect(first.texture.colorSpace).toBe(NoColorSpace);
  expect(first.texture.generateMipmaps).toBe(false);
  const floatSource = new DataTexture(
    new Float32Array([0.123456, 0.654321, 0.5, 1]),
    1,
    1,
    RGBAFormat,
    FloatType,
  );
  material.map = floatSource;
  gpu.target.mockClear();
  instance.setScene({ ...bvh, materials: [material] });
  const next = gpu.target.mock.calls.find(
    ([target]) => target?.texture.type === FloatType,
  )?.[0] as WebGLRenderTarget;
  expect(next.texture.type).toBe(FloatType);
  expect((gpu.upload.mock.calls.at(-1)![0] as DataTexture).image.data).toBe(floatSource.image.data);
  instance.dispose();
  source.dispose();
  floatSource.dispose();
  material.dispose();
});

it("reports image allocation size/cause and releases only the failed replacement", () => {
  const instance = backend();
  instance.setScene(bvh);
  const previous = gpu.target.mock.calls.find(
    ([target]) => target?.texture.type === UnsignedByteType,
  )?.[0] as WebGLRenderTarget;
  const disposePrevious = vi.spyOn(previous, "dispose");
  const material = new MeshStandardMaterial();
  // Metadata-sized input; the mocked backend never uploads its pixels.
  material.map = new DataTexture(new Uint8Array(4), 1024, 1024);
  gpu.status = 0x8cd6;
  expect(() => instance.setScene({ ...bvh, materials: [material] })).toThrow(
    /1 images, 1024 × 1024, 4 MiB.*Framebuffer status 0x8cd6.*Interactive remains available/,
  );
  expect(disposePrevious).not.toHaveBeenCalled();
  gpu.status = 2;
  // Trigger memory failure specifically during atlas allocation, after record uploads.
  gpu.target.mockImplementationOnce(() => {
    gpu.error = gl.OUT_OF_MEMORY;
  });
  expect(() => instance.setScene({ ...bvh, materials: [material] })).toThrow(
    "GPU reported out of memory",
  );
  expect(disposePrevious).not.toHaveBeenCalled();
  gpu.error = 0;
  instance.dispose();
  expect(disposePrevious).toHaveBeenCalledOnce();
  material.map.dispose();
  material.dispose();
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
  expect(dispose).toHaveBeenCalledTimes(10);
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

it("keeps the complete old scene until material upload succeeds and releases partial GPU resources", () => {
  const instance = backend();
  instance.setScene(bvh);
  const previous = gpu.upload.mock.calls.map((call) => call[0]);
  const dispose = vi.spyOn(DataTexture.prototype, "dispose");
  gpu.upload
    .mockImplementationOnce(() => undefined)
    .mockImplementationOnce(() => undefined)
    .mockImplementationOnce(() => {
      throw new Error("Material upload failed");
    });
  expect(() => instance.setScene(bvh)).toThrow("Material upload failed");
  for (const texture of previous) expect(dispose.mock.contexts).not.toContain(texture);
  expect(dispose).toHaveBeenCalledTimes(3);
  instance.dispose();
  for (const texture of previous) expect(dispose.mock.contexts).toContain(texture);
});

it("owns raw image copies in its context, cleans failed copies and leaves borrowed pixels/transforms intact", () => {
  const instance = backend();
  const source = new DataTexture(new Uint8Array([128, 64, 32, 0]), 1, 1);
  source.flipY = false;
  source.offset.set(0.4, 0.7);
  source.repeat.set(2, 3);
  const material = new MeshStandardMaterial();
  material.map = source;
  material.roughnessMap = source;
  material.metalnessMap = source;
  material.aoMap = source;
  const input = { ...bvh, materials: [material] };
  const disposed = vi.spyOn(source, "dispose"),
    targets = vi.spyOn(WebGLRenderTarget.prototype, "dispose");
  const sourceVersion = source.source.version;
  instance.setScene(input);
  expect(source.source.version).toBe(sourceVersion);
  expect(gpu.render).toHaveBeenCalledOnce();
  expect(source.repeat.toArray()).toEqual([2, 3]);
  expect(source.offset.toArray()).toEqual([0.4, 0.7]);
  gpu.render.mockImplementationOnce(() => {
    throw new Error("Image upload failed");
  });
  expect(() => instance.setScene(input)).toThrow("Image upload failed");
  expect(targets).toHaveBeenCalledOnce();
  expect(disposed).not.toHaveBeenCalled();
  instance.dispose();
  expect(disposed).not.toHaveBeenCalled();
  expect(targets).toHaveBeenCalledTimes(4);
  source.dispose();
  material.dispose();
});

it("validates finite daylight/path inputs atomically and reads retained HDR before presentation", () => {
  const instance = backend();
  const direction = new Vector3(0, 1, 0),
    sun = new Color(100, 90, 80),
    sky = new Color(4, 5, 6);
  instance.setDaylight(direction, sun, sky, sky);
  for (const color of [new Color(NaN, 1, 1), new Color(-1, 1, 1), new Color(1e35, 1, 1)])
    expect(() => instance.setDaylight(direction, color, sky, sky)).toThrow("numeric capacity");
  expect(() => instance.setDaylight(new Vector3(), sun, sky, sky)).toThrow("direction");
  instance.setPathLimits({ opaque: 32, total: 96, roulette: false, sunGuiding: false });
  for (const limits of [
    { opaque: 33, total: 96, roulette: true },
    { opaque: 16, total: 8, roulette: true },
    { opaque: 8, total: Infinity, roulette: true },
  ])
    expect(() => instance.setPathLimits(limits)).toThrow(RangeError);
  let retained: ShaderMaterial["uniforms"] | undefined;
  gpu.render.mockImplementation((scene: Scene) => {
    const material = (scene.children[0] as Mesh).material as ShaderMaterial;
    if (material.uniforms.sunIrradiance) retained = material.uniforms;
  });
  instance.trace(new PerspectiveCamera(), 0);
  const uniforms = retained!;
  expect(uniforms.sunIrradiance!.value).toBe(sun);
  // The shared camera/reflection/diffuse escape environment must not turn black below
  // the horizon. The upper-only boundary remains an explicit historical control.
  expect(uniforms.upperSkyOnly!.value).toBe(false);
  instance.setDaylight(direction, sun, sky, sky, true);
  expect(uniforms.upperSkyOnly!.value).toBe(true);
  instance.setDaylight(direction, sun, sky, sky);
  expect(uniforms.upperSkyOnly!.value).toBe(false);
  expect(uniforms.opaqueLimit!.value).toBe(32);
  expect(uniforms.interactionLimit!.value).toBe(96);
  expect(uniforms.rouletteEnabled!.value).toBe(false);
  expect(uniforms.sunGuiding!.value).toBe(false);
  gpu.read.mockImplementation((_target, _x, _y, _width, _height, pixels: Float32Array) => {
    pixels.set([12, 8, 4, 1]);
  });
  expect(instance.readLinearImage(1)).toEqual(new Float32Array([12, 8, 4, 1]));
  expect(gpu.read.mock.calls.at(-1)![0]).toBe(
    gpu.target.mock.calls.find(([target]) => target?.texture.type === FloatType)![0],
  );
  expect(() => instance.readLinearImage(0)).toThrow(RangeError);
  gpu.read.mockImplementation((_target, _x, _y, _width, _height, pixels: Float32Array) => {
    pixels[0] = NaN;
  });
  expect(() => instance.readLinearImage(1)).toThrow("nonfinite");
  instance.dispose();
  expect(() => instance.readLinearImage(1)).toThrow(RangeError);
});
