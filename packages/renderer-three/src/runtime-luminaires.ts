import {
  Box3,
  Color,
  Group,
  Matrix4,
  PointLight,
  RectAreaLight,
  RectAreaLightNode,
  SpotLight,
  SRGBColorSpace,
  Vector3,
} from "three/webgpu";
import { RectAreaLightTexturesLib } from "three/addons/lights/RectAreaLightTexturesLib.js";
import { SHADOW_MAP_SIZES } from "./quality.js";
import type { QualityLevel } from "./quality.js";

interface RuntimeOrientation {
  readonly headingDegrees: number;
  readonly pitchDegrees: number;
  readonly rollDegrees: number;
}
/** Application-adapted semantic values; no descriptor, paths, or persistence identity. */
export type RuntimeLuminaire = {
  readonly positionCm: { readonly x: number; readonly y: number; readonly z: number };
  readonly lumens: number;
  readonly kelvin: number;
} & (
  | { readonly type: "point" }
  | {
      readonly type: "spot";
      readonly orientation: RuntimeOrientation;
      readonly beamAngleDegrees: number;
    }
  | { readonly type: "linear"; readonly orientation: RuntimeOrientation; readonly lengthCm: number }
  | {
      readonly type: "area";
      readonly orientation: RuntimeOrientation;
      readonly widthCm: number;
      readonly heightCm: number;
    }
);

// Three's node library holds these shared immutable lookup textures globally.
// Reference counting releases GPU allocations after the last luminaire set is removed.
let areaUsers = 0;
let areaTextures: ReturnType<typeof RectAreaLightTexturesLib.init> | undefined;
function acquireAreaTextures(): () => void {
  if (areaUsers++ === 0) {
    areaTextures = RectAreaLightTexturesLib.init();
    RectAreaLightNode.setLTC(areaTextures);
  }
  return () => {
    if (--areaUsers === 0 && areaTextures) {
      areaTextures.LTC_FLOAT_1.dispose();
      areaTextures.LTC_FLOAT_2.dispose();
      areaTextures.LTC_HALF_1.dispose();
      areaTextures.LTC_HALF_2.dispose();
    }
  };
}

/** Approximate black-body sRGB fit, clamped to its 1000–40000 K useful range. */
export function kelvinColor(kelvin: number): Color {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const clamp = (channel: number): number => Math.min(255, Math.max(0, channel)) / 255;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return new Color().setRGB(clamp(red), clamp(green), clamp(blue), SRGBColorSpace);
}

function frame(orientation: RuntimeOrientation) {
  const h = (orientation.headingDegrees * Math.PI) / 180;
  const p = (orientation.pitchDegrees * Math.PI) / 180;
  const r = (orientation.rollDegrees * Math.PI) / 180;
  const forward = new Vector3(Math.cos(p) * Math.cos(h), Math.cos(p) * Math.sin(h), -Math.sin(p));
  const side = new Vector3(-Math.sin(h), Math.cos(h), 0);
  const vertical = new Vector3().crossVectors(forward, side);
  const rolledSide = side
    .clone()
    .multiplyScalar(Math.cos(r))
    .addScaledVector(vertical, Math.sin(r));
  const rolledVertical = vertical
    .clone()
    .multiplyScalar(Math.cos(r))
    .addScaledVector(side, -Math.sin(r));
  const map = (v: Vector3): Vector3 => new Vector3(v.x, v.z, v.y);
  return { forward: map(forward), side: map(rolledSide), vertical: map(rolledVertical) };
}

interface LuminaireSet {
  readonly group: Group;
  readonly hasShadows: boolean;
  dispose(): void;
}

export function buildLuminaireSet(
  inputs: readonly RuntimeLuminaire[],
  quality: QualityLevel,
  bounds?: Box3,
): LuminaireSet {
  const group = new Group();
  group.name = "design-luminaires";
  const releaseTextures = inputs.some((input) => input.type === "linear" || input.type === "area")
    ? acquireAreaTextures()
    : undefined;
  const lights = inputs.map((input) => {
    const color = kelvinColor(input.kelvin);
    const light =
      input.type === "point"
        ? new PointLight(color)
        : input.type === "spot"
          ? new SpotLight(color)
          : new RectAreaLight(
              color,
              1,
              (input.type === "linear" ? input.lengthCm : input.widthCm) / 100,
              input.type === "linear" ? 0.01 : input.heightCm / 100,
            );
    light.position.set(
      input.positionCm.x / 100,
      input.positionCm.z / 100,
      input.positionCm.y / 100,
    );
    light.power = input.lumens;
    if (input.type !== "point") {
      const axes = frame(input.orientation);
      if (light instanceof SpotLight && input.type === "spot") {
        light.target.position.copy(light.position).add(axes.forward);
        light.angle = (input.beamAngleDegrees * Math.PI) / 360;
        light.penumbra = 0.2;
        group.add(light.target);
      } else {
        // The basis swap reverses handedness: local +Z is -forward; RectAreaLight emits -Z.
        light.quaternion.setFromRotationMatrix(
          new Matrix4().makeBasis(axes.side, axes.vertical, axes.forward.negate()),
        );
      }
    }
    if (light instanceof PointLight || light instanceof SpotLight) {
      light.distance = 0;
      light.decay = 2;
      light.castShadow = input.lumens > 0;
      const size = SHADOW_MAP_SIZES[quality] || SHADOW_MAP_SIZES.Low;
      light.shadow.mapSize.set(size, size);
      light.shadow.camera.near = 0.01;
      // Fit the shadow camera to actual architecture even when its origin is offset.
      // This clipping distance is independent of the unlimited illumination range.
      if (bounds && !bounds.isEmpty()) {
        light.shadow.camera.far = Math.max(
          1,
          light.position.distanceTo(bounds.getCenter(new Vector3())) +
            bounds.getSize(new Vector3()).length(),
        );
      }
      light.shadow.camera.updateProjectionMatrix();
      light.shadow.bias = -0.0002;
      light.shadow.normalBias = 0.002;
      light.shadow.autoUpdate = false;
      light.shadow.needsUpdate = true;
    }
    group.add(light);
    return light;
  });
  let disposed = false;
  return {
    group,
    hasShadows: lights.some((light) => light.castShadow),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const light of lights) light.dispose();
      group.clear();
      releaseTextures?.();
    },
  };
}
