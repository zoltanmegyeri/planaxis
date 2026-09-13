import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping } from "three/webgpu";
import type { Scene, ToneMapping, WebGPURenderer } from "three/webgpu";

export const PRESENTATION_TONE_MAPPINGS = ["AgX", "ACES Filmic", "Neutral"] as const;
export type PresentationToneMapping = (typeof PRESENTATION_TONE_MAPPINGS)[number];

/** Transient renderer state; never part of architectural or project persistence. */
export interface RendererPresentationSettings {
  readonly environmentIntensity: number;
  /** Finite degrees wrapped to [0, 360); positive yaw turns architectural +X toward +Y. */
  readonly environmentRotationDegrees: number;
  readonly toneMapping: PresentationToneMapping;
  /** Finite EV with a representable, positive 2 ** EV multiplier. */
  readonly exposureEv: number;
}

export const DEFAULT_PRESENTATION_SETTINGS: RendererPresentationSettings = Object.freeze({
  environmentIntensity: 1,
  environmentRotationDegrees: 0,
  toneMapping: "AgX",
  exposureEv: 0,
});

export function isPresentationToneMapping(value: unknown): value is PresentationToneMapping {
  return PRESENTATION_TONE_MAPPINGS.some((candidate) => candidate === value);
}

const toneMappings: Record<PresentationToneMapping, ToneMapping> = {
  AgX: AgXToneMapping,
  "ACES Filmic": ACESFilmicToneMapping,
  Neutral: NeutralToneMapping,
};

/** Validate the entire update before changing any scene or renderer state. */
export function applyPresentationSettings(
  renderer: WebGPURenderer,
  scene: Scene,
  settings: RendererPresentationSettings,
): void {
  if (!Number.isFinite(settings.environmentIntensity) || settings.environmentIntensity < 0) {
    throw new Error("Environment intensity must be finite and non-negative.");
  }
  if (!Number.isFinite(settings.environmentRotationDegrees)) {
    throw new Error("Environment rotation must be finite degrees.");
  }
  if (!isPresentationToneMapping(settings.toneMapping)) {
    throw new Error("Tone mapping must be AgX, ACES Filmic, or Neutral.");
  }
  const exposure = 2 ** settings.exposureEv;
  if (!Number.isFinite(settings.exposureEv) || !Number.isFinite(exposure) || exposure <= 0) {
    throw new Error("Exposure EV must produce a finite, positive exposure multiplier.");
  }
  const yaw = ((settings.environmentRotationDegrees % 360) + 360) % 360;
  scene.environmentIntensity = settings.environmentIntensity;
  // The (X, Y, Z) -> (X, Z, Y) basis changes handedness: model yaw is negative Three Y.
  scene.environmentRotation.set(0, yaw === 0 ? 0 : (-yaw * Math.PI) / 180, 0);
  renderer.toneMapping = toneMappings[settings.toneMapping];
  renderer.toneMappingExposure = exposure;
}
