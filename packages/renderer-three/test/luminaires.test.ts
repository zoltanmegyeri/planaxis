import { expect, it, vi } from "vitest";
import { Box3, PointLight, SpotLight, RectAreaLight, RenderTarget, Vector3 } from "three/webgpu";
import { RectAreaLightTexturesLib } from "three/addons/lights/RectAreaLightTexturesLib.js";
import { buildLuminaireSet, kelvinColor } from "../src/runtime-luminaires.js";
import type { RuntimeLuminaire } from "../src/runtime-luminaires.js";

const common = { positionCm: { x: 100, y: 200, z: 350 }, lumens: 800, kelvin: 3000 };
const orientation = { headingDegrees: 0, pitchDegrees: 90, rollDegrees: 0 };

it.each([
  ["Off", 1024],
  ["Low", 1024],
  ["Medium", 2048],
  ["High", 4096],
] as const)("maps point output and architectural shadows at %s quality", (quality, size) => {
  const set = buildLuminaireSet([{ ...common, type: "point" }], quality);
  const light = set.group.children[0];
  expect(light).toBeInstanceOf(PointLight);
  if (!(light instanceof PointLight)) throw new Error("Missing point");
  expect(light.position.toArray()).toEqual([1, 3.5, 2]);
  expect(light.power).toBeCloseTo(800);
  expect(light.intensity).toBeCloseTo(800 / (4 * Math.PI));
  expect(light.distance).toBe(0);
  expect(light.decay).toBe(2);
  expect(light.castShadow).toBe(true);
  expect(light.shadow.mapSize.toArray()).toEqual([size, size]);
  expect(light.shadow.autoUpdate).toBe(false);
  expect(light.shadow.needsUpdate).toBe(true);
  const target = new RenderTarget();
  light.shadow.map = target;
  const dispose = vi.spyOn(target, "dispose");
  const lightDispose = vi.spyOn(light, "dispose");
  set.dispose();
  set.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(lightDispose).toHaveBeenCalledTimes(1);
  expect(set.group.children).toHaveLength(0);
});

it.each([0, 90, -90, 30])("uses the normative spot direction at pitch %s", (pitchDegrees) => {
  const set = buildLuminaireSet(
    [
      {
        ...common,
        type: "spot",
        orientation: { headingDegrees: 90, pitchDegrees, rollDegrees: 45 },
        beamAngleDegrees: 60,
      },
    ],
    "Medium",
  );
  const light = set.group.children.find((item) => item instanceof SpotLight);
  if (!(light instanceof SpotLight)) throw new Error("Missing spot");
  const p = (pitchDegrees * Math.PI) / 180;
  const direction = light.target.position.clone().sub(light.position);
  expect(direction.x).toBeCloseTo(0);
  expect(direction.y).toBeCloseTo(-Math.sin(p));
  expect(direction.z).toBeCloseTo(Math.cos(p));
  expect(light.angle).toBeCloseTo(Math.PI / 6);
  expect(light.power).toBeCloseTo(800);
  expect(light.penumbra).toBe(0.2);
  expect(light.distance).toBe(0);
  expect(light.decay).toBe(2);
  expect(light.castShadow).toBe(true);
  const target = light.target;
  set.dispose();
  expect(target.parent).toBeNull();
});

it.each(["linear", "area"] as const)("maps %s size, rolled axes and one-sided emission", (type) => {
  const input: RuntimeLuminaire =
    type === "linear"
      ? { ...common, type, orientation: { ...orientation, rollDegrees: 90 }, lengthCm: 150 }
      : {
          ...common,
          type,
          orientation: { ...orientation, rollDegrees: 90 },
          widthCm: 150,
          heightCm: 60,
        };
  const set = buildLuminaireSet([input], "High");
  const light = set.group.children[0];
  if (!(light instanceof RectAreaLight)) throw new Error("Missing rectangle");
  expect(light.position.toArray()).toEqual([1, 3.5, 2]);
  expect(light.width).toBe(1.5);
  expect(light.height).toBe(type === "linear" ? 0.01 : 0.6);
  expect(light.power).toBeCloseTo(800);
  expect(light.castShadow).toBe(false);
  expect(set.hasShadows).toBe(false);
  // h=0, p=90, r=90: side=(1,0,0), vertical=(0,-1,0), forward=(0,0,-1).
  const width = new Vector3(1, 0, 0).applyQuaternion(light.quaternion);
  const height = new Vector3(0, 1, 0).applyQuaternion(light.quaternion);
  const emission = new Vector3(0, 0, -1).applyQuaternion(light.quaternion);
  expect(width.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-12);
  expect(height.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-12);
  expect(emission.distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-12);
  set.dispose();
});

it("retains shared LTC resources until the last set is disposed", () => {
  const input: RuntimeLuminaire = { ...common, type: "linear", orientation, lengthCm: 100 };
  const init = vi.spyOn(RectAreaLightTexturesLib, "init");
  const first = buildLuminaireSet([input], "Medium");
  const lookup = init.mock.results[0]?.value as ReturnType<typeof RectAreaLightTexturesLib.init>;
  const textures = [lookup.LTC_FLOAT_1, lookup.LTC_FLOAT_2, lookup.LTC_HALF_1, lookup.LTC_HALF_2];
  const disposals = textures.map((texture) => vi.spyOn(texture, "dispose"));
  const second = buildLuminaireSet([input], "Medium");
  first.dispose();
  for (const disposal of disposals) expect(disposal).not.toHaveBeenCalled();
  second.dispose();
  for (const disposal of disposals) expect(disposal).toHaveBeenCalledTimes(1);
});

it("produces zero light and no shadows for inactive output", () => {
  const set = buildLuminaireSet(
    [
      { ...common, lumens: 0, type: "point" },
      { ...common, lumens: 0, type: "spot", orientation, beamAngleDegrees: 40 },
      { ...common, lumens: 0, type: "linear", orientation, lengthCm: 80 },
      { ...common, lumens: 0, type: "area", orientation, widthCm: 80, heightCm: 40 },
    ],
    "Medium",
  );
  for (const light of set.group.children) {
    if (
      light instanceof PointLight ||
      light instanceof SpotLight ||
      light instanceof RectAreaLight
    ) {
      expect(light.power).toBe(0);
      expect(light.castShadow).toBe(false);
    }
  }
  expect(set.hasShadows).toBe(false);
  set.dispose();
});

it("distinguishes warm, neutral and cool white deterministically, including extreme valid temperatures", () => {
  const warm = kelvinColor(2700),
    neutral = kelvinColor(6500),
    cool = kelvinColor(10000);
  expect(warm.r).toBeGreaterThan(warm.b * 3);
  expect(Math.abs(neutral.r - neutral.b)).toBeLessThan(0.1);
  expect(cool.b).toBeGreaterThan(cool.r);
  expect(kelvinColor(2700)).toEqual(warm);
  expect(kelvinColor(Number.MIN_VALUE)).toEqual(kelvinColor(1000));
  expect(kelvinColor(Number.MAX_VALUE)).toEqual(kelvinColor(40000));
});

it("fits point and spot shadow cameras to geometry away from the model origin", () => {
  const bounds = new Box3(new Vector3(1000, 2000, 3000), new Vector3(1010, 2010, 3010));
  const set = buildLuminaireSet(
    [
      { ...common, type: "point" },
      { ...common, type: "spot", orientation, beamAngleDegrees: 100 },
    ],
    "Medium",
    bounds,
  );
  for (const light of set.group.children) {
    if (!(light instanceof PointLight || light instanceof SpotLight)) continue;
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          expect(light.shadow.camera.far).toBeGreaterThan(
            light.position.distanceTo(new Vector3(x, y, z)),
          );
        }
      }
    }
    expect(light.distance).toBe(0);
  }
  set.dispose();
});
