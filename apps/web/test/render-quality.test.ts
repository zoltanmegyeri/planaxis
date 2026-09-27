import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  adaptQuality,
  editQuality,
  persistQuality,
  pixelRatioOptions,
  qualityPreset,
  QUALITY_STORAGE_KEY,
  restoreQuality,
} from "../src/render-quality.js";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it.each([
  [1, [1]],
  [1.25, [1, 1.25]],
  [2, [1, 2]],
  [2.5, [1, 2, 2.5]],
  [3, [1, 2, 3]],
  [0.75, [0.75]],
  [NaN, [1]],
  [Infinity, [1]],
  [-Infinity, [1]],
  [0, [1]],
  [-2, [1]],
])("derives DPR options for native %s", (native, expected) => {
  expect(pixelRatioOptions(native as number)).toEqual(expected);
});

it.each([1, 1.25, 2, 2.5, 3])("defines deterministic presets at native DPR %s", (native) => {
  expect(qualityPreset("Performance", native)).toEqual({
    preset: "Performance",
    settings: {
      pixelRatio: 1,
      shadowQuality: "Off",
      environmentLightingEnabled: false,
      fillLightLevel: "Medium",
    },
  });
  expect(qualityPreset("Balanced", native)).toEqual({
    preset: "Balanced",
    settings: {
      pixelRatio: Math.min(2, native),
      shadowQuality: "Medium",
      environmentLightingEnabled: true,
      fillLightLevel: "Off",
    },
  });
  expect(qualityPreset("High", native)).toEqual({
    preset: "High",
    settings: {
      pixelRatio: native,
      shadowQuality: "High",
      environmentLightingEnabled: true,
      fillLightLevel: "Off",
    },
  });
});

it.each([
  { pixelRatio: 1 },
  { shadowQuality: "Low" as const },
  { environmentLightingEnabled: false },
  { fillLightLevel: "Low" as const },
])("marks manual changes Custom: %j", (update) => {
  const balanced = qualityPreset("Balanced", 3);
  expect(editQuality(balanced, update)).toEqual({
    preset: "Custom",
    settings: { ...balanced.settings, ...update },
  });
  expect(editQuality(balanced, balanced.settings)).toEqual(balanced);
});

it("restores saved Custom preferences, strips unrelated fields, and adapts DPR downward", () => {
  const preference = editQuality(qualityPreset("High", 3), { fillLightLevel: "Low" });
  persistQuality(preference);
  expect(restoreQuality(3)).toEqual(preference);
  expect(restoreQuality(2.5).settings.pixelRatio).toBe(2.5);
  expect(restoreQuality(1.25).settings.pixelRatio).toBe(1.25);
  expect(
    adaptQuality({ ...preference, settings: { ...preference.settings, pixelRatio: 1.25 } }, 3)
      .settings.pixelRatio,
  ).toBe(1);
  const raw = JSON.parse(window.localStorage.getItem(QUALITY_STORAGE_KEY) ?? "null");
  raw.settings.exposureEv = 4;
  raw.camera = "@walk";
  window.localStorage.setItem(QUALITY_STORAGE_KEY, JSON.stringify(raw));
  expect(restoreQuality(3)).toEqual(preference);
  persistQuality(restoreQuality(3));
  expect(JSON.parse(window.localStorage.getItem(QUALITY_STORAGE_KEY) ?? "null")).toEqual({
    version: 1,
    ...preference,
  });
});

it.each(["Performance", "Balanced", "High"] as const)(
  "restores %s using the new display policy",
  (preset) => {
    persistQuality(qualityPreset(preset, 3));
    expect(restoreQuality(1.25)).toEqual(qualityPreset(preset, 1.25));
    expect(restoreQuality(4)).toEqual(qualityPreset(preset, 4));
  },
);

it.each([
  null,
  "{",
  "null",
  "[]",
  "{}",
  JSON.stringify({ version: 2, ...qualityPreset("High", 3) }),
  JSON.stringify({ version: 1, ...qualityPreset("High", 3), preset: "Ultra" }),
  ...[
    { pixelRatio: 0 },
    { pixelRatio: "2" },
    { pixelRatio: null },
    { shadowQuality: "Ultra" },
    { fillLightLevel: "toString" },
    { environmentLightingEnabled: "false" },
  ].map((invalid) =>
    JSON.stringify({
      version: 1,
      preset: "Custom",
      settings: { ...qualityPreset("Balanced", 3).settings, ...invalid },
    }),
  ),
])("falls back to Balanced for absent or malformed storage: %s", (text) => {
  if (text !== null) window.localStorage.setItem(QUALITY_STORAGE_KEY, text);
  expect(restoreQuality(2.5)).toEqual(qualityPreset("Balanced", 2.5));
});

it("tolerates denied storage access and failed reads/writes", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("Storage denied");
  });
  expect(restoreQuality(3)).toEqual(qualityPreset("Balanced", 3));
  expect(() => persistQuality(qualityPreset("High", 3))).not.toThrow();
  vi.restoreAllMocks();
  vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
    throw new Error("Read denied");
  });
  vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
    throw new Error("Quota exceeded");
  });
  expect(restoreQuality(3)).toEqual(qualityPreset("Balanced", 3));
  expect(() => persistQuality(qualityPreset("High", 3))).not.toThrow();
});
