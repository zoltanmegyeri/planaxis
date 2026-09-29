import type { Daylight, SunDirection } from "@planaxis/simulation";
import { Color, Vector3, SRGBColorSpace } from "three/webgpu";
import { dot, mix, positionWorldDirection, smoothstep, uniform, vec4 } from "three/tsl";

/** Renderer-owned color approximation; fixed viewing response, no white balancing. */
export function daylightSunColor(daylight: Daylight): Color {
  const neutral = new Color().setRGB(1, 0.96, 0.91, SRGBColorSpace);
  if (daylight.weather === "overcast") return new Color().setRGB(0.81, 0.89, 1, SRGBColorSpace);
  const warm = new Color().setRGB(1, 0.54, 0.25, SRGBColorSpace);
  return neutral.lerp(warm, daylight.warmth);
}

/**
 * A small TSL background, shared by WebGPU and its WebGL2 backend. A gradient and
 * Sun-aligned horizon glow support overcast/night without clouds or a sky texture.
 * This never enters scene.environment, architectural picking, or shadow passes.
 */
export function createPhysicalSky() {
  const direction = uniform(new Vector3(0, 1, 0));
  const zenith = uniform(new Color());
  const horizon = uniform(new Color());
  const glowColor = uniform(new Color());
  const glow = uniform(0);
  const disc = uniform(0);
  const view = positionWorldDirection.normalize();
  const alignment = dot(view, direction).clamp(0, 1);
  const base = mix(horizon, zenith, smoothstep(0, 0.8, view.y));
  const halo = alignment.pow(12).mul(glow).mul(view.y.abs().oneMinus().max(0).pow(3));
  const sunDisc = smoothstep(0.99994, 0.99997, alignment).mul(disc);
  const node = vec4(base.add(glowColor.mul(halo.add(sunDisc))), 1);
  return {
    node,
    update(daylight: Daylight, sun: SunDirection): void {
      direction.value.set(sun.x, sun.z, sun.y);
      const overcast = daylight.weather === "overcast";
      // Linear-light palette. Night has no artificial fill or visible Sun disc.
      zenith.value
        .setRGB(0.0002, 0.0004, 0.0015)
        .lerp(new Color(0.012, 0.024, 0.075), daylight.twilight)
        .lerp(overcast ? new Color(0.55, 0.62, 0.72) : new Color(0.045, 0.22, 0.65), daylight.day);
      horizon.value
        .setRGB(0.0004, 0.0006, 0.0018)
        .lerp(new Color(0.13, 0.045, 0.035), daylight.twilight)
        .lerp(overcast ? new Color(0.72, 0.77, 0.83) : new Color(0.18, 0.4, 0.8), daylight.day);
      glowColor.value.copy(daylightSunColor(daylight));
      glow.value = overcast ? 0 : daylight.twilight * (0.12 + daylight.warmth * 1.5);
      disc.value = overcast ? 0 : daylight.directStrength * 12;
    },
    dispose(): void {
      node.dispose();
    },
  };
}
