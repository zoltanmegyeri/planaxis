import type { RuntimeTextureReference } from "@planaxis/model-3d";
import { Texture } from "three/webgpu";
import type { RuntimeFinishOptions } from "./runtime-materials.js";

export class TexturePreparationError extends Error {
  constructor(readonly kind: "content" | "decode" | "renderer") {
    super(
      kind === "content"
        ? "Unsupported or mismatched texture content."
        : kind === "decode"
          ? "Texture image decode/loading failed."
          : "Renderer texture preparation failed.",
    );
  }
}

export interface TextureResource {
  readonly path: string;
  readonly bytes: ArrayBuffer;
}

export interface PreparedTextures {
  readonly resolveTexture: NonNullable<RuntimeFinishOptions["resolveTexture"]>;
  /** Release after scenes borrowing these sources have been replaced/disposed. */
  dispose(): void;
}

/** Identify supported containers before decoding, independently of HTTP MIME headers. */
function contentType({ path, bytes }: TextureResource): string {
  const data = new Uint8Array(bytes);
  const matches = (offset: number, signature: readonly number[]): boolean =>
    signature.every((byte, index) => data[offset + index] === byte);
  const png = matches(0, [137, 80, 78, 71, 13, 10, 26, 10]);
  const jpeg = matches(0, [255, 216, 255]);
  const webp = matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80]);
  if (path.endsWith(".png") && png) return "image/png";
  if ((path.endsWith(".jpg") || path.endsWith(".jpeg")) && jpeg) return "image/jpeg";
  if (path.endsWith(".webp") && webp) return "image/webp";
  throw new TexturePreparationError("content");
}

/** Owns decoded images and source textures; scene adaptation owns configured clones.
 * The input map is already deduplicated by the resource orchestrator.
 */
export async function prepareRuntimeTextures(
  resources: ReadonlyMap<RuntimeTextureReference, TextureResource>,
  signal: AbortSignal,
): Promise<PreparedTextures> {
  const sources = new Map<RuntimeTextureReference, Texture>();
  const images = new Set<ImageBitmap>();
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const source of sources.values()) source.dispose();
    for (const image of images) image.close();
    sources.clear();
    images.clear();
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    for (const [reference, resource] of resources) {
      signal.throwIfAborted();
      const type = contentType(resource);
      let image: ImageBitmap;
      try {
        // Flip once at decode so image-up is +V on both backends. Preserve raw
        // data channels and unassociated alpha; source textures disable further flipping.
        image = await createImageBitmap(new Blob([resource.bytes], { type }), {
          imageOrientation: "flipY",
          premultiplyAlpha: "none",
          colorSpaceConversion: "none",
        });
      } catch {
        signal.throwIfAborted();
        throw new TexturePreparationError("decode");
      }
      if (signal.aborted) {
        image.close();
        signal.throwIfAborted();
      }
      images.add(image);
      signal.throwIfAborted();
      const texture = new Texture(image);
      sources.set(reference, texture);
      texture.flipY = false;
      texture.needsUpdate = true;
    }
    signal.throwIfAborted();
    return {
      resolveTexture(reference) {
        const texture = sources.get(reference);
        if (!texture || disposed) throw new TexturePreparationError("renderer");
        return texture;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    if (signal.aborted || error instanceof TexturePreparationError) throw error;
    throw new TexturePreparationError("renderer");
  } finally {
    signal.removeEventListener("abort", dispose);
  }
}
