import { rendererBox } from "../src/coordinates.js";
import { buildApartmentScene } from "../src/apartment-scene.js";
import { createDecimal as decimal } from "@planaxis/geometry";
import { Box3, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three/webgpu";
import { expect, it } from "vitest";
import {
  applyEmbeddedCamera,
  frameInspection,
  fullFrameHorizontalFov,
  verticalFov,
} from "../src/cameras.js";
import { modelFixture } from "./model-fixture.js";

it.each([
  [1, 90],
  [2, 53.130102354],
  [0.5, 126.869897646],
])("converts horizontal FOV at aspect %s", (aspect, expected) => {
  expect(verticalFov(90, aspect)).toBeCloseTo(expected);
});
it.each([
  [16, 96.73292132685962],
  [24, 73.73979529168804],
  [35, 54.43222311461495],
  [50, 39.59775270904986],
  [70, 28.841546255021967],
  [85, 23.913168486298265],
] as const)("converts a %s mm full-frame lens to horizontal FOV", (focalLength, expected) => {
  expect(fullFrameHorizontalFov(focalLength)).toBeCloseTo(expected);
});
it.each([
  [0, 0, [1, 0, 0]],
  [90, 0, [0, 0, 1]],
  [270, 0, [0, 0, -1]],
  [0, 90, [0, -1, 0]],
  [180, -90, [0, 1, 0]],
  [0, 30, [Math.sqrt(3) / 2, -0.5, 0]],
])("maps heading %s and downward-positive pitch %s", (heading, pitch, direction) => {
  const source = modelFixture().cameras[0];
  if (!source) throw new Error("Missing camera");
  const camera = new PerspectiveCamera();
  applyEmbeddedCamera(
    camera,
    { ...source, heading: decimal(String(heading)), pitch: decimal(String(pitch)) },
    2,
  );
  expect(camera.position.toArray()).toEqual([0.5, 1.6, 0.5]);
  expect(camera.getWorldDirection(new Vector3()).toArray()).toEqual(
    direction.map((value) => expect.closeTo(value)),
  );
});
it("frames the complete model in both portrait and landscape views", () => {
  const bounds = new Box3(new Vector3(-2, 3, -5), new Vector3(4, 6, 0));
  for (const aspect of [0.4, 2]) {
    const camera = new PerspectiveCamera();
    frameInspection(camera, bounds, aspect);
    camera.updateMatrixWorld();
    for (const x of [-2, 4])
      for (const y of [3, 6])
        for (const z of [-5, 0]) {
          const projected = new Vector3(x, y, z).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(1);
          expect(Math.abs(projected.y)).toBeLessThan(1);
          expect(projected.z).toBeLessThan(1);
          expect(projected.z).toBeGreaterThan(-1);
        }
  }
});

it("keeps an off-center opening on the SVG's right when looking toward its top edge", () => {
  const model = modelFixture();
  const source = model.cameras[0];
  const door = model.doors[0];
  if (!source || !door) throw new Error("Missing asymmetric fixture geometry");
  const camera = new PerspectiveCamera();
  applyEmbeddedCamera(camera, source, 1);
  camera.updateMatrixWorld(true);
  const center = rendererBox(door.opening).getCenter(new Vector3());
  // The source door spans X=50..80 in a wall spanning X=0..100.
  // Looking toward SVG top (heading 270), it must be right of center.
  expect(center.clone().project(camera).x).toBeGreaterThan(0);
  const scene = buildApartmentScene(model);
  const wall = scene.objectsBySourceId.get("wall-1");
  if (!wall) throw new Error("Missing wall mesh");
  const ray = new Raycaster();
  const target = new Vector2(0.4, 0);
  ray.setFromCamera(target, camera);
  expect(ray.intersectObject(wall)).toHaveLength(0);
  ray.setFromCamera(new Vector2(-0.1, 0), camera);
  expect(ray.intersectObject(wall).length).toBeGreaterThan(0);
  scene.dispose();
});
