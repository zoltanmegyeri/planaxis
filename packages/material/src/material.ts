export const MATERIAL_SCHEMA = "planaxis-material/1.0";
export const MATERIAL_SCHEMA_1_1 = "planaxis-material/1.1";

/** An sRGB factor, with each component in [0, 1]. */
export type MaterialBaseColor = readonly [number, number, number];

/** Common physical period; image right/up follows mapping +U/+V for every map. */
export interface MaterialMapping {
  readonly widthCm: number;
  readonly heightCm: number;
}

/** Project-relative texture references, without resource existence or decoding guarantees. */
export interface MaterialMaps {
  /** sRGB RGB; its alpha channel supplies source alpha when available. */
  readonly baseColor?: string;
  /** Non-color data, sampled from the green channel. */
  readonly roughness?: string;
  /** Non-color data, sampled from the blue channel. */
  readonly metalness?: string;
  /** Non-color tangent normal: +X = +U, +Y = +V, +Z = outward normal. */
  readonly normal?: string;
  /** Material 1.1 non-color data, sampled from red using the common physical mapping. */
  readonly ambientOcclusion?: string;
}

export type MaterialAlpha =
  | { readonly mode: "opaque" }
  | { readonly mode: "mask"; readonly opacity?: number; readonly cutoff: number }
  | { readonly mode: "blend"; readonly opacity?: number };

export type EffectiveMaterialAlpha =
  | { readonly mode: "opaque" }
  | { readonly mode: "mask"; readonly opacity: number; readonly cutoff: number }
  | { readonly mode: "blend"; readonly opacity: number };

/** Physical dimensions exist exactly when texture maps exist. */
export type MaterialTextures =
  | { readonly maps?: never; readonly mapping?: never }
  | { readonly maps: MaterialMaps; readonly mapping: MaterialMapping };

/** Only durable fields, preserving omission rather than inserting defaults. */
export type MaterialDocument = MaterialTextures & {
  readonly name: string;
  readonly baseColor?: MaterialBaseColor;
  readonly roughness?: number;
  readonly metalness?: number;
  readonly alpha?: MaterialAlpha;
} & (
    | { readonly schema: typeof MATERIAL_SCHEMA; readonly ambientOcclusionStrength?: never }
    | { readonly schema: typeof MATERIAL_SCHEMA_1_1; readonly ambientOcclusionStrength?: number }
  );

/** Derived Material 1.0 / 1.1 semantics, not a document to serialize or a renderer material. */
export type EffectiveMaterial = MaterialTextures & {
  readonly baseColor: MaterialBaseColor;
  readonly roughness: number;
  readonly metalness: number;
  /** Present only with an AO map; effectiveAO = 1 - strength * (1 - red sample). */
  readonly ambientOcclusionStrength?: number;
  readonly alpha: EffectiveMaterialAlpha;
};

declare const validatedMaterialBrand: unique symbol;

/** Format-conformant only; project resolution, decoding, and adaptation remain separate. */
export interface ValidatedMaterialDescriptor {
  readonly [validatedMaterialBrand]: true;
  readonly path: string;
  readonly document: MaterialDocument;
}
