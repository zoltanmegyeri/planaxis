import { QUALITY_LEVELS, isQualityLevel } from "@planaxis/renderer-three";
import type { RendererQualitySettings } from "@planaxis/renderer-three";
import type { ReactElement } from "react";
import { QUALITY_PRESETS, isQualityPreset, pixelRatioOptions } from "./render-quality.js";
import type { QualityPreference, QualityPreset } from "./render-quality.js";

export function QualityControls({
  preference,
  nativeDpr,
  ready,
  onPreset,
  onEdit,
}: {
  preference: QualityPreference;
  nativeDpr: number;
  ready: boolean;
  onPreset: (preset: QualityPreset) => void;
  onEdit: (update: Partial<RendererQualitySettings>) => void;
}): ReactElement {
  const ratios = pixelRatioOptions(nativeDpr);
  return (
    <>
      <label>
        Quality{" "}
        <select
          aria-label="3D quality preset"
          disabled={!ready}
          value={preference.preset}
          onChange={(event) => {
            if (isQualityPreset(event.target.value)) onPreset(event.target.value);
          }}
        >
          {QUALITY_PRESETS.map((preset) => (
            <option key={preset}>{preset}</option>
          ))}
          <option disabled>Custom</option>
        </select>
      </label>
      <label>
        Pixel ratio{" "}
        <select
          aria-label="3D pixel ratio"
          disabled={!ready}
          value={preference.settings.pixelRatio}
          onChange={(event) => onEdit({ pixelRatio: Number(event.target.value) })}
        >
          {/* Performance explicitly uses 1 even when browser zoom makes native DPR < 1. */}
          {!ratios.includes(preference.settings.pixelRatio) && (
            <option disabled value={preference.settings.pixelRatio}>
              {preference.settings.pixelRatio}× (preset)
            </option>
          )}
          {ratios.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio}×
            </option>
          ))}
        </select>
      </label>
      <label>
        Shadows{" "}
        <select
          aria-label="3D shadow quality"
          disabled={!ready}
          value={preference.settings.shadowQuality}
          onChange={(event) => {
            if (isQualityLevel(event.target.value)) onEdit({ shadowQuality: event.target.value });
          }}
        >
          {QUALITY_LEVELS.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
      </label>
      <label>
        Environment lighting{" "}
        <input
          type="checkbox"
          aria-label="3D environment lighting"
          disabled={!ready}
          checked={preference.settings.environmentLightingEnabled}
          onChange={(event) => onEdit({ environmentLightingEnabled: event.target.checked })}
        />
      </label>
      <label>
        Fill light{" "}
        <select
          aria-label="3D fill light"
          disabled={!ready}
          value={preference.settings.fillLightLevel}
          onChange={(event) => {
            if (isQualityLevel(event.target.value)) onEdit({ fillLightLevel: event.target.value });
          }}
        >
          {QUALITY_LEVELS.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
      </label>
    </>
  );
}
