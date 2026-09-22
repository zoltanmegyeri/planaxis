import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DESIGN_SCHEMA, validateDesignDescriptor } from "@planaxis/design";
import type { ValidatedDesignDescriptor } from "@planaxis/design";
import { fetchDesignPaths, persistDesign } from "./design-api.js";
import { designPresentation } from "./design-presentation.js";
import { loadDesign } from "./load-design.js";
import type { LoadedDesign } from "./load-design.js";
import { ProjectLoadError } from "./project-api.js";
import type { DocumentState } from "./use-document.js";

export function useDesign(activeDocument: DocumentState) {
  const project = "project" in activeDocument ? activeDocument.project : undefined;
  const [paths, setPaths] = useState<readonly string[]>([]);
  const [discoveryError, setDiscoveryError] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [loaded, setLoaded] = useState<LoadedDesign>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState("");
  const [notice, setNotice] = useState("");
  const [rendererFailed, setRendererFailed] = useState(false);
  const generation = useRef(0);
  const discoveryGeneration = useRef(0);
  const selectionRequest = useRef<AbortController | null>(null);
  const writeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async (signal: AbortSignal): Promise<void> => {
    const current = ++discoveryGeneration.current;
    try {
      const next = await fetchDesignPaths(signal);
      if (!signal.aborted && current === discoveryGeneration.current) {
        setPaths(next);
        setDiscoveryError("");
      }
    } catch (error) {
      if (!signal.aborted && current === discoveryGeneration.current)
        setDiscoveryError(
          error instanceof ProjectLoadError ? error.message : "Design discovery failed.",
        );
    }
  }, []);
  useEffect(() => {
    if (project === undefined) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [project, refresh]);

  const select = useCallback((path: string): void => {
    generation.current++;
    selectionRequest.current?.abort();
    writeRequest.current?.abort();
    writeRequest.current = null;
    setBusy(false);
    setWriteError("");
    setNotice("");
    setRendererFailed(false);
    setLoaded({});
    setLoading(path !== "");
    setSelectedPath(path);
  }, []);

  useEffect(() => {
    if (!selectedPath || project === undefined) return;
    const controller = new AbortController();
    const current = generation.current;
    selectionRequest.current = controller;
    void loadDesign(selectedPath, project, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || current !== generation.current) return;
        setLoaded(result);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted || current !== generation.current) return;
        setLoaded({ problem: "Design application failure: unable to load this scenario." });
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedPath, project]);
  useEffect(
    () => () => {
      generation.current++;
      writeRequest.current?.abort();
    },
    [],
  );

  const scenarioDocument: DocumentState | undefined =
    rendererFailed && loaded.document?.status === "valid"
      ? {
          status: "failure",
          kind: "renderer",
          project: loaded.document.project,
          source: loaded.document.source,
          message:
            "Renderer failure: unable to display this architecture or its presentation settings.",
        }
      : loaded.document;
  const displayedDocument = selectedPath === "" ? activeDocument : scenarioDocument;
  const architecturePath =
    selectedPath === "" ? project?.architecture.active : loaded.descriptor?.document.architecture;
  const presentation = useMemo(
    () =>
      selectedPath === ""
        ? undefined
        : designPresentation(
            loaded.resolution?.ok ? loaded.resolution.value.document.presentation : undefined,
          ),
    [selectedPath, loaded.resolution],
  );

  async function write(
    descriptor: ValidatedDesignDescriptor,
    method: "POST" | "PUT",
  ): Promise<void> {
    if (writeRequest.current !== null) return;
    const controller = new AbortController();
    const current = generation.current;
    writeRequest.current = controller;
    setBusy(true);
    setWriteError("");
    setNotice("");
    try {
      await persistDesign(descriptor, method, controller.signal);
      if (controller.signal.aborted || current !== generation.current) return;
      if (method === "POST") {
        // Discovery can fail independently after a successful durable create.
        await refresh(controller.signal);
        if (controller.signal.aborted || current !== generation.current) return;
        setPaths((previous) => [...new Set([...previous, descriptor.path])]);
        select(descriptor.path);
      } else {
        // Editing never changes binding or finishes, so reuse the validated architecture.
        setLoaded((previous) => ({
          ...previous,
          descriptor,
          ...(previous.resolution === undefined
            ? {}
            : {
                resolution: previous.resolution.ok
                  ? { ok: true, value: descriptor }
                  : previous.resolution,
              }),
        }));
        setRendererFailed(false);
        setNotice("Design saved.");
      }
    } catch (error) {
      if (!controller.signal.aborted && current === generation.current)
        setWriteError(error instanceof ProjectLoadError ? error.message : "Design save failed.");
    } finally {
      if (writeRequest.current === controller) {
        writeRequest.current = null;
        setBusy(false);
      }
    }
  }

  async function create(path: string, name: string): Promise<void> {
    if (
      architecturePath === undefined ||
      displayedDocument === undefined ||
      !("source" in displayedDocument)
    )
      return;
    const checked = validateDesignDescriptor(
      { schema: DESIGN_SCHEMA, name, architecture: architecturePath },
      path,
    );
    if (!checked.ok) {
      setWriteError(`Design Format: ${checked.error.code} — ${checked.error.message}`);
      return;
    }
    await write(checked.value, "POST");
  }

  const rendererFailure = useCallback((): void => {
    setRendererFailed(true);
  }, []);

  return {
    paths,
    discoveryError,
    selectedPath,
    select,
    loaded,
    loading,
    busy,
    writeError,
    notice,
    document: displayedDocument,
    architecturePath,
    presentation,
    rendererFailure,
    create,
    canCreate: displayedDocument !== undefined && "source" in displayedDocument,
    save: (descriptor: ValidatedDesignDescriptor) => write(descriptor, "PUT"),
  };
}

export type DesignWorkflow = ReturnType<typeof useDesign>;
