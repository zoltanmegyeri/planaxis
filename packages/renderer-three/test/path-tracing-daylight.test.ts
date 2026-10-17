import { expect, it } from "vitest";
import { Color, Vector3 } from "three/webgpu";
import { calculateClearSkyReference } from "@planaxis/simulation";
import { tracingDaylight } from "../src/path-tracing/daylight.js";
import { evaluateTracingBsdf, sampleTracingBsdf } from "../src/path-tracing/bsdf.js";
import { daylightSkyColors, daylightSunColor } from "../src/physical-sky.js";
import { deriveDaylight } from "@planaxis/simulation";
const Y = (c: Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

it("integrates the gradient sky to horizontal illuminance and preserves solar normal units", () => {
  for (const elevation of [-90, -6, -3, 0, 1, 10, 60, 90]) {
    const lighting = tracingDaylight(elevation),
      reference = calculateClearSkyReference(elevation);
    expect(Y(lighting.sun) * 683).toBeCloseTo(reference.directNormalLux, 7);
    let integral = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const mu = (i + 0.5) / n,
        t = Math.min(1, mu / 0.8),
        blend = t * t * (3 - 2 * t);
      integral += (Y(lighting.horizon.clone().lerp(lighting.zenith, blend)) * mu * 2 * Math.PI) / n;
    }
    expect(integral * 683).toBeCloseTo(reference.diffuseHorizontalLux, 3);
    // Receiver cosine is applied once, outside the source adapter.
    expect(Y(lighting.sun) * 0.5 * 683).toBeCloseTo(reference.directNormalLux * 0.5, 7);
  }
});
it("keeps Interactive palettes/source magnitudes independent of trace calibration", () => {
  const state = deriveDaylight(60, "sunny");
  const before = daylightSkyColors(state),
    sun = daylightSunColor(state);
  tracingDaylight(60);
  expect(daylightSkyColors(state)).toEqual(before);
  expect(daylightSunColor(state)).toEqual(sun);
  expect(before.zenith).toEqual(new Color(0.045, 0.22, 0.65));
  expect(state.directStrength).toBe(1);
  expect(() => tracingDaylight(NaN)).toThrow(RangeError);
});
it("retains the independently integrated paint/diffuse and rough/polished metal energy", () => {
  // At normal view, reciprocal Schlick diffuse attenuation integrates analytically:
  // (1-.04)^2 * 20/21 * rho. At alpha=1, D=1/pi, G1=2c/(1+c).
  // Integrate the remaining specular term directly from those equations (no BSDF/PDF reuse).
  for (const metalness of [0, 1]) {
    const rho = 0.7,
      f0 = metalness ? rho : 0.04,
      n = 100000;
    let expected = 0,
      actual = 0;
    const surface = { color: [rho, rho, rho], roughness: 1, metalness };
    const view = new Vector3(0, 0, 1);
    if (!metalness) expected = ((0.96 ** 2 * 20) / 21) * rho;
    for (let i = 0; i < n; i++) {
      const mu = (i + 0.5) / n,
        halfCosine = Math.sqrt((1 + mu) / 2);
      const fresnel = f0 + (1 - f0) * (1 - halfCosine) ** 5;
      expected += (fresnel * mu) / (1 + mu) / n;
      const direction = sampleTracingBsdf(
        surface,
        view,
        mu,
        (i * 0.61803398875) % 1,
        (i * 0.41421356237) % 1,
      );
      const e = evaluateTracingBsdf(surface, view, direction);
      if (e.pdf > 0) actual += (e.value[0]! * direction.z) / e.pdf / n;
    }
    expect(actual).toBeCloseTo(expected, 3);
    expect(expected).toBeCloseTo(metalness ? 0.214832 : 0.626978, 3);
  }
  const mirror = { color: [0.7, 0.7, 0.7], roughness: 0, metalness: 1 };
  let energy = 0;
  const n = 10000,
    view = new Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    const direction = sampleTracingBsdf(mirror, view, (i + 0.5) / n, (i * 0.61803398875) % 1, 0);
    const e = evaluateTracingBsdf(mirror, view, direction);
    if (e.pdf > 0) energy += (e.value[0]! * direction.z) / e.pdf / n;
  }
  expect(energy).toBeCloseTo(0.7, 3);
});
it("preserves compensated roulette expectation and isolates finite path truncation", () => {
  // Closed diffuse cavity recurrence with known attenuation r: L_N=sum r^k.
  const r = 0.7,
    n = 200000;
  let random = 47;
  const uniform = (): number => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return random / 2 ** 32;
  };
  for (const limit of [8, 16, 32]) {
    let mean = 0,
      second = 0;
    for (let sample = 0; sample < n; sample++) {
      let weight = 1,
        sum = 0;
      for (let bounce = 0; bounce < limit; bounce++) {
        sum += weight;
        weight *= r;
        if (bounce >= 2) {
          const p = Math.max(0.1, Math.min(0.95, weight));
          if (uniform() >= p) break;
          weight /= p;
        }
      }
      mean += sum / n;
      second += (sum * sum) / n;
    }
    const reference = (1 - r ** limit) / (1 - r),
      se = Math.sqrt((second - mean * mean) / n);
    expect(Math.abs(mean - reference)).toBeLessThan(4 * se);
  }
  expect(r ** 8).toBeCloseTo(0.05764801, 10);
  expect(r ** 16).toBeLessThan(0.0034);
  expect(r ** 32).toBeLessThan(0.000012);
});

it.each([
  [0.5, 0.6139229138],
  [0.1, 0.2869297074],
  [0.01, 0.0726719554],
])(
  "records the bounded paint model's retained grazing energy at view cosine %s",
  (cosine, expected) => {
    // Independent 400×512 angular quadrature in the evidence report, not a renderer formula call.
    const surface = { color: [0.7, 0.7, 0.7], roughness: 1, metalness: 0 };
    const view = new Vector3(Math.sqrt(1 - cosine! ** 2), 0, cosine!);
    let energy = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const direction = sampleTracingBsdf(
        surface,
        view,
        (i + 0.5) / n,
        (i * 0.61803398875) % 1,
        (i * 0.41421356237) % 1,
      );
      const e = evaluateTracingBsdf(surface, view, direction);
      if (e.pdf > 0) energy += (e.value[0]! * direction.z) / e.pdf / n;
    }
    // QMC mixture versus uniform-angle quadrature; 0.001 absolute covers their discretization.
    expect(Math.abs(energy - expected!)).toBeLessThan(0.001);
  },
);
