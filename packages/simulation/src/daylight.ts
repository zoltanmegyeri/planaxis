/** Runtime conditions only; never part of an apartment or design descriptor. */
export type Weather = "sunny" | "overcast";
export const DEFAULT_WEATHER: Weather = "sunny";
export interface PhysicalSimulation {
  readonly instant: number;
  readonly weather: Weather;
}
export interface Daylight {
  readonly weather: Weather;
  /** Smooth appearance weights, not irradiance measurements. */
  readonly day: number;
  readonly twilight: number;
  readonly warmth: number;
  readonly directStrength: number;
  readonly sunTemperatureKelvin: number;
}
function smooth(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
/** Deliberately qualitative daylight, with no refraction, clouds, or diffuse transport. */
export function deriveDaylight(elevation: number, weather: Weather = DEFAULT_WEATHER): Daylight {
  if (!Number.isFinite(elevation) || Math.abs(elevation) > 90)
    throw new RangeError("Daylight requires elevation in [-90, 90].");
  if (weather !== "sunny" && weather !== "overcast") throw new RangeError("Invalid weather.");
  const warmth = 1 - smooth(0, 35, elevation);
  return {
    weather,
    day: smooth(-6, 8, elevation),
    twilight: smooth(-12, 0, elevation),
    warmth,
    directStrength: smooth(0, 30, elevation) * (weather === "overcast" ? 0.045 : 1),
    sunTemperatureKelvin: weather === "overcast" ? 7000 : 5600 - 3100 * warmth,
  };
}
