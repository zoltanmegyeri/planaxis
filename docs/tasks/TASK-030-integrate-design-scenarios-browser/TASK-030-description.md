# TASK-030: Integrate Design Scenarios into the Browser Workflow

## Context

Phase 2 now has both required foundations:

- `@planaxis/design` implements PlanAxis Design Format 1.0 parsing, validation, strict architecture binding, and finish-target resolution;
- the server exposes controlled design discovery/read/create/update APIs plus controlled access to explicitly referenced architecture files.

This final Phase 2 task integrates those capabilities into the React browser application. Persistent finish assignments are meaningful design data but still have no material rendering semantics until Phase 3.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
```

Also read:

```text
docs/specifications/planaxis-design/1.0.md
docs/specifications/planaxis-project/1.0.md
docs/specifications/apartment-svg/2.2.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/decisions/ADR-004-filesystem-backed-projects.md
```

Inspect the public APIs of:

```text
packages/design/
packages/model-3d/
packages/renderer-three/
```

and the current server design API implementation in:

```text
apps/server/src/design-routes.ts
```

Do not browse other task records or task descriptions under `docs/tasks/`.

## Goal

Add a complete Phase 2 browser workflow for discovering, selecting, loading, validating/resolving, creating, editing, and saving PlanAxis Design 1.0 scenarios while preserving the existing Apartment SVG validation and 2D/3D workflow.

A resolved selected design may change the displayed architecture and its tone-mapping/exposure presentation. Persisted finish assignments must be preserved and resolved, but must not alter rendered materials in this phase.

## Scope

The task includes:

- add `@planaxis/design` as a browser workspace dependency;
- add browser API clients for the TASK-029 design and architecture-resource endpoints;
- discover available design descriptor paths;
- maintain selected design as browser/session state only;
- load and validate a selected design descriptor with `@planaxis/design`;
- load and run the existing Apartment SVG pipeline for the design's exact bound architecture;
- derive architectural finish targets and resolve the design with `resolveDesignArchitecture`;
- surface Design Format, architecture-loading/validation, and stale-target failures distinctly;
- render the selected design's bound architecture when that architecture can be processed;
- apply resolved Design 1.0 tone-mapping and exposure overrides through the existing renderer presentation API;
- provide a minimal browser workflow for creating a design and editing/saving supported Version 1.0 fields;
- preserve persisted finish assignments without material interpretation or renderer application;
- update browser tests, Vite development proxying, and implementation-status documentation.

## Browser Workflow

### Startup and selection

- Existing project metadata and active-architecture loading remain the default startup workflow.
- Design discovery MUST NOT automatically select a scenario.
- The initial design selection is therefore `No design` (or equivalent) and the project manifest's active architecture continues to be displayed.
- Available design choices are identified by their project-relative descriptor paths. The human-readable design `name` is available only after a descriptor is loaded and MUST NOT replace path identity.
- Selecting or clearing a design MUST NOT modify `planaxis.project.json` or any design file.

A failure to discover the design list SHOULD be surfaced as a design-specific browser/API failure without making an otherwise usable active-architecture workspace unavailable.

### Loading a selected design

For a selected descriptor path, the browser MUST:

1. fetch the descriptor through `GET /api/project/design?path=...`;
2. parse/validate it with `parseDesignDescriptor`;
3. fetch the descriptor's exact `architecture` path through `GET /api/project/architecture-resource?path=...`;
4. run the existing Apartment SVG parse/validation/model pipeline on those bytes;
5. derive finish targets from the resulting `ArchitecturalModel3D`;
6. call `resolveDesignArchitecture` using the exact bound architecture path and derived target set.

Do not use the project manifest's active architecture as a substitute for the descriptor's bound architecture.

Selecting `No design` MUST restore the normal active-architecture workflow.

### Failure and diagnostic behavior

Keep these failure domains distinct:

```text
project/API transport
Design 1.0 format validation
Apartment SVG validation
Design architecture/finish-target resolution
renderer/application failure
```

Requirements:

- malformed or unsupported design JSON MUST be reported as a Design Format problem;
- an inaccessible bound architecture MUST be reported as a project/API resource problem;
- an invalid bound Apartment SVG MUST use the existing Apartment SVG diagnostic workflow;
- syntactically valid but missing finish targets MUST be reported as unresolved/stale design references;
- stale targets MUST NOT be silently dropped, repaired, renamed, or redirected to fallback targets;
- a structurally valid but unresolved design MUST NOT be treated as an applied/resolved scenario;
- when practical, the bound architecture may still be displayed with neutral/default design appearance so its Apartment SVG state can be inspected;
- diagnostic messages shown to users MUST NOT expose physical filesystem paths or raw unsafe server error bodies.

## Design Editing and Persistence

Provide a small, functional editing surface rather than a broad design-management UI.

### Create

The browser MUST allow creation of a new scenario with at least:

- a user-supplied descriptor path under `designs/` ending in lowercase `.json`;
- a required human-readable `name`.

A new design MUST bind to the architecture currently displayed in the browser:

- the manifest active architecture when no design is selected;
- the selected design's bound architecture when a design is selected.

Creation MUST initially persist only the required Design 1.0 fields unless the user explicitly edits optional presentation state.

Use the server `POST /api/project/design?path=...` endpoint.

After successful creation, refresh design discovery and select the created design.

### Edit and save

For a structurally valid loaded design, the browser MUST support editing and saving at least:

- `name`;
- optional `presentation.toneMapping`;
- optional `presentation.exposureEv`.

The UI MUST support absence as distinct from an explicit value:

- either presentation property can be removed independently;
- if both are absent, the persisted `presentation` object MUST be omitted rather than saved as `{}`.

Saving MUST:

- use `PUT /api/project/design?path=...`;
- preserve the descriptor path identity;
- preserve the exact `architecture` binding;
- preserve all existing `finishes` assignments unchanged;
- never invent material semantics or rewrite material references.

Editing the `architecture` binding, finish assignments, descriptor path, or material references is not part of this task.

## Presentation Semantics

A resolved selected design may persist:

```text
toneMapping
exposureEv
```

Map Design Format values to the existing renderer vocabulary explicitly:

```text
agx          -> AgX
aces-filmic  -> ACES Filmic
neutral      -> Neutral
```

Requirements:

- omitted design tone mapping uses the current PlanAxis default tone mapping;
- omitted design exposure uses the current PlanAxis default exposure;
- persisted values outside the current browser slider range MUST remain valid and MUST NOT be silently clamped, rewritten, or rejected by Design Format handling;
- environment intensity and environment rotation remain transient browser/renderer state and MUST NOT be persisted into the design;
- selecting a resolved design applies its effective tone mapping and exposure;
- finish assignments MUST NOT be converted to `RuntimePbrMaterial` or change surface appearance;
- a renderer limitation when applying an otherwise valid finite exposure is an application/renderer failure, not a Design Format validation failure.

The existing runtime presentation controls may be adapted or lifted as needed so editing and saved design state remain coherent.

## Functional Requirements

- Use `@planaxis/design` as the source of Design 1.0 parsing/validation/resolution semantics; do not duplicate its format validator in the browser.
- Reuse the existing Apartment SVG `processDocument` pipeline for design-bound architectures.
- Use `deriveArchitecturalSurfaces(model).finishTargets` (or the established equivalent) for architecture resolution.
- Design selection MUST be session state only. Reloading the application starts with no selected design.
- No browser local-storage persistence of selected design is permitted.
- A selected design bound to a non-active architectural alternative MUST display that exact alternative after successful loading.
- Existing no-design behavior, Apartment SVG diagnostics, 2D view, 3D view, camera modes, Focus view, and renderer lifecycle MUST remain functional.
- Asynchronous selection changes MUST not allow stale responses from an earlier request to overwrite a newer selection.
- Save/create failures MUST leave the last successfully loaded durable design state intact and show a controlled error.

## Technical and Architectural Constraints

React/browser concerns remain in `apps/web`.

The browser MAY depend on:

```text
@planaxis/design
@planaxis/model-3d
@planaxis/renderer-three
```

according to their public APIs.

Do not add filesystem access, Node-specific APIs, or server implementation imports to the browser.

Do not move Design Format semantics into React components.

Prefer small browser-side adapters/state modules for:

- design HTTP transport;
- design loading/resolution orchestration;
- Design-to-renderer presentation mapping.

Do not make `ArchitecturalModel3D` contain design assignments or presentation state.

## Out of Scope

The task explicitly does **not** include:

- material resource loading or existence checks;
- PBR material persistence or application;
- finish-assignment editing UI;
- environment persistence;
- object/furniture placement;
- lighting design;
- design duplicate, delete, rename/move, or architecture-rebind workflows;
- persistent active-design state;
- browser local storage for design selection;
- changes to PlanAxis Design Format 1.0, Project Format 1.0, or Apartment SVG 2.2;
- server API redesign unless a concrete correctness defect in TASK-029 prevents this task from using the documented contract.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/web/
README.md
docs/architecture/overview.md
pnpm-lock.yaml
```

A server change is not expected.

Do not modify any file under:

```text
docs/tasks/
```

Do not modify normative specifications as a side effect of implementation. If the implementation reveals a real specification conflict, report it instead.

## Dependencies

Expected dependency change:

```text
@planaxis/web -> @planaxis/design (workspace:*)
```

No new third-party dependency is expected.

Follow repository dependency rules for manifest and lockfile changes.

## Testing Requirements

Add focused deterministic browser tests covering at least:

- design discovery with no automatic selection;
- discovery failure not unnecessarily destroying the usable active-architecture workspace;
- selecting a valid design descriptor;
- loading a design bound to the active architecture;
- loading a design bound to a different project architecture;
- malformed/unsupported design descriptor diagnostics;
- bound-architecture API failure;
- invalid bound Apartment SVG using existing SVG diagnostics;
- exact architecture binding and successful finish-target resolution;
- stale target diagnostics without silent repair or material application;
- clearing the selection back to the manifest active architecture;
- stale asynchronous selection responses not overwriting a later selection;
- creation using the currently displayed architecture and subsequent list refresh/selection;
- create/save API failures preserving last durable loaded state;
- editing and saving `name`;
- adding, changing, and removing each optional presentation override;
- omitting `presentation` when both overrides are absent;
- preserving `architecture` and `finishes` semantic values across browser saves;
- mapping all three Design Format tone-mapping values to renderer values;
- omitted tone/exposure using PlanAxis defaults;
- a persisted finite exposure outside the current UI range not being silently clamped or rewritten;
- environment intensity/rotation remaining non-persistent;
- selected design finishes causing no runtime material assignment in Phase 2;
- Vite development proxy coverage for the new `/api/project/...` endpoints used by the browser.

Prefer testing orchestration and presentation mapping separately from GPU-backed rendering where practical.

## Documentation Requirements

This task completes Phase 2, so update implementation-status documentation accordingly.

At minimum, review and update:

```text
README.md
docs/architecture/overview.md
```

The documentation should state that Design Format 1.0, shared validation/resolution, server persistence APIs, and browser scenario workflow are implemented, while persistent material semantics/rendering remain Phase 3 work.

Update other non-task documentation only if the completed browser workflow makes it materially inaccurate.

## Verification

Run:

```bash
pnpm --filter @planaxis/web test
pnpm --filter @planaxis/web typecheck
pnpm --filter @planaxis/web build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. the browser discovers design descriptors without auto-selecting one;
2. users can select a Design 1.0 scenario and the browser loads its exact bound architecture;
3. Design Format validation, Apartment SVG validation, and finish-target resolution remain distinct and produce useful diagnostics;
4. valid finish assignments are preserved/resolved but do not alter rendered materials;
5. resolved tone-mapping and exposure overrides are applied with correct default/optional semantics;
6. users can create a design and edit/save its name and optional presentation overrides without changing path identity, architecture binding, or finish assignments;
7. selected design state remains session-only and clearing selection restores the manifest active architecture;
8. existing 2D/3D browser behavior remains functional;
9. focused tests cover selection, validation/resolution, persistence, presentation mapping, error handling, and asynchronous state safety;
10. Phase 2 implementation-status documentation is current;
11. required repository verification passes;
12. no out-of-scope Phase 3 material behavior or later lifecycle functionality is introduced.

## Final Response

When finished, provide a concise execution report containing:

1. implementation summary;
2. main files or areas changed;
3. tests added or updated;
4. verification commands actually run and their results;
5. dependency changes, including any intentional version exceptions;
6. deviations from this task description, or `None`;
7. follow-up work identified during execution, or `None`;
8. a suggested Conventional Commits message that includes:

```text
Task: TASK-030
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
