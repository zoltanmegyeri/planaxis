import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { ValidWorkspace } from "./valid-workspace.js";
import { SvgViewport } from "./svg-viewport.js";
import { useDocument } from "./use-document.js";
import { ValidationDetails } from "./validation-details.js";

const STATUS_LABELS = {
  empty: "No document",
  processing: "Processing",
  valid: "Valid",
  invalid: "Invalid",
  failure: "File / processing failure",
};

export function App(): ReactElement {
  const { document, load, rendererFailure } = useDocument();
  const picker = useRef<HTMLInputElement>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [isFocusView, setIsFocusView] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
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

  function loadFiles(files: readonly File[]): Promise<void> {
    setIsFocusView(false);
    return load(files);
  }

  return (
    <div
      className={`application${isDragging ? " dragging" : ""}${isFocusView ? " focus-view" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        void loadFiles(Array.from(event.dataTransfer.files));
      }}
    >
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
          <strong title={document.status !== "empty" ? document.name : undefined}>
            {document.status === "empty" ? "Your floor plan starts here" : document.name}
          </strong>
          <span className={`status ${document.status}`} role="status">
            {STATUS_LABELS[document.status]}
          </span>
        </div>
        <button className="primary" onClick={() => picker.current?.click()}>
          {document.status === "empty" ? "Open SVG" : "Replace SVG"}
        </button>
        <input
          ref={picker}
          className="file-input"
          type="file"
          accept=".svg,image/svg+xml"
          aria-label="Open SVG file"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length > 0) void loadFiles(files);
          }}
        />
      </header>
      {document.status === "empty" ? (
        <section className="empty-state">
          <div className="empty-card">
            <div className="plan-symbol" aria-hidden="true">
              ⌑
            </div>
            <p className="eyebrow">A clearer view of your apartment</p>
            <h2>Drop your floor plan here</h2>
            <p>
              Open one Apartment SVG to validate its structure and explore the original drawing.
            </p>
            <button className="primary" onClick={() => picker.current?.click()}>
              Browse files
            </button>
            <p className="local-note">
              Processed locally in your browser. Your file stays on this device.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="workspace-bar focus-view-hidden" hidden={isFocusView}>
            <span>Local document · Apartment SVG 2.2</span>
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
                  key={document.revision}
                  source={document.source}
                  name={document.name}
                  model={document.architecturalModel}
                  onFailure={rendererFailure}
                  isFocusView={isFocusView}
                />
              ) : source !== undefined ? (
                <SvgViewport
                  key={source}
                  source={source}
                  name={document.name}
                  isFocusView={isFocusView}
                />
              ) : (
                <p className="preview-message">
                  {document.status === "processing"
                    ? "Processing your document…"
                    : "Open an SVG to view its drawing."}
                </p>
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
      {isDragging && <div className="drop-overlay">Drop one SVG to open it</div>}
    </div>
  );
}
