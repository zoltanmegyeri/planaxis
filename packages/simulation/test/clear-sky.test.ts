import { expect, it } from "vitest";
import { calculateClearSkyReference, SUNNY_REFERENCE } from "../src/clear-sky.js";
import { calculateSolarPosition, planaxisSunDirection, createCivilClock } from "../src/index.js";

it("reproduces independent ASHRAE tau reference calculations and photometric assumptions", () => {
  // Independently evaluated from EnergyPlus 24.2 equations using b=.4, d=2.3, E0=1361.
  // Values are recorded by the engineering report, not a second call to the implementation.
  const result = calculateClearSkyReference(60);
  expect(result.directNormalWattsPerSquareMeter).toBeCloseTo(874.9256932774, 4);
  expect(result.diffuseHorizontalWattsPerSquareMeter).toBeCloseTo(126.3275078489, 4);
  expect(result.directNormalLux).toBeCloseTo(result.directNormalWattsPerSquareMeter * 100, 10);
  expect(result.diffuseHorizontalLux).toBeCloseTo(
    result.diffuseHorizontalWattsPerSquareMeter * 120,
    10,
  );
  expect(SUNNY_REFERENCE.directLumensPerWatt).toBe(100);
});
it("is deterministic, finite and smoothly increasing through low Sun and night", () => {
  let previous = 0;
  for (let e = -90; e <= 90; e += 0.25) {
    const r = calculateClearSkyReference(e);
    expect(Object.values(r).every((x) => Number.isFinite(x) && x >= 0)).toBe(true);
    expect(r).toEqual(calculateClearSkyReference(e));
    if (e <= 0) expect(r.directNormalLux).toBe(0);
    if (e <= -6) expect(r.diffuseHorizontalLux).toBe(0);
    expect(r.diffuseHorizontalLux).toBeCloseTo(r.diffuseHorizontalWattsPerSquareMeter * 120, 7);
    expect(r.diffuseHorizontalLux).toBeGreaterThanOrEqual(previous);
    previous = r.diffuseHorizontalLux;
  }
  expect(calculateClearSkyReference(0).diffuseHorizontalLux).toBe(100);
  expect(calculateClearSkyReference(-3).diffuseHorizontalLux).toBe(50);
  expect(calculateClearSkyReference(-3).diffuseHorizontalWattsPerSquareMeter).toBeCloseTo(
    5 / 12,
    12,
  );
  expect(calculateClearSkyReference(0.000001).directNormalLux).toBeLessThan(1e-6);
  for (const e of [NaN, Infinity, -Infinity, 90.01, -90.01])
    expect(() => calculateClearSkyReference(e)).toThrow(RangeError);
});
it("uses the actual explicitly zoned instant and preserves orientation and polar night", () => {
  const clock = createCivilClock("Europe/Budapest");
  const instant = Date.UTC(2026, 5, 21, 10);
  const sun = calculateSolarPosition(47.4979, 19.0402, instant);
  expect(sun.elevation).toBeGreaterThan(60);
  const direction = planaxisSunDirection(270, sun);
  expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
  expect(calculateClearSkyReference(sun.elevation).directNormalLux).toBeGreaterThan(80000);
  expect(clock.at(instant)).toEqual({ year: 2026, day: 172, minute: 720 });
  expect(clock.resolve({ year: 2026, day: 172, minute: 720 })).toEqual({
    status: "exact",
    instant,
  });
  for (const latitude of [-90, 90]) {
    const winter = calculateSolarPosition(
      latitude,
      0,
      Date.UTC(2026, latitude > 0 ? 11 : 5, 21, 12),
    );
    expect(calculateClearSkyReference(winter.elevation).directNormalLux).toBe(0);
    expect(calculateClearSkyReference(winter.elevation).diffuseHorizontalLux).toBe(0);
  }
});
