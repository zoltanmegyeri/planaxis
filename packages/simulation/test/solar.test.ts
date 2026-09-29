import { afterEach, expect, it, vi } from "vitest";
import { calculateSolarPosition, planaxisSunDirection } from "../src/index.js";

afterEach(() => vi.unstubAllEnvs());

// Independently evaluated NOAA Meeus calculator, with calcRefraction disabled:
// https://gml.noaa.gov/grad/solcalc/main.js (retrieved 2026-09-29).
// Its fuller calculation is the reference, not our fractional-year approximation.
// Half a degree is adequate for this visualization foundation (not photometry).
it.each([
  [39.742476, -105.1786, "2003-10-17T19:30:30Z", 194.34258, 39.87207],
  [47.4979, 19.0402, "2024-06-21T08:00:00Z", 111.43932, 49.28737],
  [47.4979, 19.0402, "2024-12-21T12:00:00Z", 198.63284, 16.93024],
  [-33.8688, 151.2093, "2024-12-21T22:00:00Z", 94.5723, 38.3586],
  [51.4779, 0, "2024-03-20T16:00:00Z", 244.2399, 19.34141],
  [69.6492, 18.9553, "2024-12-21T12:00:00Z", 197.76801, -4.12512],
  [47.4979, 19.0402, "2024-06-21T22:00:00Z", 348.92542, -18.31929],
] as const)("matches NOAA reference at %s, %s, %s", (lat, lon, date, azimuth, elevation) => {
  const input = Date.parse(date);
  const sun = calculateSolarPosition(lat, lon, input);
  expect(Math.abs(sun.azimuth - azimuth)).toBeLessThan(0.5);
  expect(Math.abs(sun.elevation - elevation)).toBeLessThan(0.5);
  expect(calculateSolarPosition(lat, lon, input)).toEqual(sun);
});

it("uses the explicit instant independently of local time zone and equivalent offsets", () => {
  const instant = Date.parse("2024-06-21T08:00:00Z");
  const expected = calculateSolarPosition(47.5, 19, instant);
  for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Europe/Budapest"]) {
    vi.stubEnv("TZ", zone);
    expect(calculateSolarPosition(47.5, 19, instant)).toEqual(expected);
    expect(calculateSolarPosition(47.5, 19, Date.parse("2024-06-21T10:00:00+02:00"))).toEqual(
      expected,
    );
  }
});

it.each([
  [270, 0, 0, [0, -1, 0]],
  [270, 90, 0, [1, 0, 0]],
  [270, 180, 0, [0, 1, 0]],
  [270, 270, 0, [-1, 0, 0]],
  [0, 0, 0, [1, 0, 0]],
  [90, 0, 0, [0, 1, 0]],
  [180, 0, 0, [-1, 0, 0]],
  [270, 90, 90, [0, 0, 1]],
  [270, 90, -90, [0, 0, -1]],
] as const)("maps north %s, azimuth %s, elevation %s", (north, azimuth, elevation, expected) => {
  const direction = planaxisSunDirection(north, { azimuth, elevation });
  [direction.x, direction.y, direction.z].forEach((value, index) =>
    expect(value).toBeCloseTo(expected[index]!),
  );
  expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1);
});

it.each([
  [NaN, 0, 0],
  [91, 0, 0],
  [0, 181, 0],
  [0, 0, Infinity],
  [0, 0, 8.65e15],
])("rejects invalid solar inputs %s %s %s", (lat, lon, instant) => {
  expect(() => calculateSolarPosition(lat, lon, instant)).toThrow(RangeError);
});
