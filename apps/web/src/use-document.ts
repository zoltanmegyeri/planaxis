import { useCallback, useEffect, useState } from "react";
import { processDocument } from "./process-document.js";
import type { DocumentResult } from "./process-document.js";
import { fetchActiveArchitecture, fetchProjectMetadata, ProjectLoadError } from "./project-api.js";
import type { ProjectMetadata } from "./project-api.js";

export type DocumentState =
  | { status: "loading" }
  | { status: "project-failure"; message: string }
  | { status: "processing"; project: ProjectMetadata }
  | {
      status: "failure";
      kind: "processing" | "renderer";
      project: ProjectMetadata;
      message: string;
      source: string;
    }
  | (DocumentResult & { project: ProjectMetadata; source: string });

export function useDocument(): {
  document: DocumentState;
  rendererFailure: (error: unknown) => void;
} {
  const [document, setDocument] = useState<DocumentState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function load(): Promise<void> {
      let project: ProjectMetadata;
      let source: string;
      let stage = "project metadata";
      try {
        project = await fetchProjectMetadata(signal);
        if (signal.aborted) return;
        setDocument({ status: "processing", project });
        stage = "active architecture";
        source = await fetchActiveArchitecture(signal);
      } catch (error: unknown) {
        // Raw response bodies and transport exceptions can contain physical filesystem paths.
        if (!signal.aborted)
          setDocument({
            status: "project-failure",
            message:
              error instanceof ProjectLoadError
                ? error.message
                : `Unable to load ${stage}. Check that the PlanAxis server is running, then reload this page.`,
          });
        return;
      }
      if (signal.aborted) return;
      try {
        setDocument({ ...processDocument(source), source, project });
      } catch (error: unknown) {
        setDocument({
          status: "failure",
          kind: "processing",
          project,
          source,
          message: `Unexpected processing failure: ${describeError(error)}`,
        });
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const rendererFailure = useCallback((error: unknown): void => {
    setDocument((current) =>
      current.status === "valid"
        ? {
            status: "failure",
            kind: "renderer",
            project: current.project,
            source: current.source,
            message: `Unexpected renderer failure: ${describeError(error)}`,
          }
        : current,
    );
  }, []);
  return { document, rendererFailure };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
