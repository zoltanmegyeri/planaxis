import { expect, it } from "vitest";
import { PointLight, RectAreaLight, Vector3 } from "three/webgpu";
import type { RuntimeLuminaire } from "../src/runtime-luminaires.js";
import {
  prepareTracingLights,
  sampleTracingLight,
  tracingLightEstimate,
} from "../src/path-tracing/luminaires.js";
import { buildLuminaireSet, kelvinColor } from "../src/runtime-luminaires.js";

const common = { positionCm: { x: 100, y: 200, z: 550 }, lumens: 1000, kelvin: 3000 };
const orientation = { headingDegrees: 90, pitchDegrees: 0, rollDegrees: 90 };
const inputs: RuntimeLuminaire[] = [
  { ...common, id: "p", type: "point" },
  { ...common, id: "s", type: "spot", orientation, beamAngleDegrees: 60 },
  { ...common, id: "l", type: "linear", orientation, lengthCm: 150 },
  { ...common, id: "a", type: "area", orientation, widthCm: 80, heightCm: 40 },
];
const y = (rgb: Vector3): number => rgb.dot(new Vector3(0.2126, 0.7152, 0.0722));
const prepare = (input: RuntimeLuminaire) => prepareTracingLights([input]).lights[0]!;

it("maps model-space centimeters and the normative rolled frame exactly once, without a level offset", () => {
  const [point, spot, linear, area] = inputs.map(prepare);
  expect(point!.position.toArray()).toEqual([1, 5.5, 2]);
  expect(point!.forward.length()).toBe(0);
  expect(spot!.coneCosine).toBeCloseTo(Math.cos(Math.PI / 6));
  expect(linear!.width).toBe(1.5);
  expect(linear!.height).toBe(0.01);
  expect(area!.width).toBe(0.8);
  expect(area!.height).toBe(0.4);
  expect(area!.forward.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-12);
  expect(area!.side.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12);
  expect(area!.vertical.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-12);
  const downward = prepare({
    ...inputs[3]!,
    type: "area",
    widthCm: 80,
    heightCm: 40,
    orientation: { headingDegrees: 0, pitchDegrees: 90, rollDegrees: 0 },
  });
  expect(downward.forward.distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-12);
});

it("preserves nominal flux and shared Kelvin RGB for point, normalized cones and rectangles", () => {
  for (const input of inputs) {
    const source = prepare(input);
    const measure =
      source.type === "point"
        ? 4 * Math.PI
        : source.type === "spot"
          ? 2 * Math.PI * (1 - source.coneCosine)
          : Math.PI * source.width * source.height;
    const color = kelvinColor(input.kelvin);
    expect(
      source.emission
        .clone()
        .multiplyScalar(measure)
        .distanceTo(new Vector3(color.r, color.g, color.b).multiplyScalar(1000)),
    ).toBeLessThan(1e-10);
    expect(y(prepare({ ...input, lumens: 250 }).emission)).toBeCloseTo(
      y(source.emission) * 0.25,
      10,
    );
    expect(source.emission.toArray().every((c) => Number.isFinite(c) && c >= 0)).toBe(true);
  }
  const area = prepare(inputs[3]!);
  const resized = prepare({ ...common, type: "area", orientation, widthCm: 160, heightCm: 80 });
  expect(y(resized.emission)).toBeCloseTo(y(area.emission) / 4);
  const narrow = prepare({ ...common, type: "spot", orientation, beamAngleDegrees: 30 });
  const wide = prepare(inputs[1]!);
  expect(y(narrow.emission) / y(wide.emission)).toBeCloseTo(
    (1 - wide.coneCosine) / (1 - narrow.coneCosine),
  );
});

it("samples the whole rolled rectangle with correct area and light-selection densities", () => {
  const light = prepare(inputs[3]!);
  expect(
    sampleTracingLight(light, 0, 0).position.distanceTo(
      light.position
        .clone()
        .addScaledVector(light.side, -0.4)
        .addScaledVector(light.vertical, -0.2),
    ),
  ).toBeLessThan(1e-12);
  expect(sampleTracingLight(light, 1, 1).density).toBeCloseTo(1 / 0.32);
  const point = light.position.clone().addScaledVector(light.forward, 2);
  const normal = light.forward.clone().negate();
  const single = tracingLightEstimate(light, point, normal, 0.5, 0.5, 1);
  const selected = tracingLightEstimate(light, point, normal, 0.5, 0.5, 0.25);
  expect(selected.distanceTo(single.clone().multiplyScalar(4))).toBeLessThan(1e-12);
  const color = kelvinColor(common.kelvin);
  const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  expect(y(single)).toBeCloseTo((1000 * luminance) / (Math.PI ** 2 * 4));
  expect(
    tracingLightEstimate(
      light,
      light.position.clone().addScaledVector(light.forward, -2),
      light.forward,
      0.5,
      0.5,
      1,
    ).length(),
  ).toBe(0);
  expect(tracingLightEstimate(light, point, light.forward, 0.5, 0.5, 1).length()).toBe(0);
});

it("numerically integrates inverse-square point and cone emission over receiving spheres", () => {
  for (const input of [inputs[0]!, inputs[1]!]) {
    const light = prepare(input);
    const samples = 10000;
    let integral = 0;
    // Equal-solid-angle quadrature, aligned with spot +Z.
    for (let i = 0; i < samples; i++) {
      const cosine = -1 + (2 * (i + 0.5)) / samples;
      const direction = new Vector3(Math.sqrt(1 - cosine ** 2), 0, cosine);
      const estimate = tracingLightEstimate(
        light,
        light.position.clone().addScaledVector(direction, 3),
        direction.clone().negate(),
        0.5,
        0.5,
        1,
      );
      integral += (y(estimate) * Math.PI * 9 * 4 * Math.PI) / samples;
    }
    const color = kelvinColor(input.kelvin);
    const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    expect(integral / luminance).toBeCloseTo(1000, 0);
  }
});

it.each([2700, 5600, 10000])(
  "matches Interactive point/rectangle coefficients and inverse-square receiving light at %s K",
  (kelvin) => {
    for (const type of ["point", "linear", "area"] as const) {
      const input: RuntimeLuminaire =
        type === "point"
          ? { ...common, type, kelvin, lumens: 560 }
          : type === "linear"
            ? { ...common, type, kelvin, lumens: 560, orientation, lengthCm: 150 }
            : { ...common, type, kelvin, lumens: 560, orientation, widthCm: 80, heightCm: 40 };
      const runtime = buildLuminaireSet([input], "Off");
      try {
        const light = runtime.group.children.find(
          (item) => item instanceof PointLight || item instanceof RectAreaLight,
        );
        if (!(light instanceof PointLight || light instanceof RectAreaLight))
          throw new Error("Missing Interactive light");
        const source = prepare(input);
        const expected = new Vector3(light.color.r, light.color.g, light.color.b).multiplyScalar(
          light.intensity,
        );
        expect(source.emission.distanceTo(expected)).toBeLessThan(1e-10);
        if (type === "point") {
          // Independently known 560 lm isotropic source: I = 44.563... cd.
          expect(light.intensity).toBeCloseTo(44.563384065730695, 10);
          for (const distance of [1, 2]) {
            const received = tracingLightEstimate(
              source,
              source.position.clone().add(new Vector3(0, -distance, 0)),
              new Vector3(0, 1, 0),
              0.5,
              0.5,
              1,
            );
            expect(
              received.distanceTo(expected.clone().divideScalar(Math.PI * distance ** 2)),
            ).toBeLessThan(1e-10);
          }
        }
      } finally {
        runtime.dispose();
      }
    }
  },
);

it("retains every source beyond raster GI budgets, makes descriptor ordering immaterial and replaces empty/zero sets", () => {
  const many = Array.from({ length: 128 }, (_, i) => ({ ...inputs[i % 4]!, id: `lamp-${i}` }));
  const set = prepareTracingLights(many);
  expect(set.lights).toHaveLength(128);
  expect(prepareTracingLights([...many].reverse())).toEqual(set);
  const point = new Vector3(1, 1, 2),
    normal = new Vector3(0, 1, 0);
  const sum = set.lights.reduce(
    (total, light) => total.add(tracingLightEstimate(light, point, normal, 0.5, 0.5, 1)),
    new Vector3(),
  );
  const expected = set.lights.reduce(
    (total, light) =>
      total.add(
        tracingLightEstimate(light, point, normal, 0.5, 0.5, 1 / set.lights.length).divideScalar(
          set.lights.length,
        ),
      ),
    new Vector3(),
  );
  expect(expected.distanceTo(sum)).toBeLessThan(1e-10);
  expect(prepareTracingLights([]).records).toHaveLength(0);
  expect(
    prepareTracingLights(inputs.map((light) => ({ ...light, lumens: 0 }))).lights,
  ).toHaveLength(0);
});

it("fails explicitly on values the float GPU backend cannot represent, without moving inconvenient lights", () => {
  expect(() => prepare({ ...inputs[0]!, lumens: Number.MAX_VALUE })).toThrow("numeric capacity");
  expect(() => prepare({ ...inputs[0]!, lumens: Number.MIN_VALUE })).toThrow("numeric capacity");
  expect(() => prepare({ ...inputs[0]!, lumens: 1e35 })).toThrow("numeric capacity");
  // Tiny area can preserve ordinary total flux while visible radiance has no HDR headroom.
  expect(() =>
    prepare({
      ...common,
      lumens: 1,
      type: "area",
      orientation,
      widthCm: 1e-16,
      heightCm: 1e-16,
    }),
  ).toThrow("transport numeric capacity");
  expect(() => prepare({ ...common, type: "spot", orientation, beamAngleDegrees: 1e-8 })).toThrow(
    "numeric capacity",
  );
  expect(prepare({ ...inputs[0]!, positionCm: { x: -100, y: 0, z: 0 } }).position.x).toBe(-1);
  expect(
    tracingLightEstimate(
      prepare(inputs[0]!),
      new Vector3(1, 5.5, 2),
      new Vector3(0, 1, 0),
      0,
      0,
      1,
    ).length(),
  ).toBe(0);
});

it("rejects flux that fits records but can overflow a polished PBR direct estimate", () => {
  expect(() =>
    prepareTracingLights([
      { type: "point", positionCm: { x: 100, y: 100, z: 100 }, lumens: 1e26, kelvin: 3000 },
    ]),
  ).toThrow("transport numeric capacity");
});
