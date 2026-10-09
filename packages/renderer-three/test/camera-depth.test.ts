import { expect, it } from "vitest";
import {
  NodeFrame,
  OrthographicCamera,
  PerspectiveCamera,
  Mesh,
  Texture,
  MeshStandardNodeMaterial,
  DoubleSide,
} from "three/webgpu";
import { createDecimal as decimal } from "@planaxis/geometry";
import { cameraDepth, perspectiveDepth, reversedDepth } from "../src/camera-depth.js";
import type { WebGPURenderer } from "three/webgpu";
import { buildApartmentScene } from "../src/apartment-scene.js";
import { modelFixture } from "./model-fixture.js";

it("updates depth projection for each Sun, local-light, and viewing pass in either order", () => {
  const frame = new NodeFrame();
  expect(perspectiveDepth.updateType).toBe("render");
  for (const camera of [
    new OrthographicCamera(),
    new PerspectiveCamera(),
    new OrthographicCamera(),
    new PerspectiveCamera(),
    new PerspectiveCamera(),
  ]) {
    frame.camera = camera;
    perspectiveDepth.update(frame);
    expect(perspectiveDepth.value).toBe(camera instanceof PerspectiveCamera);
  }
});

it("gives mapped surfaces and cloned ceiling finishes the same projection-aware depth node", () => {
  const source = new Texture();
  const finish = {
    baseColor: [1, 1, 1] as const,
    roughness: 0.8,
    metalness: 0,
    textures: {
      widthCm: decimal("100"),
      heightCm: decimal("100"),
      baseColorMap: Symbol("checker"),
    },
  };
  const scene = buildApartmentScene(modelFixture(), {
    assignments: new Map([
      ["floor", finish],
      ["ceiling", finish],
    ]),
    resolveTexture: () => source,
  });
  for (const name of ["floor", "ceiling"]) {
    const surface = scene.group.getObjectByName(name);
    expect(surface).toBeInstanceOf(Mesh);
    if (!(surface instanceof Mesh)) throw new Error("Missing boundary surface.");
    for (const material of [surface.material].flat()) {
      expect(material).toHaveProperty("depthNode", cameraDepth);
      expect(material.map).not.toBeNull();
      expect(material.shadowSide).toBe(DoubleSide);
      if (name === "floor") expect(material).toHaveProperty("maskShadowNode", perspectiveDepth);
      else expect(material).not.toHaveProperty("maskShadowNode", perspectiveDepth);
    }
    expect(surface.castShadow).toBe(true);
    expect(surface.receiveShadow).toBe(true);
  }
  scene.dispose();
  source.dispose();
});

it("follows the initialized backend depth convention for viewing and shadow passes", () => {
  const frame = new NodeFrame();
  expect(reversedDepth.updateType).toBe("render");
  for (const enabled of [true, false, true]) {
    frame.renderer = { reversedDepthBuffer: enabled } as WebGPURenderer;
    reversedDepth.update(frame);
    expect(reversedDepth.value).toBe(enabled);
  }
});

it("keeps floor alpha masking and does not give a shared ceiling the floor shadow mask", () => {
  const finish = {
    baseColor: [1, 1, 1] as const,
    roughness: 1,
    metalness: 0,
    alpha: { mode: "mask" as const, opacity: 0.5, cutoff: 0.25 },
  };
  const scene = buildApartmentScene(modelFixture(), {
    assignments: new Map([
      ["floor", finish],
      ["ceiling", finish],
    ]),
  });
  const floor = scene.group.getObjectByName("floor");
  const ceiling = scene.group.getObjectByName("ceiling");
  if (!(floor instanceof Mesh) || !(ceiling instanceof Mesh))
    throw new Error("Missing boundaries.");
  const floorMaterial: unknown = floor.material;
  const ceilingMaterial: unknown = ceiling.material;
  if (
    !(floorMaterial instanceof MeshStandardNodeMaterial) ||
    !(ceilingMaterial instanceof MeshStandardNodeMaterial)
  ) {
    throw new Error("Missing alpha-masked materials.");
  }
  expect(floorMaterial).not.toBe(ceilingMaterial);
  expect(floorMaterial.maskNode).toBe(ceilingMaterial.maskNode);
  const shadowNodes: unknown[] = [];
  floorMaterial.maskShadowNode?.traverse((node) => shadowNodes.push(node));
  expect(shadowNodes).toContain(perspectiveDepth);
  expect(shadowNodes).toContain(floorMaterial.maskNode);
  expect(ceilingMaterial.maskShadowNode).toBeNull();
  scene.dispose();
});
