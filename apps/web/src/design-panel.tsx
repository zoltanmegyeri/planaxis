import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { ValidatedDesignDescriptor } from "@planaxis/design";
import { designDraft, editDesign } from "./design-editing.js";
import type { DesignWorkflow } from "./use-design.js";

function DesignEditor({
  descriptor,
  busy,
  save,
}: {
  descriptor: ValidatedDesignDescriptor;
  busy: boolean;
  save: DesignWorkflow["save"];
}): ReactElement {
  const [draft, setDraft] = useState(() => designDraft(descriptor));
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(designDraft(descriptor));
    setError("");
  }, [descriptor]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const result = editDesign(descriptor, draft);
        if (!result.ok) {
          setError(`Design Format: ${result.error.code} — ${result.error.message}`);
          return;
        }
        setError("");
        void save(result.value);
      }}
    >
      <fieldset disabled={busy}>
        <legend>Edit selected design</legend>
        <p>
          Saved name: <strong>{descriptor.document.name}</strong>
        </p>
        <label>
          Name{" "}
          <input
            aria-label="Design name"
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          Tone mapping{" "}
          <select
            aria-label="Design tone mapping"
            value={draft.toneMapping}
            onChange={(event) => setDraft({ ...draft, toneMapping: event.target.value })}
          >
            <option value="">PlanAxis default (no override)</option>
            <option value="agx">AgX</option>
            <option value="aces-filmic">ACES Filmic</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>
        <label>
          Exposure (EV){" "}
          <input
            aria-label="Design exposure (EV)"
            type="number"
            step="any"
            placeholder="PlanAxis default"
            value={draft.exposureEv}
            onChange={(event) => setDraft({ ...draft, exposureEv: event.target.value })}
          />
        </label>
        <p>Leave exposure empty to remove its override. Presentation changes apply after saving.</p>
        <p>{descriptor.document.finishes?.length ?? 0} finish assignment(s) preserved.</p>
        <button type="submit">Save design</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export function DesignPanel({
  workflow,
  hidden,
}: {
  workflow: DesignWorkflow;
  hidden: boolean;
}): ReactElement {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const { loaded } = workflow;
  return (
    <section
      className="design-panel focus-view-hidden"
      aria-label="Design scenarios"
      hidden={hidden}
    >
      <label>
        Design scenario{" "}
        <select
          aria-label="Design scenario"
          value={workflow.selectedPath}
          onChange={(event) => workflow.select(event.target.value)}
        >
          <option value="">No design</option>
          {workflow.paths.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </label>
      {workflow.discoveryError && (
        <p role="alert">Design discovery / API: {workflow.discoveryError}</p>
      )}
      {workflow.loading && <p>Loading design scenario…</p>}
      {loaded.problem && <p role="alert">{loaded.problem}</p>}
      {loaded.materialProblem && (
        <p role="alert">
          {loaded.materialProblem} Persistent finishes are unavailable; default appearance is shown.
        </p>
      )}
      {loaded.resolution?.ok && <p>Design resolved: {loaded.descriptor?.document.name}</p>}
      {loaded.resolution && !loaded.resolution.ok && (
        <div role="alert">
          <p>Unresolved / stale design references. Default appearance is shown.</p>
          <ul>
            {loaded.resolution.errors.map((error, index) => (
              <li key={index}>
                {error.code}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {loaded.descriptor && !loaded.resolution && !workflow.loading && (
        <p>
          Design is not applied. Its bound architecture must load and pass Apartment SVG validation.
        </p>
      )}
      <details>
        <summary>Create or edit a design</summary>
        {loaded.descriptor && (
          <DesignEditor
            key={loaded.descriptor.path}
            descriptor={loaded.descriptor}
            busy={workflow.busy}
            save={workflow.save}
          />
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void workflow.create(path, name);
          }}
        >
          <fieldset disabled={workflow.busy || !workflow.canCreate}>
            <legend>Create design</legend>
            <p>Architecture: {workflow.architecturePath ?? "No architecture displayed"}</p>
            <label>
              Descriptor path{" "}
              <input
                aria-label="New design path"
                placeholder="designs/my-design.json"
                required
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
            </label>
            <label>
              Name{" "}
              <input
                aria-label="New design name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button type="submit">Create design</button>
          </fieldset>
        </form>
      </details>
      {workflow.writeError && <p role="alert">{workflow.writeError}</p>}
      {workflow.notice && <p>{workflow.notice}</p>}
    </section>
  );
}
