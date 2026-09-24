import { createDecimal as decimal } from "@planaxis/geometry";
import { expect, it } from "vitest";
import {
  createSurfaceMapping,
  resolveRuntimeFinish,
  validateRuntimePbrMaterial,
} from "../src/index.js";
import type {
  BaseFinishTarget,
  RuntimeFinishAssignments,
  RuntimePbrMaterial,
  SpaceFinishTarget,
} from "../src/index.js";

const material: RuntimePbrMaterial = { baseColor: [0.2, 0.5, 1], roughness: 0.8, metalness: 0 };
const aoTextures = {
  widthCm: decimal("25"),
  heightCm: decimal("50"),
  ambientOcclusionMap: Symbol(),
};

it.each([0, 0.4, 1])("accepts effective AO strength %s", (ambientOcclusionStrength) => {
  expect(() =>
    validateRuntimePbrMaterial({ ...material, textures: aoTextures, ambientOcclusionStrength }),
  ).not.toThrow();
});

it.each([-0.01, 1.01, NaN, Infinity, -Infinity])(
  "rejects invalid AO strength %s",
  (ambientOcclusionStrength) => {
    expect(() =>
      validateRuntimePbrMaterial({ ...material, textures: aoTextures, ambientOcclusionStrength }),
    ).toThrow(RangeError);
  },
);

it("requires the AO map and effective strength together", () => {
  expect(() => validateRuntimePbrMaterial({ ...material, ambientOcclusionStrength: 0 })).toThrow(
    RangeError,
  );
  expect(() => validateRuntimePbrMaterial({ ...material, textures: aoTextures })).toThrow(
    RangeError,
  );
});

it("resolves explicit space assignment, then base assignment, then neutral absence", () => {
  const mapping = createSurfaceMapping("z", "positive", decimal("0"), decimal("0"));
  const base: BaseFinishTarget = { scope: "base", id: "floor", mapping };
  const space: SpaceFinishTarget = {
    scope: "space",
    id: "space:room:floor",
    baseTargetId: "floor",
    spaceId: "room",
    coverage: [],
    mapping,
  };
  const override = { ...material, roughness: 0.3 };
  const assignments: RuntimeFinishAssignments = new Map([
    [base.id, material],
    [space.id, override],
  ]);
  expect(resolveRuntimeFinish(space, assignments)).toBe(override);
  expect(resolveRuntimeFinish(base, assignments)).toBe(material);
  expect(resolveRuntimeFinish(space, new Map([[base.id, material]]))).toBe(material);
  expect(resolveRuntimeFinish(space, new Map())).toBeUndefined();
  expect(resolveRuntimeFinish(base, new Map([[space.id, override]]))).toBeUndefined();
});

it.each([-0.001, 1.001, NaN, Infinity])("rejects out-of-range PBR scalars %s", (value) => {
  for (const invalid of [
    { ...material, roughness: value },
    { ...material, metalness: value },
    { ...material, baseColor: [value, 0, 0] as const },
    { ...material, alpha: { mode: "blend" as const, opacity: value } },
    { ...material, alpha: { mode: "mask" as const, opacity: 1, cutoff: value } },
  ])
    expect(() => validateRuntimePbrMaterial(invalid)).toThrow(RangeError);
});

it.each(["0", "-1", "Infinity", "NaN"])(
  "rejects invalid physical repeat dimensions %s",
  (value) => {
    for (const [width, height] of [
      [value, "20"],
      ["20", value],
    ] as const)
      expect(() =>
        validateRuntimePbrMaterial({
          ...material,
          textures: { widthCm: decimal(width), heightCm: decimal(height) },
        }),
      ).toThrow(RangeError);
  },
);

it("accepts scalar endpoints and exact positive physical sizes without renderer objects", () => {
  expect(() =>
    validateRuntimePbrMaterial({
      baseColor: [0, 1, 0],
      roughness: 0,
      metalness: 1,
      alpha: { mode: "mask", opacity: 0, cutoff: 1 },
      textures: { widthCm: decimal("0.0001"), heightCm: decimal("125.25"), baseColorMap: Symbol() },
    }),
  ).not.toThrow();
});
