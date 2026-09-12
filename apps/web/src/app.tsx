import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { ValidWorkspace } from "./valid-workspace.js";
import { SvgViewport } from "./svg-viewport.js";
import { useDocument } from "./use-document.js";
import { ValidationDetails } from "./validation-details.js";

const STATUS_LABELS = {
  loading: "Loading project",
  "project-failure": "Project / API failure",
  processing: "Processing",
  valid: "Valid",
  invalid: "Invalid",
  failure: "Processing failure",
};

export function App(): ReactElement {
  const { document, rendererFailure } = useDocument();
  const project = "project" in document ? document.project : undefined;
  const [showDetails, setShowDetails] = useState(true);
  const [isFocusView, setIsFocusView] = useState(false);
  const source = "source" in document ? document.source : undefined;

  useEffect(() => {
    if (!isFocusView) return;
    const exitOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsFocusView(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [isFocusView]);

  return (
    <div className={`application${isFocusView ? " focus-view" : ""}`}>
      <header className="app-header focus-view-hidden" hidden={isFocusView}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div>
            <h1>PlanAxis</h1>
            <span>Apartment workspace</span>
          </div>
        </div>
        <div className="document-heading">
          <strong title={project?.name}>{project?.name ?? "Server-selected project"}</strong>
          <span className={`status ${document.status}`} role="status">
            {document.status === "failure" && document.kind === "renderer"
              ? "Renderer failure"
              : STATUS_LABELS[document.status]}
          </span>
        </div>
      </header>
      {document.status === "loading" || document.status === "project-failure" ? (
        <section className="empty-state">
          <div className="empty-card">
            <h2>
              {document.status === "loading" ? "Loading your project…" : "Project unavailable"}
            </h2>
            <p role={document.status === "project-failure" ? "alert" : undefined}>
              {document.status === "project-failure"
                ? document.message
                : "Connecting to the project selected by the PlanAxis server."}
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="workspace-bar focus-view-hidden" hidden={isFocusView}>
            <span className="architecture-path" title={document.project.architecture.active}>
              {document.project.architecture.active} · Apartment SVG 2.2
            </span>
            <div className="workspace-actions">
              <button
                aria-expanded={showDetails}
                aria-controls="validation-details"
                onClick={() => setShowDetails((value) => !value)}
              >
                {showDetails ? "Hide" : "Show"} validation details
              </button>
              {source !== undefined && (
                <button aria-label="Enter Focus view" onClick={() => setIsFocusView(true)}>
                  Focus view
                </button>
              )}
            </div>
          </div>
          <div className={`workspace${showDetails ? " with-details" : ""}`}>
            <div className="preview-area">
              {document.status === "valid" ? (
                <ValidWorkspace
                  source={document.source}
                  name={document.project.architecture.active}
                  model={document.architecturalModel}
                  onFailure={rendererFailure}
                  isFocusView={isFocusView}
                />
              ) : source !== undefined ? (
                <SvgViewport
                  key={source}
                  source={source}
                  name={document.project.architecture.active}
                  isFocusView={isFocusView}
                />
              ) : (
                <p className="preview-message">Loading and processing active architecture…</p>
              )}
              {isFocusView && (
                <button
                  className="focus-view-close"
                  aria-label="Exit Focus view"
                  title="Exit Focus view"
                  onClick={() => setIsFocusView(false)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
            {showDetails && (
              <aside
                id="validation-details"
                className="focus-view-hidden"
                aria-label="Validation details"
                hidden={isFocusView}
              >
                <p className="eyebrow">Validation details</p>
                <ValidationDetails document={document} />
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
