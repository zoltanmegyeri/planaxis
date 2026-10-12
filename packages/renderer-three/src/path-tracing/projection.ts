import { Vector3 } from "three/webgpu";
import type { PerspectiveCamera } from "three/webgpu";

/** Borrow the actual projection: native WebGPU may have switched it to reversed
 * [0,1] depth. Hard-coding WebGL's -1 near plane would cast rays behind the camera.
 */
export function cameraNearClipDepth(camera: PerspectiveCamera): number {
  return new Vector3(0, 0, -camera.near).applyMatrix4(camera.projectionMatrix).z;
}

/** Perspective X/Y/W rows determine viewing rays. Three may replace only the
 * depth row on its first Interactive draw after a tracing-first mount. That
 * encoding change preserves rays and must not discard unchanged HDR history.
 * Keep clipping inputs explicit while retaining all ray-affecting matrix entries.
 */
export function cameraRayProjectionKey(camera: PerspectiveCamera): readonly number[] {
  return [
    ...camera.projectionMatrix.elements.filter((_, index) => index % 4 !== 2),
    camera.near,
    camera.far,
  ];
}
