import { DEFAULT_WEATHER } from "@planaxis/simulation";
import type { LightingMode, PhysicalSimulation } from "@planaxis/simulation";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { DesignPanel } from "./design-panel.js";
import { useDesign } from "./use-design.js";
import { SvgViewport } from "./svg-viewport.js";
import { ThreeViewport } from "./three-viewport.js";
import { useDocument } from "./use-document.js";
import { isWorkspaceShortcut, NavigationHelp, TransientPanel } from "./transient-panel.js";
import type { WorkspacePanel } from "./transient-panel.js";
import { ProblemToast, workspaceProblems, WorkspaceDiagnostics } from "./workspace-diagnostics.js";

const STATUS_LABELS = {
  loading: "Loading project",
  "project-failure": "Project / API failure",
  processing: "Processing",
  valid: "Ready",
  invalid: "Invalid",
  failure: "Processing failure",
};

export function App(): ReactElement {
  const [sessionInstant] = useState(() => Date.now());
  const [simulation, setSimulation] = useState<PhysicalSimulation>(() => ({
    instant: sessionInstant,
    weather: DEFAULT_WEATHER,
  }));
  const [lightingMode, setLightingMode] = useState<LightingMode>("studio");
  const active = useDocument();
  const design = useDesign(active.document);
  const project = "project" in active.document ? active.document.project : undefined;
  const current =
    design.document ??
    (project === undefined ? active.document : { status: "processing" as const, project });
  const rendererFailure = design.selectedPath ? design.rendererFailure : active.rendererFailure;
  const architecturePath = design.architecturePath ?? "No architecture loaded";
  const [panel, setPanel] = useState<WorkspacePanel>(null);
  const [view, setView] = useState<"2D" | "3D">("2D");
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const source = "source" in current ? current.source : undefined;
  const problems = workspaceProblems(current, design);
  const signature = problems.length
    ? JSON.stringify([design.selectedPath, problems, current.status === "invalid" ? current : null])
    : "";
  const is3D = current.status === "valid" && view === "3D";
  const close = (): void => setPanel(null);
  const toggle = (next: WorkspacePanel): void =>
    setPanel((previous) => (previous === next ? null : next));
  useEffect(() => {
    setView("2D");
  }, [design.selectedPath]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent): void => {
      if (!isWorkspaceShortcut(event) || current.status !== "valid") return;
      if (event.key === "2" || event.key === "3") {
        event.preventDefault();
        setView(event.key === "2" ? "2D" : "3D");
        setPanel(null);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [current.status]);
  useEffect(() => {
    if (panel !== "overflow") return;
    const trigger = document.activeElement;
    const overflow = document.getElementById("workspace-overflow");
    overflow?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      event.preventDefault();
      setPanel(null);
      if (trigger instanceof HTMLElement) trigger.focus();
    };
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Element && !event.target.closest(".primary-toolbar"))
        setPanel(null);
    };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", outside);
    };
  }, [panel]);
  const status =
    current.status === "failure" && current.kind === "renderer"
      ? "Renderer failure"
      : problems.length && current.status === "valid"
        ? "Warning"
        : design.selectedPath && !design.loading && !design.document
          ? "Design unavailable"
          : STATUS_LABELS[current.status];
  return (
    <div className="application">
      <header className="primary-toolbar" aria-label="Workspace toolbar">
        <strong className="project-identity" title={project?.name}>
          PlanAxis <span>{project?.name}</span>
        </strong>
        {project && (
          <div className="design-controls">
            <label>
              <span className="control-label">Design </span>
              <select
                aria-label="Design scenario"
                value={design.selectedPath}
                onChange={(event) => design.select(event.target.value)}
              >
                <option value="">No design</option>
                {design.paths.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Create or edit a design"
              title="Create or edit a design"
              aria-expanded={panel === "design"}
              aria-controls="design-panel"
              onClick={() => toggle("design")}
            >
              ✎
            </button>
          </div>
        )}
        {current.status === "valid" && (
          <div className="view-switch" role="group" aria-label="Apartment view">
            {(["2D", "3D"] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={view === mode}
                onClick={() => {
                  setView(mode);
                  close();
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
        <div ref={setToolbar} className="three-toolbar-slot" />
        <button
          className={`overflow-toggle${problems.length ? " has-problem" : ""}`}
          title={
            problems.length
              ? "More workspace controls — problems need attention"
              : "More workspace controls"
          }
          aria-label="More workspace controls"
          aria-expanded={panel === "overflow"}
          aria-controls="workspace-overflow"
          onClick={() => toggle("overflow")}
        >
          ⋯
        </button>
        <div
          id="workspace-overflow"
          className={`secondary-actions${panel === "overflow" ? " is-open" : ""}`}
        >
          <button
            className={`status ${problems.length ? "warning" : current.status}`}
            aria-label="Diagnostics status"
            aria-expanded={panel === "diagnostics"}
            aria-controls="diagnostics-panel"
            onClick={() => toggle("diagnostics")}
          >
            <span role="status">{status}</span>
          </button>
          <button
            aria-label="Information and help"
            title="Information and help"
            aria-expanded={panel === "help"}
            aria-controls="help-panel"
            onClick={() => toggle("help")}
          >
            ⓘ
          </button>
          <button
            aria-label="Project information"
            aria-expanded={panel === "information"}
            aria-controls="information-panel"
            onClick={() => toggle("information")}
          >
            Project
          </button>
        </div>
      </header>
      <main className="workspace">
        {current.status === "loading" || current.status === "project-failure" ? (
          <section className="empty-state">
            <div className="empty-card">
              <h2>
                {current.status === "loading" ? "Loading your project…" : "Project unavailable"}
              </h2>
              <p role={current.status === "project-failure" ? "alert" : undefined}>
                {current.status === "project-failure"
                  ? current.message
                  : "Connecting to the project selected by the PlanAxis server."}
              </p>
            </div>
          </section>
        ) : is3D && current.status === "valid" ? (
          <ThreeViewport
            key={design.selectedPath}
            model={current.architecturalModel}
            simulation={simulation}
            sessionInstant={sessionInstant}
            onSimulationChange={setSimulation}
            selectedLightingMode={lightingMode}
            onLightingModeChange={setLightingMode}
            onFailure={rendererFailure}
            scenarioPresentation={design.presentation}
            materials={design.loaded.materialProblem ? undefined : design.loaded.materials}
            onMaterialFailure={design.materialFailure}
            toolbar={toolbar}
            panel={panel}
            onTogglePanel={toggle}
            onClosePanel={close}
          />
        ) : source !== undefined ? (
          <SvgViewport key={source} source={source} name={architecturePath} />
        ) : (
          <p className="preview-message">
            {design.loading
              ? "Loading design architecture…"
              : design.selectedPath
                ? "No architecture available for this selection."
                : "Loading and processing active architecture…"}
          </p>
        )}
        {project && (
          <TransientPanel
            id="design-panel"
            title="Create or edit a design"
            open={panel === "design"}
            onClose={close}
          >
            <DesignPanel workflow={design} />
          </TransientPanel>
        )}
        <TransientPanel
          id="diagnostics-panel"
          title="Diagnostics"
          open={panel === "diagnostics"}
          onClose={close}
          drawer
        >
          <WorkspaceDiagnostics document={current} design={design} />
        </TransientPanel>
        <TransientPanel
          id="information-panel"
          title="Project information"
          open={panel === "information"}
          onClose={close}
        >
          <p>{project?.name ?? "Server-selected project"}</p>
          <p className="architecture-path">{architecturePath} · Apartment SVG 2.2</p>
        </TransientPanel>
        {!is3D && (
          <TransientPanel
            id="help-panel"
            title="Information and help"
            open={panel === "help"}
            onClose={close}
          >
            <NavigationHelp mode="2D" />
          </TransientPanel>
        )}
        {source !== undefined && (
          <ProblemToast
            signature={signature}
            summary={problems[0] ?? ""}
            onDetails={() => setPanel("diagnostics")}
          />
        )}
        {source === undefined && problems.length > 0 && current.status !== "project-failure" && (
          <div className="empty-card">
            <WorkspaceDiagnostics document={current} design={design} />
          </div>
        )}
      </main>
    </div>
  );
}
