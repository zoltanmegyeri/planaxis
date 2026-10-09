import { Box3, Matrix4, Mesh, Scene, Vector4 } from "three/webgpu";
import type { Light, NodeFrame, Object3D, UniformNode, WebGPURenderer } from "three/webgpu";
import { uniform, uniformArray } from "three/tsl";
import type { VXGIVolume } from "three/addons/lighting/vxgi/VXGIVolume.js";

/** Session state, deliberately separate from quality and all persistent formats. */
export interface RendererGlobalIlluminationSettings {
  readonly enabled: boolean;
}

export interface GlobalIlluminationCapability {
  readonly available: boolean;
  readonly reason?: string;
}

export const DEFAULT_GLOBAL_ILLUMINATION_SETTINGS: RendererGlobalIlluminationSettings =
  Object.freeze({ enabled: false });

/** Keep light evaluation out of the geometry-only depth/normal/velocity pass. */
export const RENDER_LIGHT_LAYER = 1;

/** Request only an advertised limit; r186 otherwise keeps WebGPU's 16-texture default. */
export async function configureGiTextureLimit(
  requiredLimits: Record<string, number>,
  gpu: GPU | undefined = globalThis.navigator?.gpu,
): Promise<void> {
  if (!gpu) return;
  try {
    const options: GPURequestAdapterOptions & { featureLevel: "compatibility" } = {
      featureLevel: "compatibility",
    };
    const adapter = await gpu.requestAdapter(options);
    if (adapter) {
      requiredLimits.maxSampledTexturesPerShaderStage = Math.min(
        48,
        adapter.limits.maxSampledTexturesPerShaderStage,
      );
      requiredLimits.maxSamplersPerShaderStage = Math.min(
        48,
        adapter.limits.maxSamplersPerShaderStage,
      );
    }
  } catch {
    // Leave normal renderer initialization responsible for WebGL2 fallback.
  }
}

export function giLightBudget(renderer: WebGPURenderer): number {
  const backend = renderer.backend as WebGPURenderer["backend"] & { device?: GPUDevice };
  return Math.min(
    VXGI_CONFIGURATION.lightBudget,
    backend.device?.limits.maxSampledTexturesPerShaderStage ?? VXGI_CONFIGURATION.lightBudget,
    backend.device?.limits.maxSamplersPerShaderStage ?? VXGI_CONFIGURATION.lightBudget,
  );
}

/** r186 otherwise caches FRAME effects until its unrelated housekeeping RAF. */
export function beginGiFrame(renderer: WebGPURenderer): void {
  const frame = (renderer as WebGPURenderer & { _nodes?: { nodeFrame: NodeFrame } })._nodes
    ?.nodeFrame;
  if (!frame) throw new Error("Unsupported Three.js node-frame layout.");
  frame.update();
}

/** Engineering defaults; acceptance measurements are recorded in the architecture docs. */
export const VXGI_CONFIGURATION = Object.freeze({
  resolution: 256,
  directionalRadiance: true,
  bounces: 0,
  coneCount: 1,
  coneAngle: 25,
  bounceConeAngle: 10,
  // Qualitative indirect-light gain: unity left daylight bounce barely visible.
  // Apply in the GI pass, preserving direct light power and final exposure.
  giIntensity: 8,
  stepScale: 0.5,
  normalOffset: 0.5,
  maxDistance: 0,
  lightBudget: 32,
  convergenceFrames: 32,
  boundsMargin: 0.25,
});

export type VxgiConfiguration = {
  readonly [
    Key in keyof typeof VXGI_CONFIGURATION
  ]: (typeof VXGI_CONFIGURATION)[Key] extends boolean ? boolean : number;
};

export function isRendererGlobalIlluminationSettings(
  value: unknown,
): value is RendererGlobalIlluminationSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "enabled" in value &&
    typeof value.enabled === "boolean"
  );
}

/** Inspect the initialized backend, rather than navigator.gpu or the requested preset. */
export function globalIlluminationCapability(
  renderer: WebGPURenderer,
): GlobalIlluminationCapability {
  return renderer.backend &&
    "isWebGPUBackend" in renderer.backend &&
    renderer.backend.isWebGPUBackend === true
    ? { available: true }
    : {
        available: false,
        reason: "Global illumination requires native WebGPU; unavailable on WebGL2.",
      };
}

export interface GiLightCandidate {
  readonly key: string;
  readonly priority: number;
  readonly light: Light;
}

export function selectGiLights(
  candidates: readonly GiLightCandidate[],
  budget: number = VXGI_CONFIGURATION.lightBudget,
): readonly Light[] {
  return candidates
    .filter(({ light }) => light.visible && light.intensity > 0)
    .sort((a, b) => a.priority - b.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, budget)
    .map(({ light }) => light);
}

/** A collector view borrows references without reparenting any rendered object. */
export class GiScene extends Scene {
  architecture: Object3D | undefined;
  lights: readonly Light[] = [];

  constructor() {
    super();
    this.matrixWorldAutoUpdate = false;
  }

  override traverseVisible(callback: (object: Object3D) => void): void {
    this.architecture?.traverseVisible((object) => {
      // Glass and semantic markers have no opaque architectural occlusion.
      if (object instanceof Mesh && object.castShadow && !object.userData.visualizationMarker)
        callback(object);
    });
    for (const light of this.lights) callback(light);
  }

  architectureBounds(): Box3 {
    const bounds = new Box3();
    this.traverseVisible((object) => {
      if (object instanceof Mesh) bounds.expandByObject(object);
    });
    return bounds.expandByScalar(VXGI_CONFIGURATION.boundsMargin);
  }
}

/**
 * r186.1 exposes maxLights, but allocates its uniforms for eight slots only in the
 * constructor. Provision the matching arrays before the first shader build. Keep
 * this version-specific bridge isolated; remove when upstream supports resizing.
 */
export function provisionVxgiLightBudget(volume: VXGIVolume, budget: number): void {
  type Slots = {
    _lightsArray: Vector4[];
    _lightsNode: ReturnType<typeof uniformArray>;
    _shadowMatrices: UniformNode<"mat4", Matrix4>[];
    _shadowParams: UniformNode<"vec4", Vector4>[];
  };
  const slots = volume as VXGIVolume & Slots;
  if (
    !Array.isArray(slots._lightsArray) ||
    !Array.isArray(slots._shadowMatrices) ||
    !Array.isArray(slots._shadowParams)
  )
    throw new Error("Unsupported Three.js VXGI light-slot layout.");
  while (slots._lightsArray.length < budget * 4) slots._lightsArray.push(new Vector4());
  slots._lightsNode = uniformArray(slots._lightsArray, "vec4");
  while (slots._shadowMatrices.length < budget) slots._shadowMatrices.push(uniform(new Matrix4()));
  while (slots._shadowParams.length < budget) slots._shadowParams.push(uniform(new Vector4()));
  volume.maxLights = budget;
}
