import type { MeshStandardMaterial, Texture } from "three/webgpu";

export const TRACING_MATERIAL_TEXELS = 3;
export interface TracingImage {
  readonly texture: Texture;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}
export interface TracingMaterials {
  readonly records: Float32Array;
  readonly images: readonly TracingImage[];
  readonly imageRecords: Float32Array;
  readonly width: number;
  readonly height: number;
}

/** No resampling: compactly shelf-pack native pixels. Roles share raw storage, not color interpretation.
 * Source/decoded-image ownership remains with the established material loader.
 */
export function prepareTracingMaterials(
  materials: readonly MeshStandardMaterial[],
  limit: number,
): TracingMaterials {
  const images: TracingImage[] = [];
  const records: number[] = [];
  const imageIndex = (texture: Texture | null): number => {
    if (!texture) return -1;
    const known = images.findIndex(
      (image) => image.texture.source === texture.source && image.texture.flipY === texture.flipY,
    );
    if (known !== -1) return known;
    const size = texture.image as { width?: number; height?: number } | undefined;
    const w = size?.width,
      h = size?.height;
    if (!w || !h || !Number.isInteger(w) || !Number.isInteger(h))
      throw new Error("Path tracing texture is not decoded and ready.");
    if (w > limit || h > limit)
      throw new Error("Material image exceeds path tracing texture capacity.");
    if (images.length >= 2 ** 24)
      throw new Error("Material images exceed path tracing texture capacity.");
    images.push({ texture, width: w, height: h, x: 0, y: 0 });
    return images.length - 1;
  };
  for (const material of materials) {
    if (material.transparent || material.alphaTest > 0)
      throw new Error("Path tracing supports opaque alpha only.");
    records.push(
      material.color.r,
      material.color.g,
      material.color.b,
      material.roughness,
      material.metalness,
      material.aoMap ? material.aoMapIntensity : 0,
      imageIndex(material.map),
      imageIndex(material.roughnessMap),
      imageIndex(material.metalnessMap),
      imageIndex(material.normalMap),
      imageIndex(material.aoMap),
      0,
    );
  }
  if (materials.length * TRACING_MATERIAL_TEXELS >= 2 ** 24)
    throw new Error("Materials exceed exact path tracing indexing capacity.");
  if (
    records.some(
      (value) => !Number.isFinite(Math.fround(value)) || (value > 0 && Math.fround(value) === 0),
    )
  )
    throw new Error("Material factors exceed path tracing numeric capacity.");
  const layout = packImages(images, limit);
  return {
    records: new Float32Array(records),
    images: layout.images,
    imageRecords: new Float32Array(
      layout.images.flatMap((image) => [image.x, image.y, image.width, image.height]),
    ),
    width: layout.width,
    height: layout.height,
  };
}

/** The device's maximum width is a limit, not a useful allocation size. Try compact shelf
 * widths and retain the smallest occupied rectangle. Sort only placement order; image IDs,
 * native dimensions, orientation and role references stay unchanged.
 */
function packImages(
  images: readonly TracingImage[],
  limit: number,
): { images: TracingImage[]; width: number; height: number } {
  if (!images.length) return { images: [], width: 1, height: 1 };
  const area = images.reduce((sum, image) => sum + image.width * image.height, 0);
  if (area > limit * limit)
    throw new Error("Material images exceed path tracing texture capacity.");
  const order = images
    .map((_image, index) => index)
    .sort(
      (a, b) =>
        images[b]!.height - images[a]!.height || images[b]!.width - images[a]!.width || a - b,
    );
  const widest = images.reduce((value, image) => Math.max(value, image.width), 1);
  const widths = new Set([widest, Math.max(widest, Math.ceil(Math.sqrt(area))), limit]);
  let cumulative = 0;
  for (const index of order) {
    cumulative = Math.min(limit, cumulative + images[index]!.width);
    widths.add(cumulative);
  }
  let best: { images: TracingImage[]; width: number; height: number } | undefined;
  for (const candidate of [...widths].sort((a, b) => a - b)) {
    const shelves: { x: number; y: number; height: number }[] = [];
    const placed: TracingImage[] = [];
    let width = 0,
      height = 0;
    for (const index of order) {
      const image = images[index]!;
      let shelf = shelves.find((row) => row.x + image.width <= candidate);
      if (!shelf) {
        shelf = { x: 0, y: height, height: image.height };
        height += image.height;
        if (height > limit) break;
        shelves.push(shelf);
      }
      placed[index] = { ...image, x: shelf.x, y: shelf.y };
      shelf.x += image.width;
      width = Math.max(width, shelf.x);
    }
    if (height > limit) continue;
    if (
      !best ||
      width * height < best.width * best.height ||
      (width * height === best.width * best.height &&
        Math.max(width, height) < Math.max(best.width, best.height))
    )
      best = { images: placed, width, height };
  }
  if (!best) throw new Error("Material images exceed path tracing texture capacity.");
  return best;
}

/** CPU reference for channel/color contracts, also useful to numerical review tools. */
export function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
export function effectiveTracingFactors(
  material: MeshStandardMaterial,
  samples: Partial<
    Record<"baseColor" | "roughness" | "metalness" | "ambientOcclusion", readonly number[]>
  >,
): { color: number[]; roughness: number; metalness: number; ao: number } {
  return {
    color: material.color
      .toArray()
      .map((value, channel) => value * srgbToLinear(samples.baseColor?.[channel] ?? 1)),
    roughness: material.roughness * (samples.roughness?.[1] ?? 1),
    metalness: material.metalness * (samples.metalness?.[2] ?? 1),
    ao:
      1 -
      (material.aoMap ? material.aoMapIntensity : 0) * (1 - (samples.ambientOcclusion?.[0] ?? 1)),
  };
}
