export type LightingMode = "studio" | "physical";

export interface SolarPosition {
  /** Degrees clockwise from true north, in [0, 360). */
  readonly azimuth: number;
  /** Degrees above the geometric horizon, without atmospheric refraction. */
  readonly elevation: number;
}

export interface SunDirection {
  /** Unit vector from the apartment toward the Sun in PlanAxis coordinates. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const radians = Math.PI / 180;
const normalize360 = (angle: number): number => ((angle % 360) + 360) % 360;

/**
 * NOAA's compact fractional-year approximation, suitable for visualization:
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * Inputs are degrees (east-positive longitude) and Unix milliseconds, never civil time.
 * Floating-point simulation values are non-authoritative; no architecture is modified.
 */
export function calculateSolarPosition(
  latitude: number,
  longitude: number,
  instant: number,
): SolarPosition {
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(instant) ||
    Math.abs(instant) > 8.64e15
  ) {
    throw new RangeError("Solar position requires valid coordinates and Unix milliseconds.");
  }
  const date = new Date(instant);
  const year = date.getUTCFullYear();
  const start = new Date(instant);
  start.setUTCMonth(0, 1);
  start.setUTCHours(0, 0, 0, 0);
  const days = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
  const fraction = ((2 * Math.PI) / days) * ((instant - start.getTime()) / 86400000 - 0.5);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(fraction) -
      0.032077 * Math.sin(fraction) -
      0.014615 * Math.cos(2 * fraction) -
      0.040849 * Math.sin(2 * fraction));
  const declination =
    0.006918 -
    0.399912 * Math.cos(fraction) +
    0.070257 * Math.sin(fraction) -
    0.006758 * Math.cos(2 * fraction) +
    0.000907 * Math.sin(2 * fraction) -
    0.002697 * Math.cos(3 * fraction) +
    0.00148 * Math.sin(3 * fraction);
  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000;
  const hourAngle =
    (normalize360((utcMinutes + equationOfTime + 4 * longitude) / 4) - 180) * radians;
  const lat = latitude * radians;
  const sinElevation =
    Math.sin(lat) * Math.sin(declination) +
    Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  return {
    azimuth: normalize360(
      Math.atan2(
        Math.sin(hourAngle),
        Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat),
      ) /
        radians +
        180,
    ),
    elevation: Math.asin(Math.max(-1, Math.min(1, sinElevation))) / radians,
  };
}

/** Apartment SVG 2.2 §8.3.4; no renderer basis conversion belongs here. */
export function planaxisSunDirection(northHeading: number, sun: SolarPosition): SunDirection {
  if (
    ![northHeading, sun.azimuth, sun.elevation].every(Number.isFinite) ||
    Math.abs(sun.elevation) > 90
  ) {
    throw new RangeError("Sun direction requires finite angles and elevation in [-90, 90].");
  }
  const heading = normalize360(northHeading + sun.azimuth) * radians;
  const elevation = sun.elevation * radians;
  return {
    x: Math.cos(elevation) * Math.cos(heading),
    y: Math.cos(elevation) * Math.sin(heading),
    z: Math.sin(elevation),
  };
}

export { DEFAULT_WEATHER, deriveDaylight } from "./daylight.js";
export type { Weather, PhysicalSimulation, Daylight } from "./daylight.js";
export { createCivilClock, daysInYear, formatCivilTime } from "./civil-time.js";
export type { CivilTime, CivilResolution } from "./civil-time.js";
