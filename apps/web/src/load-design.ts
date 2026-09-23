import { parseDesignDescriptor, resolveDesignArchitecture } from "@planaxis/design";
import type { DesignResolutionResult, ValidatedDesignDescriptor } from "@planaxis/design";
import { deriveArchitecturalSurfaces } from "@planaxis/model-3d";
import { fetchBoundArchitecture, fetchDesignDescriptor } from "./design-api.js";
import { processDocument } from "./process-document.js";
import { ProjectLoadError } from "./project-api.js";
import type { ProjectMetadata } from "./project-api.js";
import type { DocumentState } from "./use-document.js";
import { loadMaterials, MaterialLoadError } from "./load-materials.js";
import type { LoadedMaterials } from "./load-materials.js";

export interface LoadedDesign {
  readonly descriptor?: ValidatedDesignDescriptor;
  readonly document?: DocumentState;
  readonly resolution?: DesignResolutionResult;
  readonly problem?: string;
  readonly materials?: LoadedMaterials;
  readonly materialProblem?: string;
}

export function resolveLoadedDesign(
  descriptor: ValidatedDesignDescriptor,
  document: DocumentState,
): LoadedDesign {
  if (document.status !== "valid") return { descriptor, document };
  const resolution = resolveDesignArchitecture(descriptor, {
    path: descriptor.document.architecture,
    finishTargets: deriveArchitecturalSurfaces(document.architecturalModel).finishTargets,
  });
  return { descriptor, document, resolution };
}

export async function loadDesign(
  path: string,
  project: ProjectMetadata,
  signal: AbortSignal,
): Promise<LoadedDesign> {
  let descriptor: ValidatedDesignDescriptor | undefined;
  let source: string | undefined;
  try {
    const parsed = parseDesignDescriptor(await fetchDesignDescriptor(path, signal), path);
    if (!parsed.ok)
      return { problem: `Design Format: ${parsed.error.code} — ${parsed.error.message}` };
    descriptor = parsed.value;
    signal.throwIfAborted();
    source = await fetchBoundArchitecture(descriptor.document.architecture, signal);
    signal.throwIfAborted();
    const loaded = resolveLoadedDesign(descriptor, { ...processDocument(source), source, project });
    if (!loaded.resolution?.ok) return loaded;
    try {
      const materials = await loadMaterials(loaded.resolution.value, signal);
      return { ...loaded, ...(materials ? { materials } : {}) };
    } catch (error) {
      signal.throwIfAborted();
      return {
        ...loaded,
        materialProblem:
          error instanceof MaterialLoadError
            ? error.message
            : "Renderer material adaptation failed.",
      };
    }
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      ...(descriptor === undefined ? {} : { descriptor }),
      ...(source === undefined
        ? {}
        : {
            document: {
              status: "failure",
              kind: "processing",
              source,
              project,
              message: "Unexpected processing failure in the bound architecture.",
            } as const,
          }),
      problem:
        error instanceof ProjectLoadError
          ? `Design project / API resource problem: ${error.message}`
          : "Design application failure: unable to process the bound architecture.",
    };
  }
}
