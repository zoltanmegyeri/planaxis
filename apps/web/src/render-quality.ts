import { isRendererQualitySettings } from "@planaxis/renderer-three";
import type { RendererQualitySettings } from "@planaxis/renderer-three";

export const QUALITY_PRESETS = ["Performance", "Balanced", "High"] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];
export interface QualityPreference {
  readonly preset: QualityPreset | "Custom";
  readonly settings: RendererQualitySettings;
}
export const QUALITY_STORAGE_KEY = "planaxis.render-quality.v1";

export function nativePixelRatio(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function pixelRatioOptions(native: number): readonly number[] {
  const ratio = nativePixelRatio(native);
  const options: number[] = [];
  for (let integer = 1; integer < ratio; integer++) options.push(integer);
  options.push(ratio);
  return options;
}

export function isQualityPreset(value: unknown): value is QualityPreset {
  return QUALITY_PRESETS.some((preset) => preset === value);
}

export function qualityPreset(preset: QualityPreset, native: number): QualityPreference {
  const ratio = nativePixelRatio(native);
  // Performance removes shadow/IBL work; neutral fill keeps diffuse textures inspectable.
  if (preset === "Performance") {
    return {
      preset,
      settings: {
        pixelRatio: 1,
        shadowQuality: "Off",
        environmentLightingEnabled: false,
        fillLightLevel: "Medium",
      },
    };
  }
  return {
    preset,
    settings: {
      pixelRatio: preset === "Balanced" ? Math.min(2, ratio) : ratio,
      shadowQuality: preset === "Balanced" ? "Medium" : "High",
      environmentLightingEnabled: true,
      fillLightLevel: "Off",
    },
  };
}

export function editQuality(
  current: QualityPreference,
  update: Partial<RendererQualitySettings>,
): QualityPreference {
  const settings = { ...current.settings, ...update };
  const changed = (Object.keys(settings) as (keyof RendererQualitySettings)[]).some(
    (key) => settings[key] !== current.settings[key],
  );
  return { preset: changed ? "Custom" : current.preset, settings };
}

/** Named presets track the display; Custom rounds down to an available DPR. */
export function adaptQuality(current: QualityPreference, native: number): QualityPreference {
  if (current.preset !== "Custom") return qualityPreset(current.preset, native);
  const options = pixelRatioOptions(native);
  const pixelRatio =
    options.filter((value) => value <= current.settings.pixelRatio).at(-1) ?? options[0] ?? 1;
  return { preset: "Custom", settings: { ...current.settings, pixelRatio } };
}

export function restoreQuality(native: number): QualityPreference {
  const fallback = qualityPreset("Balanced", native);
  try {
    const text = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    if (text === null) return fallback;
    const value: unknown = JSON.parse(text);
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1 ||
      !("preset" in value) ||
      (!isQualityPreset(value.preset) && value.preset !== "Custom") ||
      !("settings" in value) ||
      !isRendererQualitySettings(value.settings)
    )
      return fallback;
    const { pixelRatio, shadowQuality, environmentLightingEnabled, fillLightLevel } =
      value.settings;
    return adaptQuality(
      {
        preset: value.preset,
        settings: { pixelRatio, shadowQuality, environmentLightingEnabled, fillLightLevel },
      },
      native,
    );
  } catch {
    // Unavailable storage or malformed preferences must never block the viewport.
    return fallback;
  }
}

export function persistQuality(preference: QualityPreference): void {
  try {
    const { pixelRatio, shadowQuality, environmentLightingEnabled, fillLightLevel } =
      preference.settings;
    window.localStorage.setItem(
      QUALITY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        preset: preference.preset,
        settings: { pixelRatio, shadowQuality, environmentLightingEnabled, fillLightLevel },
      }),
    );
  } catch {
    // Storage is optional; keep the successfully applied session preference.
    return;
  }
}

/** Recommendations run only at restoration or an explicit named-preset selection. */
export function recommendGlobalIllumination(
  preset: QualityPreference["preset"],
  available: boolean,
): boolean {
  return preset === "High" && available;
}
