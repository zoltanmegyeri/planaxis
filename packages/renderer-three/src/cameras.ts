import type { ArchitecturalCamera3D } from "@planaxis/model-3d";
import { Box3, MathUtils, PerspectiveCamera, Vector3 } from "three/webgpu";
import { rendererPoint } from "./coordinates.js";

export const FULL_FRAME_FOCAL_LENGTHS = [16, 24, 35, 50, 70, 85] as const;

export type FullFrameFocalLength = (typeof FULL_FRAME_FOCAL_LENGTHS)[number];

export function isFullFrameFocalLength(value: number): value is FullFrameFocalLength {
  return FULL_FRAME_FOCAL_LENGTHS.some((focalLength) => focalLength === value);
}

export function fullFrameHorizontalFov(focalLengthMm: FullFrameFocalLength): number {
  return MathUtils.radToDeg(2 * Math.atan(36 / (2 * focalLengthMm)));
}

export function verticalFov(horizontalDegrees: number, aspect: number): number {
  return MathUtils.radToDeg(
    2 * Math.atan(Math.tan(MathUtils.degToRad(horizontalDegrees) / 2) / aspect),
  );
}

export function applyEmbeddedCamera(
  camera: PerspectiveCamera,
  source: ArchitecturalCamera3D,
  aspect: number,
): void {
  const heading = MathUtils.degToRad(source.heading.toNumber());
  const pitch = MathUtils.degToRad(source.pitch.toNumber());
  const direction = new Vector3(
    Math.cos(pitch) * Math.cos(heading),
    -Math.sin(pitch),
    Math.cos(pitch) * Math.sin(heading),
  );
  camera.position.copy(rendererPoint(source.position));
  // A heading-derived up vector remains defined even at vertical pitch endpoints.
  camera.up.set(
    Math.sin(pitch) * Math.cos(heading),
    Math.cos(pitch),
    Math.sin(pitch) * Math.sin(heading),
  );
  camera.lookAt(camera.position.clone().add(direction));
  camera.aspect = aspect;
  camera.fov = verticalFov(source.horizontalFov.toNumber(), aspect);
  camera.updateProjectionMatrix();
}

export function frameInspection(camera: PerspectiveCamera, bounds: Box3, aspect: number): Vector3 {
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 0.01);
  camera.up.set(0, 1, 0);
  camera.fov = 50;
  camera.aspect = aspect;
  const halfAngle = Math.min(
    MathUtils.degToRad(camera.fov / 2),
    Math.atan(Math.tan(MathUtils.degToRad(camera.fov / 2)) * aspect),
  );
  const distance = (radius / Math.sin(halfAngle)) * 1.15;
  camera.position.copy(center).add(new Vector3(1, 1.3, 1).normalize().multiplyScalar(distance));
  camera.near = Math.max(radius / 10000, 0.00001);
  camera.far = Math.max(distance * 10, radius * 100);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return center;
}
