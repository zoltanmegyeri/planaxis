import { useEffect, useRef, useState } from "react";
import { processDocument } from "./process-document.js";
import type { DocumentResult } from "./process-document.js";

export type DocumentState =
  | { status: "empty" }
  | { status: "processing"; name: string }
  | { status: "failure"; name: string; message: string; source?: string }
  | (DocumentResult & { name: string; source: string });

export function useDocument(): {
  document: DocumentState;
  load: (files: readonly File[]) => Promise<void>;
} {
  const [document, setDocument] = useState<DocumentState>({ status: "empty" });
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  async function load(files: readonly File[]): Promise<void> {
    const request = ++generation.current;
    const file = files[0];
    if (files.length !== 1 || file === undefined) {
      setDocument({
        status: "failure",
        name: "No document",
        message: "Open exactly one SVG file at a time.",
      });
      return;
    }
    setDocument({ status: "processing", name: file.name });
    let source: string;
    try {
      source = await file.text();
    } catch (error: unknown) {
      if (request === generation.current)
        setDocument({
          status: "failure",
          name: file.name,
          message: `File read failure: ${describeError(error)}`,
        });
      return;
    }
    if (request !== generation.current) return;
    try {
      setDocument({ ...processDocument(source), source, name: file.name });
    } catch (error: unknown) {
      setDocument({
        status: "failure",
        name: file.name,
        source,
        message: `Unexpected processing failure: ${describeError(error)}`,
      });
    }
  }
  return { document, load };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
