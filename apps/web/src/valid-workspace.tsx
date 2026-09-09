import { useState } from "react";
import type { ReactElement } from "react";
import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import { SvgViewport } from "./svg-viewport.js";
import { ThreeViewport } from "./three-viewport.js";

export function ValidWorkspace({
  source,
  name,
  model,
  onFailure,
  isFocusView,
}: {
  source: string;
  name: string;
  model: ArchitecturalModel3D;
  onFailure: (error: unknown) => void;
  isFocusView: boolean;
}): ReactElement {
  const [view, setView] = useState<"2D" | "3D">("2D");
  return (
    <div className="valid-workspace">
      <div
        className="view-switch focus-view-hidden"
        role="group"
        aria-label="Apartment view"
        hidden={isFocusView}
      >
        {(["2D", "3D"] as const).map((mode) => (
          <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)}>
            {mode}
          </button>
        ))}
      </div>
      {view === "2D" ? (
        <SvgViewport source={source} name={name} isFocusView={isFocusView} />
      ) : (
        <ThreeViewport model={model} onFailure={onFailure} isFocusView={isFocusView} />
      )}
    </div>
  );
}
