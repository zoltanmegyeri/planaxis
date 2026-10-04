import { expect, it } from "vitest";
import { validateDesignDescriptor } from "@planaxis/design";
import { designLuminaires } from "../src/design-luminaires.js";

const base = { name: "Lighting", architecture: "architecture/a.svg" };
const common = {
  position: { x: 100, y: 200, z: 350 },
  luminousFluxLumens: 1000,
  colorTemperatureKelvin: 2700,
  enabled: true,
  dimming: 0.5,
};
const orientation = { headingDegrees: 90, pitchDegrees: 90, rollDegrees: 45 };
it("explicitly adapts all four types without persistence fields or shared objects", () => {
  const descriptor = validateDesignDescriptor(
    {
      ...base,
      schema: "planaxis-design/1.1",
      luminaires: [
        { ...common, id: "p", type: "point" },
        { ...common, id: "s", type: "spot", orientation, beamAngleDegrees: 50 },
        { ...common, id: "l", type: "linear", orientation, lengthCm: 150 },
        { ...common, id: "a", type: "area", orientation, widthCm: 80, heightCm: 40 },
      ],
    },
    "designs/a.json",
  );
  if (!descriptor.ok) throw new Error("Invalid fixture");
  const result = designLuminaires(descriptor.value);
  expect(result).toEqual([
    { positionCm: common.position, lumens: 500, kelvin: 2700, type: "point" },
    {
      positionCm: common.position,
      lumens: 500,
      kelvin: 2700,
      type: "spot",
      orientation,
      beamAngleDegrees: 50,
    },
    {
      positionCm: common.position,
      lumens: 500,
      kelvin: 2700,
      type: "linear",
      orientation,
      lengthCm: 150,
    },
    {
      positionCm: common.position,
      lumens: 500,
      kelvin: 2700,
      type: "area",
      orientation,
      widthCm: 80,
      heightCm: 40,
    },
  ]);
  expect(result[0]?.positionCm).not.toBe(descriptor.value.document.luminaires?.[0]?.position);
});
it.each([
  [false, 1, 0],
  [true, 0, 0],
  [true, 0.25, 250],
  [true, 1, 1000],
])("maps enabled=%s and dimming=%s to %s lumens", (enabled, dimming, lumens) => {
  const descriptor = validateDesignDescriptor(
    {
      ...base,
      schema: "planaxis-design/1.1",
      luminaires: [{ ...common, id: "p", type: "point", enabled, dimming }],
    },
    "designs/a.json",
  );
  if (!descriptor.ok) throw new Error("Invalid fixture");
  expect(designLuminaires(descriptor.value)[0]?.lumens).toBe(lumens);
});
it("returns no luminaires for no design, Design 1.0 and empty Design 1.1", () => {
  expect(designLuminaires()).toEqual([]);
  for (const schema of ["planaxis-design/1.0", "planaxis-design/1.1"]) {
    const descriptor = validateDesignDescriptor({ ...base, schema }, "designs/a.json");
    if (!descriptor.ok) throw new Error("Invalid fixture");
    expect(designLuminaires(descriptor.value)).toEqual([]);
  }
});
