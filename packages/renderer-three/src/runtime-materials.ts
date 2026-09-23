import { validateRuntimePbrMaterial } from "@planaxis/model-3d";
import type {
  RuntimeFinishAssignments,
  RuntimePbrMaterial,
  RuntimeTextureReference,
} from "@planaxis/model-3d";
import {
  Color,
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshStandardNodeMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TangentSpaceNormalMap,
} from "three/webgpu";
import type { Material, Texture } from "three/webgpu";
import { float, texture as textureNode } from "three/tsl";

type RuntimeMaterial = MeshStandardMaterial | MeshStandardNodeMaterial;

export interface RuntimeFinishOptions {
  readonly assignments?: RuntimeFinishAssignments;
  /** Resolve an already loaded, borrowed texture. The adapter owns configured clones only.
   * Complete asynchronous loading before setModel; the caller owns the source and its image.
   * Source pixels must use a consistent +U right / +V up convention across all maps.
   */
  readonly resolveTexture?: (reference: RuntimeTextureReference) => Texture;
}

/** Scene-owned material/texture resources, including cleanup after partially failed adaptation. */
export class RuntimeMaterials {
  private readonly materials = new Set<Material>();
  private readonly textures = new Set<Texture>();
  private readonly adapted = new Map<RuntimePbrMaterial, RuntimeMaterial>();

  constructor(private readonly resolveTexture: RuntimeFinishOptions["resolveTexture"]) {}

  own<T extends Material>(material: T): T {
    this.materials.add(material);
    return material;
  }

  adapt(input: RuntimePbrMaterial): RuntimeMaterial {
    const cached = this.adapted.get(input);
    if (cached) return cached;
    validateRuntimePbrMaterial(input);
    const alpha = input.alpha;
    const MaterialClass = alpha?.mode === "mask" ? MeshStandardNodeMaterial : MeshStandardMaterial;
    const material = this.own(
      new MaterialClass({
        color: new Color().setRGB(...input.baseColor, SRGBColorSpace),
        roughness: input.roughness,
        metalness: input.metalness,
        opacity: alpha && alpha.mode !== "opaque" ? alpha.opacity : 1,
        transparent: alpha?.mode === "blend",
        depthWrite: alpha?.mode !== "blend",
        alphaTest: 0,
        shadowSide: FrontSide,
        normalMapType: TangentSpaceNormalMap,
      }),
    );
    const maps = input.textures;
    if (maps) {
      for (const [reference, slot, colorSpace] of [
        [maps.baseColorMap, "map", SRGBColorSpace],
        [maps.roughnessMap, "roughnessMap", NoColorSpace],
        [maps.metalnessMap, "metalnessMap", NoColorSpace],
        [maps.normalMap, "normalMap", NoColorSpace],
      ] as const) {
        if (reference === undefined) continue;
        if (!this.resolveTexture)
          throw new Error("Mapped finishes require a runtime texture resolver.");
        const texture = this.resolveTexture(reference).clone();
        this.textures.add(texture);
        texture.colorSpace = colorSpace;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        // Physical scaling is already baked into UVs. Borrowed transforms must not alter it.
        texture.channel = 0;
        texture.offset.set(0, 0);
        texture.repeat.set(1, 1);
        texture.center.set(0, 0);
        texture.rotation = 0;
        texture.matrixAutoUpdate = true;
        texture.updateMatrix();
        texture.needsUpdate = true;
        material[slot] = texture;
      }
    }
    if (alpha?.mode === "mask" && material instanceof MeshStandardNodeMaterial) {
      // Three's default node alpha test discards equality as well. Material 1.0
      // keeps alpha == cutoff, including cutoff 0 and 1. The mask also governs shadows.
      const sourceAlpha = material.map ? textureNode(material.map).a : float(1);
      material.maskNode = sourceAlpha.mul(alpha.opacity).greaterThanEqual(alpha.cutoff);
    }
    this.adapted.set(input, material);
    return material;
  }

  dispose(): void {
    for (const texture of this.textures) texture.dispose();
    for (const material of this.materials) material.dispose();
    this.textures.clear();
    this.materials.clear();
    this.adapted.clear();
  }
}

/** Qualitative renderer defaults, not measured optical or manufacturer properties. */
export function windowGlass(glassType: string | undefined): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: glassType === "tinted" ? 0xa6a6a6 : 0xffffff,
    roughness: glassType === "frosted" ? 0.5 : 0.05,
    metalness: 0,
    transmission: 1,
    opacity: 1,
    ior: 1.5,
    thickness: 0,
    side: DoubleSide,
  });
}
