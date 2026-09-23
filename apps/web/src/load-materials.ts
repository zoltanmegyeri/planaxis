import type { ValidatedDesignDescriptor } from "@planaxis/design";
import { createDecimal } from "@planaxis/geometry";
import { getEffectiveMaterial, parseMaterialDescriptor } from "@planaxis/material";
import type { EffectiveMaterial } from "@planaxis/material";
import type {
  FinishTargetId,
  RuntimePbrMaterial,
  RuntimeTextureReference,
} from "@planaxis/model-3d";
import { prepareRuntimeTextures, TexturePreparationError } from "@planaxis/renderer-three";
import type { RuntimeFinishOptions, TextureResource } from "@planaxis/renderer-three";

export interface LoadedMaterials {
  readonly finishes: RuntimeFinishOptions;
  dispose(): void;
}

export class MaterialLoadError extends Error {}

async function readResource(
  kind: "material" | "material-texture",
  path: string,
  signal: AbortSignal,
): Promise<Response> {
  const label = kind === "material" ? "Material descriptor" : "Texture";
  try {
    const response = await fetch(`/api/project/${kind}?${new URLSearchParams({ path })}`, {
      signal,
    });
    if (!response.ok)
      throw new MaterialLoadError(
        `${label} project / API resource failure (HTTP ${response.status}).`,
      );
    return response;
  } catch (error) {
    signal.throwIfAborted();
    throw error instanceof MaterialLoadError
      ? error
      : new MaterialLoadError(`${label} project / API resource failure.`);
  }
}

/** Called only after successful design/architecture resolution. No global resource cache. */
export async function loadMaterials(
  design: ValidatedDesignDescriptor,
  signal: AbortSignal,
): Promise<LoadedMaterials | undefined> {
  const assignments = design.document.finishes;
  if (!assignments) return undefined;
  const materials = new Map<string, EffectiveMaterial>();
  const references = new Map<string, RuntimeTextureReference>();
  for (const path of new Set(assignments.map((assignment) => assignment.material))) {
    signal.throwIfAborted();
    const response = await readResource("material", path, signal);
    let source: string;
    try {
      source = await response.text();
    } catch {
      signal.throwIfAborted();
      throw new MaterialLoadError(
        "Material descriptor project / API resource failure: unreadable content.",
      );
    }
    signal.throwIfAborted();
    const parsed = parseMaterialDescriptor(source, path);
    if (!parsed.ok)
      // Codes are controlled; omit untrusted values and paths from validation details.
      throw new MaterialLoadError(
        `Material Format: ${parsed.error.code} — descriptor validation failed.`,
      );
    const effective = getEffectiveMaterial(parsed.value);
    materials.set(path, effective);
    for (const texture of Object.values(effective.maps ?? {}))
      if (!references.has(texture)) references.set(texture, Symbol());
  }
  const resources = new Map<RuntimeTextureReference, TextureResource>();
  for (const [path, reference] of references) {
    signal.throwIfAborted();
    const response = await readResource("material-texture", path, signal);
    try {
      resources.set(reference, { path, bytes: await response.arrayBuffer() });
    } catch {
      signal.throwIfAborted();
      throw new MaterialLoadError("Texture project / API resource failure: unreadable content.");
    }
    signal.throwIfAborted();
  }
  const prepared = await prepareRuntimeTextures(resources, signal).catch((error: unknown) => {
    signal.throwIfAborted();
    throw new MaterialLoadError(
      error instanceof TexturePreparationError
        ? error.message
        : "Renderer texture preparation failed.",
    );
  });
  try {
    signal.throwIfAborted();
    const runtime = new Map<string, RuntimePbrMaterial>();
    for (const [path, material] of materials) {
      const { baseColor, roughness, metalness, alpha, maps, mapping } = material;
      const textures =
        mapping === undefined
          ? undefined
          : {
              // Material dimensions have JSON-number semantics; adapt them to the runtime type.
              widthCm: createDecimal(String(mapping.widthCm)),
              heightCm: createDecimal(String(mapping.heightCm)),
              ...Object.fromEntries(
                Object.entries(maps).map(([role, resource]) => [
                  `${role}Map`,
                  references.get(resource),
                ]),
              ),
            };
      runtime.set(path, {
        baseColor,
        roughness,
        metalness,
        alpha,
        ...(textures ? { textures } : {}),
      });
    }
    const finishes = new Map<FinishTargetId, RuntimePbrMaterial>();
    for (const assignment of assignments) {
      const material = runtime.get(assignment.material);
      if (!material) throw new Error("Missing prepared material.");
      finishes.set(assignment.target, material);
    }
    return {
      finishes: { assignments: finishes, resolveTexture: prepared.resolveTexture },
      dispose: prepared.dispose,
    };
  } catch {
    prepared.dispose();
    signal.throwIfAborted();
    throw new MaterialLoadError("Renderer material adaptation failed.");
  }
}
