import { calculateClearSkyReference, deriveDaylight } from "@planaxis/simulation";
import { Color } from "three/webgpu";
import { daylightSkyColors, daylightSunColor } from "../physical-sky.js";

// Retain the accepted Sunny appearance calibration independently of lamp photometric units.
// This fixed RGB daylight scale is not a white-light spectral luminous efficacy.
const DAYLIGHT_LUX_PER_RENDER_UNIT = 683;

/** 2 integral_0^1 mu smoothstep(0,.8,mu) dmu = 1 - .3*.8². */
export const SKY_ZENITH_COSINE_WEIGHT = 0.808;
const luminance = (color: Color): number => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
/** Trace-only photometric RGB surrogate. Sun stores integrated normal irradiance,
 * sky stores radiance per sr; receiving cosines and sky solid angle occur in transport once.
 * Palette magnitudes never determine upper-hemisphere illumination. Below the horizon,
 * the shader continues calibrated horizon radiance for every escape ray; this exterior
 * boundary approximation does not contribute to an upward receiver's horizontal integral.
 * There is no solar disc in sky.
 */
export function tracingDaylight(elevation: number): { sun: Color; zenith: Color; horizon: Color } {
  const reference = calculateClearSkyReference(elevation);
  const appearance = deriveDaylight(elevation, "sunny");
  const sun = daylightSunColor(appearance);
  sun.multiplyScalar(reference.directNormalLux / (DAYLIGHT_LUX_PER_RENDER_UNIT * luminance(sun)));
  const { zenith, horizon } = daylightSkyColors(appearance);
  const integratedLuminance =
    Math.PI *
    (SKY_ZENITH_COSINE_WEIGHT * luminance(zenith) +
      (1 - SKY_ZENITH_COSINE_WEIGHT) * luminance(horizon));
  const scale =
    reference.diffuseHorizontalLux / (DAYLIGHT_LUX_PER_RENDER_UNIT * integratedLuminance);
  zenith.multiplyScalar(scale);
  horizon.multiplyScalar(scale);
  return { sun, zenith, horizon };
}
