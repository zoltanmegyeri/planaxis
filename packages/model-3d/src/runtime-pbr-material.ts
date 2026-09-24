import type { Decimal } from "@planaxis/geometry";
import type { FinishTarget, FinishTargetId } from "./architectural-surfaces.js";

/** In-process identity only. No asset ID, URL, project path, or persistence semantics. */
export type RuntimeTextureReference = symbol;

/** All maps share one physical repeat size and orientation. */
export interface RuntimePbrTextures {
  readonly widthCm: Decimal;
  readonly heightCm: Decimal;
  readonly baseColorMap?: RuntimeTextureReference;
  /** Roughness is read from green; metalness from blue (metallic/roughness convention). */
  readonly roughnessMap?: RuntimeTextureReference;
  readonly metalnessMap?: RuntimeTextureReference;
  /** Tangent-space RGB normal, with +Y along the mapping's +V. */
  readonly normalMap?: RuntimeTextureReference;
  /** Non-color red channel, sharing the same physical period and orientation. */
  readonly ambientOcclusionMap?: RuntimeTextureReference;
}

/** Runtime presentation input, never a member of ArchitecturalModel3D or a persisted format. */
export interface RuntimePbrMaterial {
  /** sRGB components in [0,1]. */
  readonly baseColor: readonly [number, number, number];
  readonly roughness: number;
  readonly metalness: number;
  /** Required exactly when an AO map exists; effectiveAO = 1 - strength * (1 - sample). */
  readonly ambientOcclusionStrength?: number;
  readonly textures?: RuntimePbrTextures;
  readonly alpha?:
    | { readonly mode: "opaque" }
    | { readonly mode: "mask"; readonly opacity: number; readonly cutoff: number }
    | { readonly mode: "blend"; readonly opacity: number };
}

export type RuntimeFinishAssignments = ReadonlyMap<FinishTargetId, RuntimePbrMaterial>;

/** Invalid programmer-supplied runtime descriptors fail before allocating renderer resources. */
export function validateRuntimePbrMaterial(material: RuntimePbrMaterial): void {
  const unit = (value: number, name: string): void => {
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new RangeError(`${name} must be finite and in [0,1].`);
  };
  for (const component of material.baseColor) unit(component, "Base color component");
  unit(material.roughness, "Roughness");
  unit(material.metalness, "Metalness");
  if (material.ambientOcclusionStrength !== undefined)
    unit(material.ambientOcclusionStrength, "Ambient-occlusion strength");
  if (
    (material.textures?.ambientOcclusionMap !== undefined) !==
    (material.ambientOcclusionStrength !== undefined)
  )
    throw new RangeError("Ambient-occlusion map and effective strength must be provided together.");
  if (material.alpha && material.alpha.mode !== "opaque") {
    unit(material.alpha.opacity, "Opacity");
    if (material.alpha.mode === "mask") unit(material.alpha.cutoff, "Alpha cutoff");
  }
  if (material.textures) {
    for (const size of [material.textures.widthCm, material.textures.heightCm])
      if (!size.isFinite() || !size.gt(0))
        throw new RangeError("Physical texture dimensions must be finite positive centimeters.");
  }
}

/** Undefined means the adapter's existing neutral default. */
export function resolveRuntimeFinish(
  target: FinishTarget,
  assignments: RuntimeFinishAssignments,
): RuntimePbrMaterial | undefined {
  return (
    assignments.get(target.id) ??
    (target.scope === "space" ? assignments.get(target.baseTargetId) : undefined)
  );
}
