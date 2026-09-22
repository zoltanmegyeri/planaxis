import type { DesignPresentation, DesignToneMapping } from "@planaxis/design";
import { DEFAULT_PRESENTATION_SETTINGS } from "@planaxis/renderer-three";
import type {
  PresentationToneMapping,
  RendererPresentationSettings,
} from "@planaxis/renderer-three";

export type ScenarioPresentation = Pick<RendererPresentationSettings, "toneMapping" | "exposureEv">;
const TONE_MAPPINGS: Record<DesignToneMapping, PresentationToneMapping> = {
  agx: "AgX",
  "aces-filmic": "ACES Filmic",
  neutral: "Neutral",
};

/** Format validity is independent of slider bounds and renderer multiplier limits. */
export function designPresentation(presentation?: DesignPresentation): ScenarioPresentation {
  return {
    toneMapping:
      presentation?.toneMapping === undefined
        ? DEFAULT_PRESENTATION_SETTINGS.toneMapping
        : TONE_MAPPINGS[presentation.toneMapping],
    exposureEv: presentation?.exposureEv ?? DEFAULT_PRESENTATION_SETTINGS.exposureEv,
  };
}
