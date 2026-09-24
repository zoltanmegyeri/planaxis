import type {
  EffectiveMaterial,
  EffectiveMaterialAlpha,
  ValidatedMaterialDescriptor,
} from "./material.js";

/** Applies Material 1.0 / 1.1 section 20 defaults without changing the durable document. */
export function getEffectiveMaterial(descriptor: ValidatedMaterialDescriptor): EffectiveMaterial {
  const document = descriptor.document;
  const alpha = document.alpha;
  let effectiveAlpha: EffectiveMaterialAlpha;
  if (alpha === undefined || alpha.mode === "opaque") {
    effectiveAlpha = Object.freeze({ mode: "opaque" });
  } else if (alpha.mode === "mask") {
    effectiveAlpha = Object.freeze({
      mode: "mask",
      opacity: alpha.opacity ?? 1,
      cutoff: alpha.cutoff,
    });
  } else {
    effectiveAlpha = Object.freeze({ mode: "blend", opacity: alpha.opacity ?? 1 });
  }
  return Object.freeze({
    baseColor: document.baseColor ?? Object.freeze([1, 1, 1] as const),
    roughness: document.roughness ?? 1,
    metalness: document.metalness ?? 0,
    alpha: effectiveAlpha,
    ...(document.maps?.ambientOcclusion === undefined
      ? {}
      : { ambientOcclusionStrength: document.ambientOcclusionStrength ?? 1 }),
    ...(document.maps === undefined ? {} : { maps: document.maps, mapping: document.mapping }),
  });
}
