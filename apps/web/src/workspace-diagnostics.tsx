import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { DocumentState } from "./use-document.js";
import type { DesignWorkflow } from "./use-design.js";
import { ValidationDetails } from "./validation-details.js";

export function workspaceProblems(document: DocumentState, design: DesignWorkflow): string[] {
  const problems: string[] = [];
  if (document.status === "invalid")
    problems.push(`Apartment SVG: ${document.stage} validation failed`);
  if (document.status === "failure" || document.status === "project-failure")
    problems.push(document.message);
  if (design.discoveryError) problems.push(`Design discovery / API: ${design.discoveryError}`);
  if (design.loaded.problem) problems.push(design.loaded.problem);
  if (design.loaded.materialProblem) problems.push(design.loaded.materialProblem);
  if (design.loaded.resolution && !design.loaded.resolution.ok)
    problems.push("Unresolved / stale design references. Default appearance is shown.");
  if (design.writeError) problems.push(design.writeError);
  return problems;
}

export function WorkspaceDiagnostics({
  document,
  design,
}: {
  document: DocumentState;
  design: DesignWorkflow;
}): ReactElement {
  const { loaded } = design;
  return (
    <>
      <ValidationDetails document={document} />
      {loaded.resolution?.ok && <p>Design resolved: {loaded.descriptor?.document.name}</p>}
      {workspaceProblems(document, design)
        .slice(
          document.status === "invalid" ||
            document.status === "failure" ||
            document.status === "project-failure"
            ? 1
            : 0,
        )
        .map((problem) => (
          <p key={problem}>{problem}</p>
        ))}
      {loaded.materialProblem && (
        <p>Persistent finishes are unavailable; default appearance is shown.</p>
      )}
      {loaded.resolution && !loaded.resolution.ok && (
        <ul>
          {loaded.resolution.errors.map((error, index) => (
            <li key={index}>
              {error.code}: {error.message}
            </li>
          ))}
        </ul>
      )}
      {loaded.descriptor && !loaded.resolution && !design.loading && (
        <p>
          Design is not applied. Its bound architecture must load and pass Apartment SVG validation.
        </p>
      )}
    </>
  );
}

export function ProblemToast({
  signature,
  summary,
  onDetails,
}: {
  signature: string;
  summary: string;
  onDetails: () => void;
}): ReactElement | null {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(signature !== "");
    const timer = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(timer);
  }, [signature]);
  if (!visible || !signature) return null;
  return (
    <div className="problem-toast" role="status">
      <p>{summary}</p>
      <button
        onClick={() => {
          setVisible(false);
          onDetails();
        }}
      >
        View details
      </button>
      <button aria-label="Dismiss notification" onClick={() => setVisible(false)}>
        ×
      </button>
    </div>
  );
}
