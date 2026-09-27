export const QUALITY_LEVELS = ["Off", "Low", "Medium", "High"] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];

/** Runtime preferences only; independent of architecture and persisted designs. */
export interface RendererQualitySettings {
  readonly pixelRatio: number;
  readonly shadowQuality: QualityLevel;
  readonly environmentLightingEnabled: boolean;
  readonly fillLightLevel: QualityLevel;
}

export const DEFAULT_QUALITY_SETTINGS: RendererQualitySettings = Object.freeze({
  pixelRatio: 1,
  shadowQuality: "Medium",
  environmentLightingEnabled: true,
  fillLightLevel: "Off",
});

// All enabled levels use PCF filtering and a two-texel, bounds-scaled normal bias.
export const SHADOW_MAP_SIZES = { Off: 0, Low: 1024, Medium: 2048, High: 4096 } as const;
// White AmbientLight supplies non-directional diffuse fill without replacing PBR materials.
export const FILL_LIGHT_INTENSITIES = { Off: 0, Low: 0.5, Medium: 1, High: 2 } as const;

export function isQualityLevel(value: unknown): value is QualityLevel {
  return QUALITY_LEVELS.some((level) => level === value);
}

export function isRendererQualitySettings(value: unknown): value is RendererQualitySettings {
  if (typeof value !== "object" || value === null) return false;
  return (
    "pixelRatio" in value &&
    typeof value.pixelRatio === "number" &&
    Number.isFinite(value.pixelRatio) &&
    value.pixelRatio > 0 &&
    "shadowQuality" in value &&
    isQualityLevel(value.shadowQuality) &&
    "environmentLightingEnabled" in value &&
    typeof value.environmentLightingEnabled === "boolean" &&
    "fillLightLevel" in value &&
    isQualityLevel(value.fillLightLevel)
  );
}
