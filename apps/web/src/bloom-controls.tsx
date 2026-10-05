import type { RendererPostProcessingSettings } from "@planaxis/renderer-three";
import type { ReactElement } from "react";

export function BloomControls({
  settings,
  ready,
  onEdit,
}: {
  settings: RendererPostProcessingSettings;
  ready: boolean;
  onEdit: (update: Partial<RendererPostProcessingSettings>) => void;
}): ReactElement {
  return (
    <>
      <label>
        Bloom enabled{" "}
        <input
          type="checkbox"
          aria-label="Bloom enabled"
          disabled={!ready}
          checked={settings.bloomEnabled}
          onChange={(event) => onEdit({ bloomEnabled: event.target.checked })}
        />
      </label>
      {(
        [
          ["bloomStrength", "Bloom strength", 2, 0.01],
          ["bloomRadius", "Bloom radius", 1, 0.05],
          ["bloomThreshold", "Bloom threshold", 10, 0.1],
        ] as const
      ).map(([field, label, max, step]) => (
        <label className="presentation-slider" key={field}>
          {label}: {settings[field]}
          <input
            type="range"
            aria-label={label}
            min={0}
            max={max}
            step={step}
            disabled={!ready}
            value={settings[field]}
            onChange={(event) => onEdit({ [field]: Number(event.target.value) })}
          />
        </label>
      ))}
    </>
  );
}
