import { Vector3 } from "three/webgpu";
import type { PerspectiveCamera } from "three/webgpu";

/** Borrow the actual projection: native WebGPU may have switched it to reversed
 * [0,1] depth. Hard-coding WebGL's -1 near plane would cast rays behind the camera.
 */
export function cameraNearClipDepth(camera: PerspectiveCamera): number {
  return new Vector3(0, 0, -camera.near).applyMatrix4(camera.projectionMatrix).z;
}
