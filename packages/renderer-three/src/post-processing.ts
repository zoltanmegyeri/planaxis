/** Transient renderer settings; never part of quality or design persistence. */
export interface RendererPostProcessingSettings {
  readonly bloomEnabled: boolean;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
}

export const DEFAULT_POST_PROCESSING_SETTINGS: RendererPostProcessingSettings = Object.freeze({
  bloomEnabled: true,
  bloomStrength: 0.05,
  bloomRadius: 0.1,
  bloomThreshold: 5,
});

export function isRendererPostProcessingSettings(
  value: unknown,
): value is RendererPostProcessingSettings {
  if (typeof value !== "object" || value === null) return false;
  return (
    "bloomEnabled" in value &&
    typeof value.bloomEnabled === "boolean" &&
    "bloomStrength" in value &&
    typeof value.bloomStrength === "number" &&
    Number.isFinite(value.bloomStrength) &&
    value.bloomStrength >= 0 &&
    "bloomRadius" in value &&
    typeof value.bloomRadius === "number" &&
    Number.isFinite(value.bloomRadius) &&
    value.bloomRadius >= 0 &&
    value.bloomRadius <= 1 &&
    "bloomThreshold" in value &&
    typeof value.bloomThreshold === "number" &&
    Number.isFinite(value.bloomThreshold) &&
    value.bloomThreshold >= 0
  );
}
