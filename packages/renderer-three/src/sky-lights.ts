import { Color, DirectionalLight, Group, Vector3 } from "three/webgpu";
import type { Box3 } from "three/webgpu";
import type { Daylight } from "@planaxis/simulation";
import type { GiLightCandidate } from "./global-illumination.js";
import { RENDER_LIGHT_LAYER } from "./global-illumination.js";

/** Four shadow-aware samples of diffuse sky, separate from scenery and Studio fill. */
export class SkyLights {
  readonly group = new Group();
  readonly lights = Array.from({ length: 4 }, (_, index) => {
    const light = new DirectionalLight(new Color(0.7, 0.8, 1), 0);
    light.name = `physical-sky-${index}`;
    light.layers.set(RENDER_LIGHT_LAYER);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.autoUpdate = false;
    light.shadow.radius = 2;
    this.group.add(light, light.target);
    return light;
  });

  constructor() {
    this.group.name = "physical-sky-lights";
    this.group.visible = false;
  }

  setBounds(bounds: Box3): void {
    const center = bounds.getCenter(new Vector3());
    const radius = Math.max(0.1, bounds.getSize(new Vector3()).length() / 2);
    this.lights.forEach((light, index) => {
      const heading = (index * Math.PI) / 2;
      light.target.position.copy(center);
      // Low hemisphere samples can reach vertical exterior openings.
      light.position
        .copy(center)
        .addScaledVector(
          new Vector3(Math.cos(heading), 0.65, Math.sin(heading)).normalize(),
          radius * 3,
        );
      Object.assign(light.shadow.camera, {
        left: -radius,
        right: radius,
        top: radius,
        bottom: -radius,
        near: 0.01,
        far: radius * 6,
      });
      light.shadow.camera.updateProjectionMatrix();
      light.shadow.normalBias = (radius * 2) / 1024;
      light.shadow.bias = 0.0001;
      light.shadow.needsUpdate = true;
    });
  }

  update(daylight?: Daylight): void {
    this.group.visible = daylight !== undefined;
    for (const light of this.lights) {
      light.intensity = daylight
        ? ((daylight.weather === "overcast" ? 2 : 0.6) * daylight.day +
            0.025 * daylight.twilight * (1 - daylight.day)) /
          this.lights.length
        : 0;
      const color = daylight?.weather === "overcast" ? [0.72, 0.82, 1] : [0.8, 0.88, 1];
      light.color.setRGB(color[0]!, color[1]!, color[2]!);
      light.shadow.needsUpdate = true;
    }
  }

  candidates(): readonly GiLightCandidate[] {
    return this.group.visible
      ? this.lights.map((light) => ({ key: light.name, priority: 1, light }))
      : [];
  }

  dispose(): void {
    for (const light of this.lights) light.dispose();
    this.group.clear();
  }
}
