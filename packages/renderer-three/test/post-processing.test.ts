import { expect, it } from "vitest";
import {
  DEFAULT_POST_PROCESSING_SETTINGS,
  isRendererPostProcessingSettings,
} from "../src/index.js";

it("exports conservative, valid and immutable runtime defaults", () => {
  expect(DEFAULT_POST_PROCESSING_SETTINGS).toEqual({
    bloomEnabled: true,
    bloomStrength: 0.05,
    bloomRadius: 0.1,
    bloomThreshold: 5,
  });
  expect(Object.isFrozen(DEFAULT_POST_PROCESSING_SETTINGS)).toBe(true);
  expect(isRendererPostProcessingSettings(DEFAULT_POST_PROCESSING_SETTINGS)).toBe(true);
  expect(
    isRendererPostProcessingSettings({
      bloomEnabled: false,
      bloomStrength: 0,
      bloomRadius: 0,
      bloomThreshold: 0,
    }),
  ).toBe(true);
  expect(
    isRendererPostProcessingSettings({
      bloomEnabled: true,
      bloomStrength: 10,
      bloomRadius: 1,
      bloomThreshold: 100,
    }),
  ).toBe(true);
});

it.each([
  null,
  undefined,
  {},
  true,
  ...["bloomEnabled", "bloomStrength", "bloomRadius", "bloomThreshold"].map((key) => ({
    ...DEFAULT_POST_PROCESSING_SETTINGS,
    [key]: undefined,
  })),
  ...[0, "true", null].map((bloomEnabled) => ({
    ...DEFAULT_POST_PROCESSING_SETTINGS,
    bloomEnabled,
  })),
  ...["bloomStrength", "bloomRadius", "bloomThreshold"].flatMap((key) =>
    [NaN, Infinity, -Infinity, -0.01, "1"].map((value) => ({
      ...DEFAULT_POST_PROCESSING_SETTINGS,
      [key]: value,
    })),
  ),
  { ...DEFAULT_POST_PROCESSING_SETTINGS, bloomRadius: 1.01 },
])("rejects invalid runtime settings: %j", (value) => {
  expect(isRendererPostProcessingSettings(value)).toBe(false);
});
