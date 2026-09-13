import {
  CubeUVReflectionMapping,
  HalfFloatType,
  InstancedMesh,
  LinearFilter,
  LinearSRGBColorSpace,
  PMREMGenerator,
  RenderTarget,
} from "three/webgpu";
import type { WebGPURenderer } from "three/webgpu";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Call after backend initialization. The caller owns the returned target and texture. */
export function createStudioEnvironment(renderer: WebGPURenderer): RenderTarget {
  const room = new RoomEnvironment();
  const generator = new PMREMGenerator(renderer);
  // Three.js CubeUV packing for 256-pixel faces: 3 columns, 4 rows (including roughness LODs).
  // Own the output before generation so a failed GPU draw cannot orphan its allocation.
  const target = new RenderTarget(768, 1024, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
    colorSpace: LinearSRGBColorSpace,
    depthBuffer: true,
  });
  target.texture.mapping = CubeUVReflectionMapping;
  // PMREMGenerator sets this runtime marker; the current Three.js typings omit it.
  Object.assign(target.texture, { isPMREMTexture: true });
  target.scissorTest = true;
  try {
    return generator.fromScene(room, 0, 0.1, 100, { size: 256, renderTarget: target });
  } catch (error) {
    target.dispose();
    throw error;
  } finally {
    generator.dispose();
    room.traverse((object) => {
      if (object instanceof InstancedMesh) object.dispose();
    });
    room.dispose();
  }
}
