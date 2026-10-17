/** Fixed reference atmosphere, independent of Interactive appearance and persistent formats.
 * ASHRAE 2017 tau equations as documented in EnergyPlus 24.2 Climate Calculations.
 * Optical depths are explicit reference assumptions, not inferred local weather.
 */
export const SUNNY_REFERENCE = Object.freeze({
  extraterrestrialNormalWattsPerSquareMeter: 1361,
  beamOpticalDepth: 0.4,
  diffuseOpticalDepth: 2.3,
  directLumensPerWatt: 100,
  diffuseLumensPerWatt: 120,
});
export interface ClearSkyReference {
  /** Irradiance measured perpendicular to the solar rays, excluding diffuse sky. */
  readonly directNormalWattsPerSquareMeter: number;
  /** Sky alone on an upward-facing unobstructed horizontal receiver, including
   * twilight's equivalent irradiance under the assumed diffuse luminous efficacy. */
  readonly diffuseHorizontalWattsPerSquareMeter: number;
  readonly directNormalLux: number;
  readonly diffuseHorizontalLux: number;
}
/** Visualization reference, not a spectral model or a site-specific illuminance prediction.
 * Near the geometric horizon fade the empirical daytime model over 0–3 degrees;
 * a separately labeled 100 lx horizon twilight reference fades to zero by -6 degrees.
 * Night has no ground, moon, stars or artificial daytime environment.
 */
export function calculateClearSkyReference(elevation: number): ClearSkyReference {
  if (!Number.isFinite(elevation) || Math.abs(elevation) > 90)
    throw new RangeError("Clear sky requires elevation in [-90, 90].");
  const smooth = (value: number): number => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const daylight = smooth(elevation / 3);
  const twilightLux = 100 * smooth((elevation + 6) / 6) * (1 - daylight);
  let beam = 0,
    diffuse = 0;
  if (elevation > 0) {
    const mass =
      1 / (Math.sin((elevation * Math.PI) / 180) + 0.50572 * (6.07995 + elevation) ** -1.6364);
    const {
      beamOpticalDepth: b,
      diffuseOpticalDepth: d,
      extraterrestrialNormalWattsPerSquareMeter: e,
    } = SUNNY_REFERENCE;
    const beamExponent = 1.454 - 0.406 * b - 0.268 * d + 0.021 * b * d;
    const diffuseExponent = 0.507 + 0.205 * b - 0.08 * d - 0.19 * b * d;
    beam = e * Math.exp(-b * mass ** beamExponent) * daylight;
    diffuse = e * Math.exp(-d * mass ** diffuseExponent) * daylight;
  }
  return {
    directNormalWattsPerSquareMeter: beam,
    diffuseHorizontalWattsPerSquareMeter:
      diffuse + twilightLux / SUNNY_REFERENCE.diffuseLumensPerWatt,
    directNormalLux: beam * SUNNY_REFERENCE.directLumensPerWatt,
    diffuseHorizontalLux: diffuse * SUNNY_REFERENCE.diffuseLumensPerWatt + twilightLux,
  };
}
