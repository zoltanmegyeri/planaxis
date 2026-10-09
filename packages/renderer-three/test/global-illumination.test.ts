import { describe, expect, it, vi } from "vitest";
import {
  Box3,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  NodeFrame,
  Scene,
  Vector3,
} from "three/webgpu";
import type { WebGPURenderer } from "three/webgpu";
import { VXGIVolume } from "three/addons/lighting/vxgi/VXGIVolume.js";
import { uniform } from "three/tsl";
import { deriveDaylight } from "@planaxis/simulation";
import {
  beginGiFrame,
  configureGiTextureLimit,
  DEFAULT_GLOBAL_ILLUMINATION_SETTINGS,
  GiScene,
  giLightBudget,
  globalIlluminationCapability,
  isRendererGlobalIlluminationSettings,
  provisionVxgiLightBudget,
  selectGiLights,
  VXGI_CONFIGURATION,
} from "../src/global-illumination.js";
import { TemporalConvergence } from "../src/temporal-convergence.js";
import { SkyLights } from "../src/sky-lights.js";
import { navigationSurface } from "./navigation-surface.js";
import { buildLuminaireSet } from "../src/runtime-luminaires.js";
import { rectangularProxies } from "../evaluation/rectangular-proxies.js";

it("validates a separate transient GI contract and gates the initialized backend", () => {
  expect(DEFAULT_GLOBAL_ILLUMINATION_SETTINGS).toEqual({ enabled: false });
  for (const value of [null, {}, { enabled: 1 }, { enabled: "true" }])
    expect(isRendererGlobalIlluminationSettings(value)).toBe(false);
  expect(isRendererGlobalIlluminationSettings({ enabled: true })).toBe(true);
  const renderer = (backend: object) => ({ backend }) as WebGPURenderer;
  expect(globalIlluminationCapability(renderer({ isWebGPUBackend: true }))).toEqual({
    available: true,
  });
  expect(globalIlluminationCapability(renderer({ isWebGLBackend: true }))).toMatchObject({
    available: false,
    reason: expect.stringContaining("WebGL2"),
  });
});

it("collects only opaque architecture and explicit lights without reparenting or helper bounds", () => {
  const architecture = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 3, 4), new MeshStandardMaterial());
  mesh.castShadow = true;
  architecture.add(mesh);
  const marker = mesh.clone();
  marker.position.x = 100;
  marker.userData.visualizationMarker = true;
  const glass = mesh.clone();
  glass.position.x = -100;
  glass.castShadow = false;
  architecture.add(marker, glass);
  architecture.updateMatrixWorld(true);
  const collector = new GiScene();
  collector.architecture = architecture;
  collector.lights = [new DirectionalLight()];
  expect(collector.architectureBounds()).toEqual(
    new Box3(new Vector3(-1.25, -1.75, -2.25), new Vector3(1.25, 1.75, 2.25)),
  );
  const collected: object[] = [];
  collector.traverseVisible((object) => collected.push(object));
  expect(collected).toEqual([mesh, ...collector.lights]);
  expect(mesh.parent).toBe(architecture);
  expect(collector.lights[0]!.parent).toBeNull();
  mesh.geometry.dispose();
  (mesh.material as MeshStandardMaterial).dispose();
});

it("requests supported texture capacity and bounds injection on a smaller device", async () => {
  for (const maximum of [16, 48, 128]) {
    const limits: Record<string, number> = {};
    const gpu = {
      requestAdapter: vi.fn().mockResolvedValue({
        limits: { maxSampledTexturesPerShaderStage: maximum, maxSamplersPerShaderStage: maximum },
      }),
    };
    await configureGiTextureLimit(limits, gpu as unknown as GPU);
    expect(limits.maxSampledTexturesPerShaderStage).toBe(Math.min(48, maximum));
    expect(limits.maxSamplersPerShaderStage).toBe(Math.min(48, maximum));
  }
  const limits: Record<string, number> = {};
  await configureGiTextureLimit(limits, {
    requestAdapter: vi.fn().mockRejectedValue(new Error("No adapter")),
  } as unknown as GPU);
  expect(limits).toEqual({});
  expect(
    giLightBudget({
      backend: { device: { limits: { maxSampledTexturesPerShaderStage: 16 } } },
    } as unknown as WebGPURenderer),
  ).toBe(16);
});

it("advances FRAME effects for consecutive event-driven draws without waiting for housekeeping RAF", () => {
  const frame = new NodeFrame();
  const renderer = { _nodes: { nodeFrame: frame } } as unknown as WebGPURenderer;
  const node = uniform(0);
  node.updateBeforeType = "frame";
  node.updateBefore = vi.fn();
  for (let index = 0; index < 3; index++) {
    beginGiFrame(renderer);
    frame.updateBeforeNode(node);
  }
  expect(node.updateBefore).toHaveBeenCalledTimes(3);
  expect(() => beginGiFrame({} as WebGPURenderer)).toThrow(
    "Unsupported Three.js node-frame layout",
  );
});

it("selects daylight then stable design IDs, excluding disabled lights even above 32 candidates", () => {
  const candidates = Array.from({ length: 40 }, (_, index) => ({
    key: `light-${String(index).padStart(2, "0")}`,
    priority: 2,
    light: new DirectionalLight(0xffffff, index === 1 ? 0 : 1),
  }));
  const sun = { key: "sun", priority: 0, light: new DirectionalLight() };
  const sky = { key: "sky", priority: 1, light: new DirectionalLight() };
  const expected = selectGiLights([sun, sky, ...candidates]);
  expect(expected).toHaveLength(32);
  expect(expected.slice(0, 2)).toEqual([sun.light, sky.light]);
  expect(expected).not.toContain(candidates[1]!.light);
  expect(selectGiLights([...candidates].reverse().concat(sky, sun))).toEqual(expected);
  expect(selectGiLights([sun, ...candidates], 16)).toHaveLength(16);
});

it("provisions stock r186 slots so a 32-light collector can actually inject more than eight", () => {
  const volume = new VXGIVolume(256);
  provisionVxgiLightBudget(volume, 32);
  const set = buildLuminaireSet(
    Array.from({ length: 40 }, (_, index) => ({
      id: `light-${index}`,
      type: "point",
      positionCm: { x: index, y: 0, z: 100 },
      lumens: 100,
      kelvin: 3000,
    })),
    "Low",
  );
  set.group.updateMatrixWorld(true);
  const collector = new GiScene();
  collector.lights = selectGiLights(set.giCandidates);
  // Exercise the exact upstream collection that previously indexed missing slots.
  const bridge = volume as VXGIVolume & {
    _collectLights(renderer: object, scene: Scene): string;
    _lightCountNode: { value: number };
    _lightsArray: unknown[];
    _shadowMatrices: unknown[];
  };
  expect(() => bridge._collectLights({ shadowMap: { enabled: true } }, collector)).not.toThrow();
  expect(bridge._lightCountNode.value).toBe(32);
  expect(bridge._lightsArray).toHaveLength(128);
  expect(bridge._shadowMatrices).toHaveLength(32);
  set.dispose();
  volume.dispose();
});

describe("bounded temporal convergence", () => {
  it.each([8, 16, 32])("renders exactly %i additional frames then returns idle", (count) => {
    const surface = navigationSurface();
    const draw = vi.fn(() => true);
    const convergence = new TemporalConvergence(surface.window, draw);
    convergence.restart(count);
    for (let index = 0; index < count; index++) surface.frame(16);
    expect(draw).toHaveBeenCalledTimes(count);
    expect(surface.frames.size).toBe(0);
    surface.frame(16);
    expect(draw).toHaveBeenCalledTimes(count);
  });
  it("restarts without queued duplicates and cancels on disposal or draw failure", () => {
    const surface = navigationSurface();
    const draw = vi.fn(() => true);
    const convergence = new TemporalConvergence(surface.window, draw);
    convergence.restart(16);
    surface.frame(16);
    convergence.restart(8);
    expect(surface.frames.size).toBe(1);
    convergence.cancel();
    surface.frame(16);
    expect(draw).toHaveBeenCalledTimes(1);
    draw.mockReturnValue(false);
    convergence.restart(16);
    surface.frame(16);
    expect(surface.frames.size).toBe(0);
  });
});

it("updates four bounded Physical sky sources without allocating replacements or Studio fill", () => {
  const sky = new SkyLights();
  const lights = [...sky.lights];
  sky.setBounds(new Box3(new Vector3(0, 0, 0), new Vector3(9, 2.6, 4)));
  sky.update(deriveDaylight(35, "sunny"));
  const sunny = lights[0]!.intensity;
  sky.update(deriveDaylight(35, "overcast"));
  expect(lights[0]!.intensity).toBeGreaterThan(sunny);
  expect(sky.candidates()).toHaveLength(4);
  expect(lights.every((light) => light.castShadow && !light.shadow.autoUpdate)).toBe(true);
  sky.update(deriveDaylight(-18, "overcast"));
  expect(lights.every((light) => light.intensity === 0)).toBe(true);
  sky.update();
  expect(sky.group.visible).toBe(false);
  expect(sky.candidates()).toEqual([]);
  expect(sky.lights).toEqual(lights);
  const dispose = vi.spyOn(lights[0]!, "dispose");
  sky.dispose();
  expect(dispose).toHaveBeenCalledOnce();
  expect(sky.group.children).toHaveLength(0);
});

it("bounds experimental rectangular samples and preserves one-sided orientation and total output", () => {
  const common = {
    positionCm: { x: 100, y: 200, z: 230 },
    lumens: 2400,
    kelvin: 3000,
    orientation: { headingDegrees: 0, pitchDegrees: 90, rollDegrees: 45 },
  };
  for (const input of [
    { ...common, type: "linear" as const, lengthCm: 1000 },
    { ...common, type: "area" as const, widthCm: 1000, heightCm: 1000 },
  ]) {
    const proxies = rectangularProxies(input);
    expect(proxies).toHaveLength(input.type === "linear" ? 4 : 9);
    expect(proxies.reduce((sum, light) => sum + light.lumens, 0)).toBeCloseTo(common.lumens);
    expect(
      proxies.every((light) => light.type === "spot" && light.orientation === input.orientation),
    ).toBe(true);
  }
  expect(VXGI_CONFIGURATION).toMatchObject({
    resolution: 256,
    directionalRadiance: true,
    bounces: 0,
    coneCount: 1,
    coneAngle: 25,
    giIntensity: 8,
    normalOffset: 0.5,
    lightBudget: 32,
    convergenceFrames: 32,
  });
});
