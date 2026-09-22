import { expect, it } from "vitest";
import { validateDesignDescriptor } from "@planaxis/design";
import { DEFAULT_PRESENTATION_SETTINGS } from "@planaxis/renderer-three";
import { designPresentation } from "../src/design-presentation.js";
import { designDraft, editDesign } from "../src/design-editing.js";

it.each([
  ["agx", "AgX"],
  ["aces-filmic", "ACES Filmic"],
  ["neutral", "Neutral"],
] as const)("maps %s explicitly to %s", (toneMapping, rendererTone) => {
  expect(designPresentation({ toneMapping })).toEqual({
    toneMapping: rendererTone,
    exposureEv: DEFAULT_PRESENTATION_SETTINGS.exposureEv,
  });
});
it("uses current defaults independently for absent overrides without clamping exposure", () => {
  expect(designPresentation()).toEqual({
    toneMapping: DEFAULT_PRESENTATION_SETTINGS.toneMapping,
    exposureEv: DEFAULT_PRESENTATION_SETTINGS.exposureEv,
  });
  expect(designPresentation({ exposureEv: 1e308 }).exposureEv).toBe(1e308);
});
it("validates draft input with the shared format boundary and removes either override independently", () => {
  const descriptor = validateDesignDescriptor(
    {
      schema: "planaxis-design/1.0",
      name: "Original",
      architecture: "architecture/a.svg",
      presentation: { toneMapping: "neutral", exposureEv: 7 },
    },
    "designs/a.json",
  );
  if (!descriptor.ok) throw new Error("Invalid test descriptor");
  const draft = designDraft(descriptor.value);
  const removedExposure = editDesign(descriptor.value, { ...draft, exposureEv: "" });
  expect(removedExposure).toMatchObject({
    ok: true,
    value: { document: { presentation: { toneMapping: "neutral" } } },
  });
  if (removedExposure.ok)
    expect(removedExposure.value.document.presentation).not.toHaveProperty("exposureEv");
  expect(editDesign(descriptor.value, { ...draft, exposureEv: "Infinity" })).toMatchObject({
    ok: false,
    error: { code: "DESIGN_INVALID_EXPOSURE" },
  });
  expect(editDesign(descriptor.value, { ...draft, name: "  " })).toMatchObject({
    ok: false,
    error: { code: "DESIGN_INVALID_NAME" },
  });
});
