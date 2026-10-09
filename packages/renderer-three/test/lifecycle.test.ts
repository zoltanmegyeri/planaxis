import * as simulation from "@planaxis/simulation";
import { createDecimal as decimal } from "@planaxis/geometry";
import { beforeEach, expect, it, vi } from "vitest";
import type { PerspectiveCamera, Scene, WebGPURenderer } from "three/webgpu";
import { modelFixture } from "./model-fixture.js";
import { navigationSurface } from "./navigation-surface.js";
import {
  Vector3,
  DataTexture,
  Mesh,
  MeshStandardMaterial,
  Color,
  DirectionalLight,
  AgXToneMapping,
  ACESFilmicToneMapping,
  NeutralToneMapping,
  RenderTarget,
  FloatType,
  AmbientLight,
  PCFShadowMap,
} from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const gpu = vi.hoisted(() => ({
  nativeWebgpu: false,
  device: undefined as GPUDevice | undefined,
  vxgis: [] as ReturnType<typeof import("three/addons/lighting/vxgi/VXGINode.js").vxgi>[],
  temporals: [] as ReturnType<typeof import("three/addons/tsl/display/TRAANode.js").traa>[],
  init: vi.fn<() => Promise<void>>(),
  pipelineRender: vi.fn(),
  directRender: vi.fn(),
  pipelines: [] as import("three/webgpu").RenderPipeline[],
  passes: [] as ReturnType<typeof import("three/tsl").pass>[],
  blooms: [] as ReturnType<typeof import("three/addons/tsl/display/BloomNode.js").bloom>[],
  dispose: vi.fn(),
  setSize: vi.fn(),
  setPixelRatio: vi.fn(),
  instances: [] as WebGPURenderer[],
  options: vi.fn(),
  environmentDispose: vi.fn(),
  generatorDispose: vi.fn(),
  fromScene: vi.fn(),
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
    RenderPipeline: class extends actual.RenderPipeline {
      constructor(...args: ConstructorParameters<typeof actual.RenderPipeline>) {
        super(...args);
        gpu.pipelines.push(this);
      }
      override render(): void {
        const scenePass = gpu.passes.at(-1);
        gpu.pipelineRender(scenePass?.scene, scenePass?.camera, this.renderer.getRenderTarget());
      }
    },
    PMREMGenerator: class {
      fromScene = gpu.fromScene;
      dispose = gpu.generatorDispose;
    },
    WebGPURenderer: class {
      constructor(options: object) {
        gpu.options(options);
        gpu.instances.push(this as unknown as WebGPURenderer);
      }
      backend = { isWebGPUBackend: gpu.nativeWebgpu, device: gpu.device };
      _nodes = { nodeFrame: { update: vi.fn() } };
      samples = 4;
      shadowMap = { enabled: false };
      init = gpu.init;
      render = gpu.directRender;
      dispose = gpu.dispose;
      setSize = gpu.setSize;
      setPixelRatio = gpu.setPixelRatio;
      target: RenderTarget | null = null;
      getRenderTarget(): RenderTarget | null {
        return this.target;
      }
      setRenderTarget(target: RenderTarget | null): void {
        this.target = target;
      }
    },
  };
});
vi.mock("three/tsl", async (original) => {
  const actual = await original<typeof import("three/tsl")>();
  return {
    ...actual,
    pass: (...args: Parameters<typeof actual.pass>) => {
      const result = actual.pass(...args);
      gpu.passes.push(result);
      return result;
    },
  };
});
vi.mock("three/addons/tsl/display/BloomNode.js", async (original) => {
  const actual = await original<typeof import("three/addons/tsl/display/BloomNode.js")>();
  return {
    ...actual,
    bloom: (...args: Parameters<typeof actual.bloom>) => {
      const result = actual.bloom(...args);
      gpu.blooms.push(result);
      return result;
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
vi.mock("three/addons/lighting/vxgi/VXGINode.js", async (original) => {
  const actual = await original<typeof import("three/addons/lighting/vxgi/VXGINode.js")>();
  return {
    ...actual,
    vxgi: (...args: Parameters<typeof actual.vxgi>) => {
      const result = actual.vxgi(...args);
      gpu.vxgis.push(result);
      return result;
    },
  };
});
vi.mock("three/addons/tsl/display/TRAANode.js", async (original) => {
  const actual = await original<typeof import("three/addons/tsl/display/TRAANode.js")>();
  return {
    ...actual,
    traa: (...args: Parameters<typeof actual.traa>) => {
      const result = actual.traa(...args);
      gpu.temporals.push(result);
      return result;
    },
  };
});
import {
  createApartmentRenderer,
  DEFAULT_PRESENTATION_SETTINGS,
  DEFAULT_QUALITY_SETTINGS,
  DEFAULT_POST_PROCESSING_SETTINGS,
} from "../src/index.js";
import type { RendererPresentationSettings } from "../src/index.js";
import { fullFrameHorizontalFov, verticalFov } from "../src/cameras.js";
import type { RendererQualitySettings } from "../src/index.js";

beforeEach(() => {
  vi.clearAllMocks();
  gpu.init.mockResolvedValue();
  gpu.nativeWebgpu = false;
  gpu.device = undefined;
  gpu.vxgis.length = 0;
  gpu.temporals.length = 0;
  gpu.instances.length = 0;
  gpu.pipelines.length = 0;
  gpu.passes.length = 0;
  gpu.blooms.length = 0;
  gpu.fromScene.mockImplementation(
    (_room, _sigma, _near, _far, options: { renderTarget: RenderTarget }) => {
      options.renderTarget.addEventListener("dispose", gpu.environmentDispose);
      return options.renderTarget;
    },
  );
});
const canvas = {} as HTMLCanvasElement;
it("resizes embedded FOV, applies selected DPR, replaces models and releases owned resources", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.resize(800, 400);
  renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, pixelRatio: 4 });
  renderer.setModel(modelFixture());
  await renderer.initialize();
  renderer.selectCamera("camera-1");
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  const fov = camera.fov;
  renderer.resize(400, 800);
  expect(camera.aspect).toBe(0.5);
  expect(camera.fov).toBeGreaterThan(fov);
  expect(gpu.setPixelRatio).toHaveBeenCalledWith(4);
  expect(gpu.setSize).toHaveBeenCalledWith(400, 800, false);
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const first = scene.children.find((object) => object.name === "apartment-architecture");
  renderer.setModel(modelFixture());
  expect(first?.children).toHaveLength(0);
  expect(scene.children.filter((object) => object.name === "apartment-architecture")).toHaveLength(
    1,
  );
  renderer.selectCamera(null);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(50), camera.aspect));
  renderer.dispose();
  renderer.dispose();
  const count = gpu.pipelineRender.mock.calls.length;
  renderer.render();
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(count);
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
  const pipelineDispose = vi.spyOn(gpu.pipelines[0]!, "dispose");
  const bloomDispose = vi.spyOn(gpu.blooms[0]!, "dispose");
  const passDispose = vi.spyOn(gpu.passes[0]!, "dispose");
  renderer.dispose();
  expect(gpu.dispose).not.toHaveBeenCalled();
  expect(pipelineDispose).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  expect(pipelineDispose).toHaveBeenCalledTimes(1);
  expect(bloomDispose).toHaveBeenCalledTimes(1);
  expect(passDispose).toHaveBeenCalledTimes(1);
  expect(gpu.pipelineRender).not.toHaveBeenCalled();
  expect(gpu.fromScene).not.toHaveBeenCalled();
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
  gpu.pipelineRender.mockImplementationOnce(() => {
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
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.far).toBeGreaterThan(10000);
  renderer.dispose();
});

it("replaces manual focal overrides on camera selection and preserves them on resize", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.resize(800, 400);
  renderer.setModel(modelFixture());
  await renderer.initialize();
  let camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(50), camera.aspect));

  const inspectionPosition = camera.position.clone();
  renderer.setFocalLengthOverride(35);
  camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(35), 2));
  expect(camera.position).toEqual(inspectionPosition);

  renderer.selectCamera("camera-1");
  camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.fov).toBeCloseTo(verticalFov(70, 2));
  const embeddedPosition = camera.position.clone();
  renderer.setFocalLengthOverride(35);

  renderer.resize(400, 800);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(35), 0.5));
  expect(camera.position).toEqual(embeddedPosition);

  renderer.setFocalLengthOverride(null);
  expect(camera.fov).toBeCloseTo(verticalFov(70, 0.5));
  expect(camera.position).toEqual(embeddedPosition);

  renderer.selectCamera(null);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(50), camera.aspect));
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
    const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
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
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  expect(camera.position.toArray()).toEqual([1.25, 4.65, 0.75]);
  expect(camera.getWorldDirection(new Vector3()).toArray()).toEqual([
    expect.closeTo(0),
    expect.closeTo(0),
    expect.closeTo(1),
  ]);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(16), 2));
  expect(surface.frames.size).toBe(0);
  renderer.dispose();
});

it("retains Walk pose and independent projection through view changes and resize, then resets on replacement", async () => {
  const model = modelFixture();
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.setModel(model);
  await renderer.initialize();
  renderer.selectWalk();
  renderer.setFocalLengthOverride(35);
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
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
    expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(16), 0.5));
    surface.pointer("pointermove", 500, 500);
    expect(camera.quaternion.toArray()).toEqual(orientation.toArray());
    surface.frame(1000);
    expect(camera.position).toEqual(position);
  }
  renderer.setFocalLengthOverride(null);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(16), 0.5));
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
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(50), camera.aspect));
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
  const renders = gpu.pipelineRender.mock.calls.length;
  surface.key("keydown", "KeyW");
  surface.pointer("pointerdown");
  surface.pointer("pointermove", 500, 500);
  surface.frame(1000);
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(renders);
});

it("rejects Walk without an embedded camera and keeps inspection available", async () => {
  const renderer = createApartmentRenderer(navigationSurface().canvas, vi.fn());
  renderer.setModel({ ...modelFixture(), cameras: [] });
  await renderer.initialize();
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  const inspection = camera.position.clone();
  expect(() => renderer.selectWalk()).toThrow("Free walk requires at least one camera");
  renderer.resize(800, 400);
  expect(camera.position).toEqual(inspection);
  expect(camera.fov).toBeCloseTo(verticalFov(fullFrameHorizontalFov(50), camera.aspect));
  renderer.dispose();
});

it("replaces transient finishes, disposes their textures, and retains the scene after a failed replacement", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  const model = modelFixture();
  const reference = Symbol();
  const source = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const finishes = {
    assignments: new Map([
      [
        "floor" as const,
        {
          baseColor: [1, 1, 1] as const,
          roughness: 0.4,
          metalness: 0,
          textures: { widthCm: decimal("50"), heightCm: decimal("50"), baseColorMap: reference },
        },
      ],
    ]),
    resolveTexture: () => source,
  };
  renderer.setModel(model, finishes);
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const floor = scene.getObjectByName("floor");
  if (
    !(floor instanceof Mesh) ||
    !(floor.material instanceof MeshStandardMaterial) ||
    !floor.material.map
  )
    throw new Error("Missing mapped floor.");
  const textureDispose = vi.spyOn(floor.material.map, "dispose");
  const materialDispose = vi.spyOn(floor.material, "dispose");
  expect(() =>
    renderer.setModel(model, {
      ...finishes,
      resolveTexture: () => {
        throw new Error("Unavailable texture");
      },
    }),
  ).toThrow("Unavailable texture");
  expect(scene.getObjectByName("floor")).toBe(floor);
  expect(textureDispose).not.toHaveBeenCalled();
  renderer.selectCamera("camera-1");
  renderer.resize(400, 300);
  renderer.setModel(model);
  expect(textureDispose).toHaveBeenCalledTimes(1);
  expect(materialDispose).toHaveBeenCalledTimes(1);
  const replacement = scene.getObjectByName("floor");
  if (!(replacement instanceof Mesh) || !(replacement.material instanceof MeshStandardMaterial))
    throw new Error("Missing neutral floor.");
  expect(replacement.material.map).toBeNull();
  renderer.dispose();
  expect(textureDispose).toHaveBeenCalledTimes(1);
  source.dispose();
});

it("creates IBL once while keeping the neutral background and deterministic shadow light", async () => {
  const roomDispose = vi.spyOn(RoomEnvironment.prototype, "dispose");
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  expect(gpu.fromScene).not.toHaveBeenCalled();
  await renderer.initialize();
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  expect(scene.environment).toBe(gpu.fromScene.mock.results[0]?.value.texture);
  expect(scene.background).toEqual(new Color(0xe8ecec));
  expect(scene.environmentIntensity).toBe(1);
  expect(scene.environmentRotation.toArray()).toEqual([0, 0, 0, "XYZ"]);
  expect(scene.children.some((object) => object.type === "HemisphereLight")).toBe(false);
  const light = scene.children.find((object) => object instanceof DirectionalLight);
  expect(light).toBeInstanceOf(DirectionalLight);
  if (!(light instanceof DirectionalLight)) throw new Error("Missing key light");
  expect(light.intensity).toBe(3);
  expect(light.castShadow).toBe(true);
  expect(light.shadow.mapSize.toArray()).toEqual([2048, 2048]);
  expect(light.shadow.camera.far).toBeGreaterThan(light.shadow.camera.near);
  expect(light.position.y).toBeGreaterThan(light.target.position.y);
  expect(gpu.instances[0]?.toneMapping).toBe(AgXToneMapping);
  expect(gpu.instances[0]?.toneMappingExposure).toBe(1);
  expect(gpu.fromScene).toHaveBeenCalledTimes(1);
  expect(gpu.generatorDispose).toHaveBeenCalledTimes(1);
  expect(roomDispose).toHaveBeenCalledTimes(1);
  expect(gpu.environmentDispose).not.toHaveBeenCalled();
  renderer.dispose();
  renderer.dispose();
  expect(scene.environment).toBeNull();
  expect(gpu.environmentDispose).toHaveBeenCalledTimes(1);
  roomDispose.mockRestore();
});

it("applies presentation in one frame without rebuilding or starting an idle loop, retaining it through view changes", async () => {
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.setModel(modelFixture());
  const settings: RendererPresentationSettings = {
    environmentIntensity: 2.3,
    environmentRotationDegrees: 450,
    toneMapping: "ACES Filmic",
    exposureEv: 2,
  };
  renderer.setPresentationSettings(settings);
  expect(gpu.pipelineRender).not.toHaveBeenCalled();
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const environment = scene.environment;
  const floor = scene.getObjectByName("floor");
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  const position = camera.position.clone();
  const renders = gpu.pipelineRender.mock.calls.length;
  renderer.setPresentationSettings({ ...settings, toneMapping: "Neutral" });
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(renders + 1);
  expect(gpu.instances[0]?.toneMapping).toBe(NeutralToneMapping);
  expect(scene.getObjectByName("floor")).toBe(floor);
  expect(camera.position).toEqual(position);
  renderer.setPresentationSettings(settings);
  for (const change of [
    () => renderer.selectCamera("camera-1"),
    () => renderer.selectWalk(),
    () => renderer.resize(400, 800),
    () => renderer.setFocalLengthOverride(35),
    () => renderer.selectCamera(null),
    () => renderer.setModel(modelFixture()),
  ]) {
    change();
    expect(scene.environment).toBe(environment);
    expect(scene.environmentIntensity).toBe(2.3);
    expect(scene.environmentRotation.y).toBeCloseTo(-Math.PI / 2);
    expect(scene.background).toEqual(new Color(0xe8ecec));
    expect(gpu.instances[0]?.toneMapping).toBe(ACESFilmicToneMapping);
    expect(gpu.instances[0]?.toneMappingExposure).toBe(4);
    expect(surface.frames.size).toBe(0);
  }
  renderer.setPresentationSettings({ ...settings, environmentIntensity: 0 });
  expect(scene.environmentIntensity).toBe(0);
  expect(scene.children.some((object) => object.type === "HemisphereLight")).toBe(false);
  expect(gpu.fromScene).toHaveBeenCalledTimes(1);
  renderer.dispose();
});

it.each([
  { environmentIntensity: -1 },
  { environmentIntensity: NaN },
  { environmentIntensity: Infinity },
  { environmentRotationDegrees: NaN },
  { environmentRotationDegrees: Infinity },
  { toneMapping: "Linear" },
  { toneMapping: "toString" },
  { exposureEv: NaN },
  { exposureEv: Infinity },
  { exposureEv: -Infinity },
  { exposureEv: 1024 },
  { exposureEv: -1075 },
])("rejects invalid presentation atomically: %j", async (invalid) => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const renders = gpu.pipelineRender.mock.calls.length;
  expect(() =>
    renderer.setPresentationSettings({
      ...DEFAULT_PRESENTATION_SETTINGS,
      environmentIntensity: 2,
      ...invalid,
    } as RendererPresentationSettings),
  ).toThrow();
  expect(scene.environmentIntensity).toBe(1);
  expect(scene.environmentRotation.y).toBe(0);
  expect(gpu.instances[0]?.toneMapping).toBe(AgXToneMapping);
  expect(gpu.instances[0]?.toneMappingExposure).toBe(1);
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(renders);
  renderer.dispose();
});

it("releases generation resources and the backend if environment generation fails", async () => {
  const targetDispose = vi.fn();
  const roomDispose = vi.spyOn(RoomEnvironment.prototype, "dispose");
  gpu.fromScene.mockImplementationOnce(
    (_room, _sigma, _near, _far, options: { renderTarget: RenderTarget }) => {
      options.renderTarget.addEventListener("dispose", targetDispose);
      throw new Error("Environment generation failed");
    },
  );
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  await expect(renderer.initialize()).rejects.toThrow("Environment generation failed");
  expect(gpu.generatorDispose).toHaveBeenCalledTimes(1);
  expect(roomDispose).toHaveBeenCalledTimes(1);
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  expect(targetDispose).toHaveBeenCalledTimes(1);
  expect(gpu.pipelineRender).not.toHaveBeenCalled();
  renderer.dispose();
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  roomDispose.mockRestore();
});

it("updates DPR buffers immediately without changing CSS sizing, pose, projection, or scene", async () => {
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.resize(800, 400);
  renderer.setModel(modelFixture());
  await renderer.initialize();
  for (const mode of [
    () => renderer.selectCamera(null),
    () => renderer.selectCamera("camera-1"),
    () => renderer.selectWalk(),
  ]) {
    mode();
    renderer.setFocalLengthOverride(35);
    const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
    const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
    const position = camera.position.clone();
    const orientation = camera.quaternion.clone();
    const projection = camera.projectionMatrix.clone();
    const floor = scene.getObjectByName("floor");
    for (const pixelRatio of [1.25, 2.5, 3, 1]) {
      const count = gpu.pipelineRender.mock.calls.length;
      renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, pixelRatio });
      expect(gpu.setPixelRatio).toHaveBeenLastCalledWith(pixelRatio);
      expect(gpu.setSize).toHaveBeenLastCalledWith(800, 400, false);
      expect(gpu.pipelineRender).toHaveBeenCalledTimes(count + 1);
      expect(camera.position).toEqual(position);
      expect(camera.quaternion.toArray()).toEqual(orientation.toArray());
      expect(camera.projectionMatrix).toEqual(projection);
      expect(scene.getObjectByName("floor")).toBe(floor);
      expect(surface.frames.size).toBe(0);
    }
  }
  renderer.dispose();
});

it("requests reversed depth precision for the viewing camera", () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  expect(gpu.options).toHaveBeenCalledWith({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: false,
    requiredLimits: {},
    reversedDepthBuffer: true,
  });
  renderer.dispose();
});

it("maps every shadow level and rescales bias without replacing lights or geometry", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const light = scene.children.find((object) => object instanceof DirectionalLight);
  if (!(light instanceof DirectionalLight)) throw new Error("Missing key light");
  const mediumBias = light.shadow.normalBias;
  const mediumDepthBias = light.shadow.bias;
  const shadowCamera = light.shadow.camera;
  const texelSize = (shadowCamera.right - shadowCamera.left) / 2048;
  expect(mediumBias).toBeCloseTo(texelSize * 4);
  expect(mediumDepthBias).toBeCloseTo((texelSize * 2.5) / (shadowCamera.far - shadowCamera.near));
  expect(mediumDepthBias).toBeGreaterThan(0);
  const floor = scene.getObjectByName("floor");
  for (const [shadowQuality, size] of [
    ["Off", 0],
    ["Low", 1024],
    ["Medium", 2048],
    ["High", 4096],
    ["Off", 0],
    ["High", 4096],
  ] as const) {
    renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, shadowQuality });
    expect(gpu.instances[0]?.shadowMap.enabled).toBe(size !== 0);
    expect(gpu.instances[0]?.shadowMap.type).toBe(PCFShadowMap);
    expect(light.castShadow).toBe(size !== 0);
    if (size) {
      expect(light.shadow.mapSize.toArray()).toEqual([size, size]);
      expect(light.shadow.normalBias).toBeCloseTo((mediumBias * 2048) / size);
      expect(light.shadow.bias).toBeCloseTo((mediumDepthBias * 2048) / size);
      expect(light.shadow.needsUpdate).toBe(true);
    }
    expect(scene.getObjectByName("floor")).toBe(floor);
  }
  renderer.setModel(modelFixture());
  expect(light.shadow.mapSize.x).toBe(4096);
  expect(light.shadow.normalBias).toBeCloseTo(mediumBias / 2);
  renderer.dispose();
});

it("disables IBL before initialization and restores the same environment with current presentation", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, environmentLightingEnabled: false });
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  expect(scene.environment).toBeNull();
  renderer.setPresentationSettings({
    ...DEFAULT_PRESENTATION_SETTINGS,
    environmentIntensity: 2.5,
    environmentRotationDegrees: 90,
    toneMapping: "Neutral",
    exposureEv: 1,
  });
  expect(scene.environment).toBeNull();
  renderer.setQualitySettings(DEFAULT_QUALITY_SETTINGS);
  const environment = scene.environment;
  expect(environment).toBe(gpu.fromScene.mock.results[0]?.value.texture);
  renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, environmentLightingEnabled: false });
  expect(scene.environment).toBeNull();
  expect(scene.background).toEqual(new Color(0xe8ecec));
  renderer.setQualitySettings(DEFAULT_QUALITY_SETTINGS);
  expect(scene.environment).toBe(environment);
  expect(scene.environmentIntensity).toBe(2.5);
  expect(scene.environmentRotation.y).toBeCloseTo(-Math.PI / 2);
  expect(gpu.instances[0]?.toneMapping).toBe(NeutralToneMapping);
  expect(gpu.instances[0]?.toneMappingExposure).toBe(2);
  expect(gpu.fromScene).toHaveBeenCalledTimes(1);
  renderer.dispose();
  expect(gpu.environmentDispose).toHaveBeenCalledTimes(1);
});

it("provides neutral fill at all levels while retaining PBR materials and texture identity", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  const source = new DataTexture(new Uint8Array([255, 128, 64, 255]), 1, 1);
  renderer.setModel(modelFixture(), {
    assignments: new Map([
      [
        "floor",
        {
          baseColor: [1, 1, 1],
          roughness: 0.4,
          metalness: 0,
          textures: { widthCm: decimal("50"), heightCm: decimal("50"), baseColorMap: Symbol() },
        },
      ],
    ]),
    resolveTexture: () => source,
  });
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const floor = scene.getObjectByName("floor");
  if (!(floor instanceof Mesh) || !(floor.material instanceof MeshStandardMaterial))
    throw new Error("Missing PBR floor");
  const material = floor.material;
  const texture = material.map;
  expect(texture).not.toBeNull();
  const fill = scene.children.find((object) => object instanceof AmbientLight);
  if (!(fill instanceof AmbientLight)) throw new Error("Missing fill light");
  expect(fill.color).toEqual(new Color(0xffffff));
  for (const [fillLightLevel, intensity] of [
    ["Off", 0],
    ["Low", 0.5],
    ["Medium", 1],
    ["High", 2],
    ["Off", 0],
  ] as const) {
    renderer.setQualitySettings({
      ...DEFAULT_QUALITY_SETTINGS,
      environmentLightingEnabled: false,
      fillLightLevel,
    });
    expect(fill.intensity).toBe(intensity);
    expect(floor.material).toBe(material);
    expect(material.map).toBe(texture);
    expect(material.roughness).toBe(0.4);
  }
  renderer.dispose();
  source.dispose();
});

it.each([
  { pixelRatio: NaN },
  { pixelRatio: Infinity },
  { pixelRatio: 0 },
  { pixelRatio: -1 },
  { shadowQuality: "Ultra" },
  { fillLightLevel: "toString" },
  { environmentLightingEnabled: 1 },
])("rejects invalid quality atomically: %j", async (invalid) => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const environment = scene.environment;
  const calls = gpu.pipelineRender.mock.calls.length;
  expect(() =>
    renderer.setQualitySettings({
      ...DEFAULT_QUALITY_SETTINGS,
      ...invalid,
    } as RendererQualitySettings),
  ).toThrow("Invalid renderer quality");
  expect(scene.environment).toBe(environment);
  expect(gpu.setPixelRatio).not.toHaveBeenCalled();
  expect(gpu.instances[0]?.shadowMap.enabled).toBe(true);
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(calls);
  renderer.dispose();
});

it("bounds Walk rendering to one pending frame through repeated quality changes", async () => {
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.setModel(modelFixture());
  await renderer.initialize();
  renderer.selectWalk();
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const shadowQuality of ["Off", "Medium", "High"] as const) {
      renderer.setQualitySettings({
        ...DEFAULT_QUALITY_SETTINGS,
        shadowQuality,
        environmentLightingEnabled: shadowQuality !== "Off",
      });
      const draws = gpu.pipelineRender.mock.calls.length;
      const before = camera.quaternion.clone();
      surface.pointer("pointerdown");
      for (let move = 1; move <= 20; move++) surface.pointer("pointermove", move, move);
      expect(camera.quaternion.toArray()).not.toEqual(before.toArray());
      expect(gpu.pipelineRender).toHaveBeenCalledTimes(draws);
      expect(surface.frames.size).toBe(1);
      surface.frame(16);
      expect(gpu.pipelineRender).toHaveBeenCalledTimes(draws + 1);
      expect(surface.frames.size).toBe(0);
      surface.pointer("pointerup");
    }
  }
  surface.key("keydown", "KeyW");
  surface.pointer("pointerdown");
  surface.elapse(8);
  surface.pointer("pointermove", 100, 100);
  // Movement and look share a pending draw rather than rendering separately per event.
  const draws = gpu.pipelineRender.mock.calls.length;
  renderer.setQualitySettings(DEFAULT_QUALITY_SETTINGS);
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(draws + 1);
  renderer.selectCamera(null);
  expect(surface.frames.size).toBe(0);
  renderer.selectWalk();
  surface.pointer("pointerdown");
  surface.pointer("pointermove", 20, 20);
  expect(surface.frames.size).toBe(1);
  renderer.dispose();
  expect(surface.frames.size).toBe(0);
});

it("refreshes static shadows only for model replacement and shadow-quality changes", async () => {
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.setModel(modelFixture());
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const light = scene.children.find((object) => object instanceof DirectionalLight);
  if (!(light instanceof DirectionalLight)) throw new Error("Missing key light");
  expect(light.shadow.autoUpdate).toBe(false);
  expect(light.shadow.needsUpdate).toBe(true);
  light.shadow.needsUpdate = false; // Simulate a completed backend shadow pass.
  renderer.selectWalk();
  surface.pointer("pointerdown");
  surface.pointer("pointermove", 20, 20);
  surface.frame(16);
  renderer.resize(800, 600);
  renderer.setPresentationSettings({ ...DEFAULT_PRESENTATION_SETTINGS, exposureEv: 1 });
  renderer.setQualitySettings({
    ...DEFAULT_QUALITY_SETTINGS,
    pixelRatio: 2,
    fillLightLevel: "Low",
  });
  expect(light.shadow.needsUpdate).toBe(false);
  for (const shadowQuality of ["High", "Medium", "Off", "Medium"] as const) {
    renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, shadowQuality });
    if (shadowQuality !== "Off") expect(light.shadow.needsUpdate).toBe(true);
    light.shadow.needsUpdate = false;
  }
  renderer.setModel(modelFixture());
  expect(light.shadow.needsUpdate).toBe(true);
  renderer.dispose();
});

it.each(["studio", "physical"] as const)(
  "replaces allocated shadow resources in %s without resetting Walk or PBR geometry",
  async (mode) => {
    const surface = navigationSurface();
    const onError = vi.fn();
    const renderer = createApartmentRenderer(surface.canvas, onError);
    const base = modelFixture();
    renderer.setModel({
      ...base,
      metadata: {
        ...base.metadata,
        location: {
          latitude: decimal("47.5"),
          longitude: decimal("19"),
          northHeading: decimal("270"),
        },
      },
    });
    renderer.setLightingMode(mode, Date.parse("2024-06-21T08:00:00Z"));
    await renderer.initialize();
    renderer.selectWalk();
    const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
    const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
    const floor = scene.getObjectByName("floor");
    const position = camera.position.clone();
    const orientation = camera.quaternion.toArray();
    const getLight = (): DirectionalLight => {
      const result = scene.children.find((object) => object instanceof DirectionalLight);
      if (!(result instanceof DirectionalLight)) throw new Error("Missing shadow light");
      return result;
    };
    for (const shadowQuality of ["High", "Medium", "Low", "High", "Medium"] as const) {
      const previous = getLight();
      // A real backend allocates this target on its first shadow pass. Leaving it
      // null in the GPU mock hid the unsafe in-place resizing regression.
      const target = new RenderTarget(previous.shadow.mapSize.x, previous.shadow.mapSize.y);
      previous.shadow.map = target;
      const disposed = vi.fn();
      target.addEventListener("dispose", disposed);
      const lightDisposed = vi.fn();
      previous.addEventListener("dispose", lightDisposed);
      gpu.pipelineRender.mockImplementationOnce(() => {
        expect(getLight()).not.toBe(previous);
        expect(getLight().shadow.map).toBeNull();
        expect(lightDisposed).toHaveBeenCalledTimes(1);
      });
      renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, shadowQuality });
      expect(onError).not.toHaveBeenCalled();
      const replacement = getLight();
      expect(replacement).not.toBe(previous);
      expect(disposed).toHaveBeenCalledTimes(1);
      expect(previous.parent).toBeNull();
      expect(previous.target.parent).toBeNull();
      expect(replacement.position).toEqual(previous.position);
      expect(replacement.target.position).toEqual(previous.target.position);
      expect(replacement.shadow.camera.projectionMatrix).toEqual(
        previous.shadow.camera.projectionMatrix,
      );
      expect(replacement.shadow.autoUpdate).toBe(false);
      expect(replacement.shadow.needsUpdate).toBe(true);
      expect(scene.children.filter((object) => object instanceof DirectionalLight)).toHaveLength(1);
      expect(scene.getObjectByName("floor")).toBe(floor);
      expect(camera.position).toEqual(position);
      expect(camera.quaternion.toArray()).toEqual(orientation);
      renderer.setQualitySettings({
        ...DEFAULT_QUALITY_SETTINGS,
        shadowQuality,
        fillLightLevel: "Low",
      });
      expect(getLight()).toBe(replacement);
    }
    renderer.dispose();
  },
);

it("switches Studio and Physical lighting without resetting navigation or rebuilding geometry", async () => {
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  const base = modelFixture();
  const model = {
    ...base,
    metadata: {
      ...base.metadata,
      location: {
        latitude: decimal("47.4979"),
        longitude: decimal("19.0402"),
        northHeading: decimal("270"),
      },
    },
  };
  renderer.setModel(model);
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const environment = scene.environment;
  const floor = scene.getObjectByName("floor");
  const getLight = () => {
    const light = scene.children.find((object) => object instanceof DirectionalLight);
    if (!light) throw new Error("Missing light");
    return light;
  };
  const studioOffset = getLight().position.clone().sub(getLight().target.position);
  const instant = Date.parse("2024-06-21T08:00:00Z");
  for (const select of [
    () => renderer.selectCamera(null),
    () => renderer.selectCamera("camera-1"),
    () => renderer.selectWalk(),
  ]) {
    select();
    const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
    const pose = camera.matrixWorld.clone();
    const position = camera.position.clone();
    renderer.setLightingMode("physical", instant);
    const light = getLight();
    const direction = light.position.clone().sub(light.target.position).normalize();
    // NOAA reference A=111.43932, E=49.28737 with northHeading=270,
    // mapped from PlanAxis (X,Y,Z) to Three (X,Z,Y).
    expect(direction.x).toBeCloseTo(0.607, 2);
    expect(direction.y).toBeCloseTo(0.758, 2);
    expect(direction.z).toBeCloseTo(0.238, 2);
    expect(light.intensity).toBe(3);
    expect(light.shadow.needsUpdate).toBe(true);
    expect(scene.environment).toBeNull();
    renderer.setQualitySettings({
      ...DEFAULT_QUALITY_SETTINGS,
      shadowQuality: "Off",
      fillLightLevel: "High",
    });
    expect(getLight().castShadow).toBe(true);
    expect(gpu.instances[0]?.shadowMap.enabled).toBe(true);
    expect(scene.children.find((object) => object instanceof AmbientLight)?.intensity).toBe(0);
    expect(scene.environment).toBeNull();
    renderer.setLightingMode("studio", instant);
    expect(scene.environment).toBe(environment);
    expect(getLight().position.clone().sub(getLight().target.position)).toEqual(studioOffset);
    expect(getLight().castShadow).toBe(false);
    expect(scene.children.find((object) => object instanceof AmbientLight)?.intensity).toBe(2);
    expect(scene.getObjectByName("floor")).toBe(floor);
    expect(camera.position).toEqual(position);
    expect(camera.matrixWorld).toEqual(pose);
    expect(surface.frames.size).toBe(0);
  }
  renderer.setLightingMode("physical", Date.parse("2024-06-21T22:00:00Z"));
  expect(getLight().intensity).toBe(0);
  renderer.setModel(model);
  expect(getLight().intensity).toBe(0);
  expect(scene.environment).toBeNull();
  renderer.setModel(base);
  expect(getLight().intensity).toBe(3);
  expect(scene.environment).toBe(environment);
  expect(() => renderer.setLightingMode("physical", instant)).toThrow("requires Apartment SVG");
  renderer.dispose();
  expect(gpu.environmentDispose).toHaveBeenCalledTimes(1);
});

it.each([0, -0.001, -30])("disables direct Sun at elevation %s", async (elevation) => {
  const solar = vi
    .spyOn(simulation, "calculateSolarPosition")
    .mockReturnValue({ azimuth: 90, elevation });
  const renderer = createApartmentRenderer(canvas, vi.fn());
  const base = modelFixture();
  renderer.setModel({
    ...base,
    metadata: {
      ...base.metadata,
      location: {
        latitude: decimal("0"),
        longitude: decimal("0"),
        northHeading: decimal("270"),
      },
    },
  });
  try {
    renderer.setLightingMode("physical", Date.parse("2024-06-21T08:00:00Z"));
    await renderer.initialize();
    const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
    expect(scene.children.find((object) => object instanceof DirectionalLight)?.intensity).toBe(0);
    expect(scene.environment).toBeNull();
  } finally {
    solar.mockRestore();
    renderer.dispose();
  }
});

it("updates and releases the Physical background with weaker, cooler, softer Overcast Sun", async () => {
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  const base = modelFixture();
  const model = {
    ...base,
    metadata: {
      ...base.metadata,
      location: {
        latitude: decimal("47.5"),
        longitude: decimal("19"),
        northHeading: decimal("270"),
      },
    },
  };
  renderer.setModel(model);
  await renderer.initialize();
  renderer.selectWalk();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const camera = gpu.pipelineRender.mock.calls.at(-1)?.[1] as PerspectiveCamera;
  const pose = camera.position.clone();
  const floor = scene.getObjectByName("floor");
  const light = scene.children.find((item) => item instanceof DirectionalLight);
  if (!light) throw new Error("Missing light");
  const noon = Date.parse("2024-06-21T10:00:00Z");
  renderer.setLightingMode("physical", noon, "sunny");
  const sky = scene.backgroundNode;
  if (!sky) throw new Error("Missing sky");
  const skyDispose = vi.fn();
  sky.addEventListener("dispose", skyDispose);
  const sunnyColor = light.color.clone();
  const sunnyStrength = light.intensity;
  const sunnyRadius = light.shadow.radius;
  for (const shadowQuality of ["Low", "Medium", "High"] as const) {
    renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, shadowQuality });
    renderer.setLightingMode("physical", noon, "overcast");
    expect(light.intensity).toBeCloseTo(sunnyStrength * 0.045);
    expect(light.color.b / light.color.r).toBeGreaterThan(sunnyColor.b / sunnyColor.r);
    expect(light.shadow.radius).toBeGreaterThan(sunnyRadius * 3);
    expect(light.shadow.intensity).toBe(1); // No occlusion bypass to fake soft shadows.
    expect(light.castShadow).toBe(true);
    expect(scene.environment).toBeNull();
    expect(scene.backgroundNode).toBe(sky);
  }
  renderer.setLightingMode("studio", noon);
  expect(scene.backgroundNode).toBeNull();
  expect(light.color).toEqual(new Color(0xffffff));
  expect(light.shadow.radius).toBe(1);
  renderer.setLightingMode("physical", noon);
  expect(light.intensity).toBeCloseTo(sunnyStrength * 0.045);
  expect(scene.backgroundNode).toBe(sky);
  renderer.setLightingMode("physical", Date.parse("2024-06-21T22:00:00Z"));
  expect(light.intensity).toBe(0);
  expect(scene.backgroundNode).toBe(sky);
  expect(camera.position).toEqual(pose);
  expect(scene.getObjectByName("floor")).toBe(floor);
  expect(surface.frames.size).toBe(0);
  renderer.setModel(model);
  expect(scene.backgroundNode).toBe(sky);
  expect(light.intensity).toBe(0);
  renderer.setModel(base);
  expect(scene.backgroundNode).toBeNull();
  renderer.dispose();
  expect(skyDispose).toHaveBeenCalledTimes(1);
  expect(scene.backgroundNode).toBeNull();
});

it("preserves design luminaires through daylight/navigation and disposes replacements and shadows", async () => {
  const { PointLight, SpotLight, RectAreaLight } = await import("three/webgpu");
  const renderer = createApartmentRenderer(navigationSurface().canvas, vi.fn());
  const base = modelFixture();
  const model = {
    ...base,
    metadata: {
      ...base.metadata,
      location: {
        latitude: decimal("47.5"),
        longitude: decimal("19"),
        northHeading: decimal("270"),
      },
    },
  };
  renderer.setModel(model);
  const common = { positionCm: { x: 150, y: 150, z: 220 }, lumens: 1000, kelvin: 3000 };
  renderer.setLuminaires([
    { ...common, type: "point" },
    {
      ...common,
      type: "spot",
      orientation: { headingDegrees: 0, pitchDegrees: 90, rollDegrees: 0 },
      beamAngleDegrees: 60,
    },
    {
      ...common,
      type: "area",
      orientation: { headingDegrees: 0, pitchDegrees: 90, rollDegrees: 0 },
      widthCm: 80,
      heightCm: 40,
    },
  ]);
  await renderer.initialize();
  const scene = gpu.pipelineRender.mock.calls.at(-1)?.[0] as Scene;
  const group = scene.getObjectByName("design-luminaires");
  if (!group) throw new Error("Missing luminaire group");
  const lights = group.children.filter(
    (item) =>
      item instanceof PointLight || item instanceof SpotLight || item instanceof RectAreaLight,
  );
  expect(lights).toHaveLength(3);
  const snapshot = lights.map((light) => [
    light.power,
    light.position.toArray(),
    light.quaternion.toArray(),
  ]);
  for (const mode of ["physical", "studio", "physical"] as const) {
    for (const weather of ["sunny", "overcast"] as const) {
      renderer.setLightingMode(mode, Date.parse("2024-06-21T22:00:00Z"), weather);
      renderer.selectCamera("camera-1");
      renderer.selectCamera(null);
      renderer.selectWalk();
      expect(scene.getObjectByName("design-luminaires")).toBe(group);
      expect(
        lights.map((light) => [light.power, light.position.toArray(), light.quaternion.toArray()]),
      ).toEqual(snapshot);
    }
  }
  const point = lights.find((item) => item instanceof PointLight);
  if (!point) throw new Error("Missing point");
  point.shadow.map = new RenderTarget();
  const shadowDispose = vi.spyOn(point.shadow.map, "dispose");
  const disposals = lights.map((light) => vi.spyOn(light, "dispose"));
  renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, shadowQuality: "Off" });
  expect(shadowDispose).toHaveBeenCalledTimes(1);
  for (const disposal of disposals) expect(disposal).toHaveBeenCalledTimes(1);
  const replacement = scene.getObjectByName("design-luminaires");
  expect(replacement).not.toBe(group);
  expect(gpu.instances[0]?.shadowMap.enabled).toBe(true);
  renderer.setModel(model);
  expect(replacement?.parent).toBeNull();
  const modelGroup = scene.getObjectByName("design-luminaires");
  renderer.setLuminaires([{ ...common, type: "point", lumens: 200 }]);
  expect(modelGroup?.parent).toBeNull();
  const finalPoint = scene.getObjectByName("design-luminaires")?.children[0];
  if (!(finalPoint instanceof PointLight)) throw new Error("Missing replacement point");
  expect(finalPoint.power).toBeCloseTo(200);
  const finalDispose = vi.spyOn(finalPoint, "dispose");
  renderer.setLuminaires([]);
  expect(finalDispose).toHaveBeenCalledTimes(1);
  expect(scene.getObjectByName("design-luminaires")?.children).toHaveLength(0);
  renderer.setLuminaires([{ ...common, type: "point" }]);
  const owned = scene.getObjectByName("design-luminaires")?.children[0];
  if (!(owned instanceof PointLight)) throw new Error("Missing final point");
  owned.shadow.map = new RenderTarget();
  const ownedShadowDispose = vi.spyOn(owned.shadow.map, "dispose");
  const ownedDispose = vi.spyOn(owned, "dispose");
  renderer.dispose();
  renderer.dispose();
  expect(ownedDispose).toHaveBeenCalledTimes(1);
  expect(ownedShadowDispose).toHaveBeenCalledTimes(1);
});

it("owns one HDR pipeline, bypasses disabled bloom and updates uniforms without rebuilding", async () => {
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.setModel(modelFixture());
  await renderer.initialize();
  const pipeline = gpu.pipelines[0]!;
  const scenePass = gpu.passes[0]!;
  const bloomNode = gpu.blooms[0]!;
  const composite = pipeline.outputNode;
  const color = scenePass.getTextureNode("output");
  expect(bloomNode.inputNode).toBe(color);
  expect(pipeline.outputColorTransform).toBe(true);
  expect(composite).toMatchObject({ node: { op: "+", aNode: color, bNode: bloomNode } });
  expect(gpu.options).toHaveBeenCalledWith({
    canvas: surface.canvas,
    antialias: true,
    logarithmicDepthBuffer: false,
    requiredLimits: {},
    reversedDepthBuffer: true,
  });
  expect(gpu.directRender).not.toHaveBeenCalled();
  const scene = scenePass.scene;
  const floor = scene.getObjectByName("floor");
  renderer.selectWalk();
  const camera = scenePass.camera;
  const pose = camera.position.clone();
  const defaults = DEFAULT_POST_PROCESSING_SETTINGS;
  for (const bloomEnabled of [false, true, false, true]) {
    pipeline.needsUpdate = false;
    const draws = gpu.pipelineRender.mock.calls.length;
    renderer.setPostProcessingSettings({
      ...defaults,
      bloomEnabled,
      bloomStrength: 0.35,
      bloomRadius: 0.6,
      bloomThreshold: 4,
    });
    expect(pipeline.outputNode).toBe(bloomEnabled ? composite : color);
    expect(pipeline.needsUpdate).toBe(true);
    expect(bloomNode.strength.value).toBe(0.35);
    expect(bloomNode.radius.value).toBe(0.6);
    expect(bloomNode.threshold.value).toBe(4);
    expect(gpu.pipelineRender).toHaveBeenCalledTimes(draws + 1);
    expect(scene.getObjectByName("floor")).toBe(floor);
    expect(camera.position).toEqual(pose);
    expect(surface.frames.size).toBe(0);
  }
  pipeline.needsUpdate = false;
  renderer.setPostProcessingSettings({ ...defaults, bloomThreshold: 3 });
  expect(pipeline.needsUpdate).toBe(false); // Uniform edits need no graph rebuild.
  renderer.resize(960, 540);
  renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, pixelRatio: 2 });
  renderer.setPresentationSettings({
    ...DEFAULT_PRESENTATION_SETTINGS,
    toneMapping: "Neutral",
    exposureEv: 2,
  });
  expect(gpu.instances[0]?.toneMapping).toBe(NeutralToneMapping);
  expect(gpu.instances[0]?.toneMappingExposure).toBe(4);
  expect(gpu.setSize).toHaveBeenLastCalledWith(960, 540, false);
  expect(gpu.setPixelRatio).toHaveBeenLastCalledWith(2);
  renderer.setModel(modelFixture());
  renderer.setLuminaires([
    { type: "point", positionCm: { x: 100, y: 100, z: 200 }, lumens: 1000, kelvin: 3000 },
  ]);
  renderer.selectCamera("camera-1");
  expect(gpu.pipelines).toHaveLength(1);
  expect(gpu.passes).toHaveLength(1);
  expect(gpu.blooms).toHaveLength(1);
  expect(bloomNode.threshold.value).toBe(3);
  const pipelineDispose = vi.spyOn(pipeline, "dispose");
  const bloomDispose = vi.spyOn(bloomNode, "dispose");
  const targetDispose = vi.spyOn(scenePass.renderTarget, "dispose");
  renderer.dispose();
  renderer.dispose();
  expect(pipelineDispose).toHaveBeenCalledTimes(1);
  expect(bloomDispose).toHaveBeenCalledTimes(1);
  expect(targetDispose).toHaveBeenCalledTimes(1);
});

it("rejects invalid post-processing atomically and releases uninitialized pipeline resources", () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  const pipeline = gpu.pipelines[0]!;
  const bloomNode = gpu.blooms[0]!;
  const output = pipeline.outputNode;
  expect(() =>
    renderer.setPostProcessingSettings({
      ...DEFAULT_POST_PROCESSING_SETTINGS,
      bloomEnabled: false,
      bloomStrength: 5,
      bloomRadius: NaN,
    }),
  ).toThrow("Invalid renderer post-processing");
  expect(pipeline.outputNode).toBe(output);
  expect(bloomNode.strength.value).toBe(DEFAULT_POST_PROCESSING_SETTINGS.bloomStrength);
  expect(gpu.pipelineRender).not.toHaveBeenCalled();
  const effectDispose = vi.spyOn(bloomNode, "dispose");
  renderer.dispose();
  expect(effectDispose).toHaveBeenCalledTimes(1);
});

it("keeps GI unavailable on WebGL2 while High, bloom and existing rendering remain usable", async () => {
  const renderer = createApartmentRenderer(canvas, vi.fn());
  renderer.setModel(modelFixture());
  renderer.setGlobalIlluminationSettings({ enabled: true });
  renderer.setQualitySettings({ ...DEFAULT_QUALITY_SETTINGS, shadowQuality: "High" });
  await renderer.initialize();
  expect(renderer.getGlobalIlluminationCapability()).toMatchObject({
    available: false,
    reason: expect.stringContaining("WebGL2"),
  });
  expect(gpu.vxgis).toHaveLength(0);
  expect(gpu.pipelineRender).toHaveBeenCalled();
  expect(gpu.blooms).toHaveLength(1);
  const renders = gpu.pipelineRender.mock.calls.length;
  expect(() =>
    renderer.setGlobalIlluminationSettings({ enabled: 1 } as unknown as { enabled: boolean }),
  ).toThrow("Invalid renderer global illumination");
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(renders);
  renderer.dispose();
});

it("injects GI before HDR temporal resolve and bloom, preserving geometry through camera and lighting edits", async () => {
  gpu.nativeWebgpu = true;
  const surface = navigationSurface();
  const renderer = createApartmentRenderer(surface.canvas, vi.fn());
  renderer.setModel(modelFixture());
  renderer.setPresentationSettings(DEFAULT_PRESENTATION_SETTINGS);
  renderer.setGlobalIlluminationSettings({ enabled: true });
  await renderer.initialize();
  const node = gpu.vxgis[0]!;
  const temporal = gpu.temporals.at(-1)!;
  const prePass = gpu.passes[1]!;
  const scenePass = gpu.passes[0]!;
  const pipeline = gpu.pipelines[0]!;
  const bloomNode = gpu.blooms.at(-1)!;
  expect(renderer.getGlobalIlluminationCapability()).toEqual({ available: true });
  expect(prePass.transparent).toBe(false);
  expect(prePass.options.samples).toBe(0);
  expect(prePass.getLayers()?.mask).toBe(1);
  expect(prePass.getTexture("depth").type).toBe(FloatType);
  expect(scenePass.renderTarget.samples).toBe(0);
  expect(gpu.pipelineRender.mock.calls[0]?.[2]).toMatchObject({ width: 1, height: 1 });
  expect(gpu.pipelineRender.mock.calls[1]?.[2]).toBeNull();
  expect(temporal.depthNode).toBe(prePass.getTextureNode("depth"));
  expect(temporal.velocityNode).toBe(prePass.getTextureNode("velocity"));
  expect(scenePass.contextNode).not.toBeNull();
  expect(temporal.beautyNode).toBe(scenePass.getTextureNode("output"));
  expect(bloomNode.inputNode).toBe(temporal);
  expect(pipeline.outputNode).toMatchObject({
    node: { op: "+", aNode: temporal, bNode: bloomNode },
  });
  expect(pipeline.outputColorTransform).toBe(true);
  expect(node.volume).toMatchObject({
    resolution: 256,
    maxLights: 32,
    directionalRadiance: true,
    bounces: 0,
  });
  expect(node.giIntensity.value).toBe(8);
  expect(gpu.instances[0]!.toneMappingExposure).toBe(1);
  expect(
    scenePass.scene.children.find((object) => object instanceof DirectionalLight),
  ).toMatchObject({
    intensity: 3,
  });
  expect(surface.frames.size).toBe(1);
  const start = gpu.pipelineRender.mock.calls.length;
  for (let i = 0; i < 32; i++) surface.frame(16);
  expect(gpu.pipelineRender).toHaveBeenCalledTimes(start + 32);
  expect(surface.frames.size).toBe(0);
  // Simulate flags consumed by the upstream GPU update, then test invalidation boundaries.
  node.needsUpdate = false;
  node.lightingNeedsUpdate = false;
  renderer.selectCamera("camera-1");
  renderer.selectWalk();
  renderer.resize(1920, 1080);
  renderer.setFocalLengthOverride(24);
  expect(node.needsUpdate).toBe(false);
  expect(node.lightingNeedsUpdate).toBe(false);
  renderer.setLuminaires([
    {
      id: "point",
      type: "point",
      positionCm: { x: 100, y: 100, z: 150 },
      lumens: 500,
      kelvin: 3000,
    },
  ]);
  expect(node.needsUpdate).toBe(false);
  expect(node.lightingNeedsUpdate).toBe(true);
  node.lightingNeedsUpdate = false;
  renderer.setLightingMode("studio", 0);
  expect(node.needsUpdate).toBe(false);
  expect(node.lightingNeedsUpdate).toBe(true);
  const history = gpu.temporals.at(-1)!;
  const historyReset = vi.spyOn(
    history as typeof history & { setSize(width: number, height: number): void },
    "setSize",
  );
  renderer.setModel(modelFixture());
  expect(node.needsUpdate).toBe(true);
  expect(historyReset).toHaveBeenCalledWith(1, 1);
  expect(gpu.vxgis).toHaveLength(1);
  const giDispose = vi.spyOn(node, "dispose");
  renderer.setGlobalIlluminationSettings({ enabled: false });
  expect(surface.frames.size).toBe(0);
  expect(scenePass.contextNode).toBeNull();
  expect(giDispose).toHaveBeenCalledOnce();
  renderer.setGlobalIlluminationSettings({ enabled: true });
  const newNode = gpu.vxgis.at(-1)!;
  const newDispose = vi.spyOn(newNode, "dispose");
  renderer.dispose();
  expect(newDispose).toHaveBeenCalledOnce();
  expect(surface.frames.size).toBe(0);
  expect(gpu.dispose).toHaveBeenCalledOnce();
});

it("cancels GI convergence after a rendering failure or device loss", async () => {
  gpu.nativeWebgpu = true;
  const surface = navigationSurface();
  const failure = vi.fn();
  const renderer = createApartmentRenderer(surface.canvas, failure);
  renderer.setModel(modelFixture());
  renderer.setGlobalIlluminationSettings({ enabled: true });
  await renderer.initialize();
  gpu.pipelineRender.mockImplementationOnce(() => {
    throw new Error("GPU failed");
  });
  surface.frame(16);
  expect(failure).toHaveBeenCalledOnce();
  expect(surface.frames.size).toBe(0);
  renderer.dispose();
});

it("reports uncaptured native GPU validation errors once and releases the listener", async () => {
  gpu.nativeWebgpu = true;
  const device = Object.assign(new EventTarget(), {
    limits: { maxSampledTexturesPerShaderStage: 16, maxSamplersPerShaderStage: 16 },
  });
  gpu.device = device as unknown as GPUDevice;
  const surface = navigationSurface();
  const failure = vi.fn();
  const renderer = createApartmentRenderer(surface.canvas, failure);
  renderer.setModel(modelFixture());
  renderer.setGlobalIlluminationSettings({ enabled: true });
  await renderer.initialize();
  const error = () =>
    Object.assign(new Event("uncapturederror"), { error: { message: "Invalid texture" } });
  device.dispatchEvent(error());
  device.dispatchEvent(error());
  expect(failure).toHaveBeenCalledOnce();
  expect(surface.frames.size).toBe(0);
  renderer.dispose();
  device.dispatchEvent(error());
  expect(failure).toHaveBeenCalledOnce();
});
