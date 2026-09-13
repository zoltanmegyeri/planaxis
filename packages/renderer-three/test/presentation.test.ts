import { expect, it } from "vitest";
import { Scene, AgXToneMapping, ACESFilmicToneMapping, NeutralToneMapping } from "three/webgpu";
import type { WebGPURenderer } from "three/webgpu";
import { applyPresentationSettings } from "../src/presentation.js";
import { DEFAULT_PRESENTATION_SETTINGS, PRESENTATION_TONE_MAPPINGS } from "../src/index.js";

it("defines deterministic neutral defaults and a closed tone-mapping vocabulary", () => {
  expect(DEFAULT_PRESENTATION_SETTINGS).toEqual({
    environmentIntensity: 1,
    environmentRotationDegrees: 0,
    toneMapping: "AgX",
    exposureEv: 0,
  });
  expect(PRESENTATION_TONE_MAPPINGS).toEqual(["AgX", "ACES Filmic", "Neutral"]);
});

it.each([
  ["AgX", AgXToneMapping],
  ["ACES Filmic", ACESFilmicToneMapping],
  ["Neutral", NeutralToneMapping],
] as const)("maps %s internally", (toneMapping, expected) => {
  const renderer = {} as WebGPURenderer;
  applyPresentationSettings(renderer, new Scene(), {
    ...DEFAULT_PRESENTATION_SETTINGS,
    toneMapping,
  });
  expect(renderer.toneMapping).toBe(expected);
});

it.each([
  [-4, 0.0625],
  [-1, 0.5],
  [0, 1],
  [1, 2],
  [4, 16],
  [8, 256],
])("converts %s EV to %s without imposing browser bounds", (exposureEv, multiplier) => {
  const renderer = {} as WebGPURenderer;
  applyPresentationSettings(renderer, new Scene(), {
    ...DEFAULT_PRESENTATION_SETTINGS,
    exposureEv,
  });
  expect(renderer.toneMappingExposure).toBe(multiplier);
});

it.each([
  [0, 0],
  [90, -Math.PI / 2],
  [450, -Math.PI / 2],
  [-90, (-3 * Math.PI) / 2],
  [720, 0],
])("wraps %s degrees into architectural yaw", (environmentRotationDegrees, radians) => {
  const scene = new Scene();
  applyPresentationSettings({} as WebGPURenderer, scene, {
    ...DEFAULT_PRESENTATION_SETTINGS,
    environmentRotationDegrees,
    environmentIntensity: 12,
  });
  expect(scene.environmentRotation.x).toBe(0);
  expect(scene.environmentRotation.y).toBeCloseTo(radians);
  expect(scene.environmentRotation.z).toBe(0);
  expect(scene.environmentIntensity).toBe(12);
});
