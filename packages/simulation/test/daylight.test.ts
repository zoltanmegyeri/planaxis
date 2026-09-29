import { expect, it } from "vitest";
import {
  DEFAULT_WEATHER,
  deriveDaylight,
  createCivilClock,
  daysInYear,
  formatCivilTime,
  calculateSolarPosition,
  planaxisSunDirection,
} from "../src/index.js";

it("defaults to Sunny and smoothly warms and attenuates the descending Sun", () => {
  expect(DEFAULT_WEATHER).toBe("sunny");
  const high = deriveDaylight(60);
  const low = deriveDaylight(2);
  expect(high.sunTemperatureKelvin).toBe(5600);
  expect(high.directStrength).toBe(1);
  expect(low.sunTemperatureKelvin).toBeLessThan(3000);
  expect(low.directStrength).toBeGreaterThan(0);
  expect(low.directStrength).toBeLessThan(0.05);
  const overcast = deriveDaylight(60, "overcast");
  expect(overcast.sunTemperatureKelvin).toBe(7000);
  expect(overcast.directStrength).toBeLessThan(high.directStrength / 20);
});
it("transitions continuously through twilight to night without below-horizon direct Sun", () => {
  for (const weather of ["sunny", "overcast"] as const) {
    for (const elevation of [0, -0.001, -6, -12, -90])
      expect(deriveDaylight(elevation, weather).directStrength).toBe(0);
    expect(deriveDaylight(-6, weather).twilight).toBe(0.5);
    expect(deriveDaylight(-12, weather)).toMatchObject({ day: 0, twilight: 0 });
    expect(deriveDaylight(8, weather).day).toBe(1);
    expect(
      Math.abs(deriveDaylight(0.001, weather).day - deriveDaylight(-0.001, weather).day),
    ).toBeLessThan(0.001);
  }
});
it("provides the whole leap/non-leap year and every minute in explicit UTC", () => {
  expect(daysInYear(2024)).toBe(366);
  expect(daysInYear(2026)).toBe(365);
  expect(daysInYear(2100)).toBe(365);
  const clock = createCivilClock();
  expect(clock.timeZone).toBe("UTC");
  for (const [year, day, minute, date, time] of [
    [2024, 1, 0, "2024-01-01", "00:00"],
    [2024, 60, 1439, "2024-02-29", "23:59"],
    [2024, 366, 1439, "2024-12-31", "23:59"],
    [2026, 365, 0, "2026-12-31", "00:00"],
  ] as const) {
    const civil = { year, day, minute };
    const result = clock.resolve(civil);
    expect(result).toEqual({ status: "exact", instant: Date.parse(`${date}T${time}:00Z`) });
    if (result.status !== "missing") expect(clock.at(result.instant)).toEqual(civil);
    expect(formatCivilTime(civil)).toEqual({ date, time });
  }
});
it("uses the declared zone independently of the host zone, preserving calendar fields", () => {
  const previous = process.env.TZ;
  try {
    for (const host of ["Pacific/Honolulu", "Asia/Tokyo", "UTC"]) {
      process.env.TZ = host;
      const clock = createCivilClock("Europe/Budapest");
      const civil = clock.at(Date.parse("2024-06-21T08:00:00Z"));
      expect(civil).toEqual({ year: 2024, day: 173, minute: 600 });
      expect(clock.resolve({ ...civil, day: 60 })).toEqual({
        status: "exact",
        instant: Date.parse("2024-02-29T09:00:00Z"),
      });
      expect(clock.resolve({ ...civil, minute: 1439 })).toEqual({
        status: "exact",
        instant: Date.parse("2024-06-21T21:59:00Z"),
      });
      expect(createCivilClock().at(Date.parse("2024-06-21T08:00:00Z")).minute).toBe(480);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
it("explicitly rejects DST gaps and selects the earlier repeated minute", () => {
  const clock = createCivilClock("Europe/Budapest");
  expect(clock.resolve({ year: 2024, day: 91, minute: 150 })).toEqual({ status: "missing" });
  expect(clock.resolve({ year: 2024, day: 301, minute: 150 })).toEqual({
    status: "repeated",
    instant: Date.parse("2024-10-27T00:30:00Z"),
  });
  const halfHour = createCivilClock("Australia/Lord_Howe");
  expect(halfHour.resolve({ year: 2024, day: 280, minute: 135 })).toEqual({ status: "missing" });
  expect(halfHour.resolve({ year: 2024, day: 98, minute: 105 })).toEqual({
    status: "repeated",
    instant: Date.parse("2024-04-06T14:45:00Z"),
  });
  expect(() => createCivilClock("Invalid/Zone")).toThrow();
});
it("feeds the existing solar API with a resolved instant and north orientation", () => {
  const result = createCivilClock("Europe/Budapest").resolve({ year: 2024, day: 173, minute: 600 });
  if (result.status === "missing") throw new Error("Unexpected gap");
  const sun = calculateSolarPosition(47.4979, 19.0402, result.instant);
  expect(sun.elevation).toBeCloseTo(49.29, 0);
  const direction = planaxisSunDirection(270, sun);
  expect(direction.x).toBeCloseTo(0.607, 2);
  expect(direction.z).toBeCloseTo(0.758, 2);
});
