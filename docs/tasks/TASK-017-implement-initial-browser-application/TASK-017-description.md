# TASK-017: Implement the Initial Browser Application and 2D SVG Workflow

## Context

TASK-016 completed the deterministic Apartment SVG 2.2 pipeline through renderer-independent `ArchitecturalModel3D`. The next project stage is to make PlanAxis directly usable through its browser application.

`apps/web` currently contains only the initial Vite placeholder. PlanAxis needs a real full-window UI where a user can load an Apartment SVG, run the existing shared validation pipeline locally, inspect validation results, and view the original SVG as a read-only 2D floor plan.

This task establishes that first usable browser workflow. Three.js and 3D visualization remain the next stage.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Replace the placeholder `@planaxis/web` application with the first user-facing PlanAxis browser experience.

A user must be able to open or drag-and-drop one Apartment SVG, have it immediately parsed and validated entirely in the browser, clearly inspect the result, and view the original SVG in a safe read-only pan/zoom 2D viewport.

## Scope

The task includes:

- adopting React as the browser UI framework while retaining Vite;
- documenting that architectural choice in `docs/decisions/ADR-002-react-browser-ui.md`;
- implementing a full-viewport, desktop-first responsive application shell;
- loading one SVG through a file picker or drag-and-drop;
- processing the file entirely in the browser through the existing PlanAxis parser and validator stages;
- constructing and retaining `ValidatedApartment2D` after successful validation;
- presenting clear validation state and structured diagnostics;
- rendering the uploaded SVG as a safe read-only vector image;
- providing basic fit, pan, and zoom interaction for the 2D floor-plan viewport;
- handling document replacement and browser resource cleanup;
- adding focused browser-application tests;
- adding a convenient root-level command for starting the web application in development;
- updating current-state architecture and README documentation.

## Functional Requirements

### React application baseline

Use React and React DOM for the browser UI in `apps/web`.

Use the newest stable, non-deprecated mutually compatible versions available at task execution time, following the repository dependency-selection rules. Use the standard Vite React integration and update TypeScript/Vite configuration as required.

Keep the UI stack deliberately small. Do not introduce a router, global state-management framework, UI component library, CSS framework, or React-specific Three.js abstraction in this task.

Create:

```text
docs/decisions/ADR-002-react-browser-ui.md
```

documenting the adoption of React for PlanAxis browser UI, including the motivation, relevant alternatives, architectural boundary, and consequences. React must remain an application-layer concern and must not leak into shared domain packages.

### Application shell

The application must fill the browser viewport and be designed primarily for desktop use while remaining reasonably usable on mobile-sized screens.

Provide:

- a clear PlanAxis application identity;
- an initial empty state that prominently supports drag-and-drop and a Browse/Open action;
- a loaded-document state showing the current file name and validation status;
- an obvious way to replace the current document;
- a validation-details area that can be collapsed or otherwise moved out of the way so the floor plan can use most of the viewport;
- responsive behavior appropriate for narrow screens without requiring a separate mobile application.

Exact visual styling and pixel dimensions are not prescribed. Prefer a clean application/tool layout over a conventional scrolling web page.

Core controls must be keyboard accessible and validation state must not be communicated by color alone.

### File loading

Accept exactly one file at a time through:

```text
file picker
drag-and-drop
```

The file picker should hint that SVG files are expected, but file extension and MIME type must not be treated as proof of Apartment SVG validity.

A newly loaded file replaces the previous document.

The application must read and process the file locally. Do not upload it, call the PlanAxis server, or require network access for parsing or validation.

Handle file-read failures and unsupported multi-file drops as clear application-level failures rather than unhandled exceptions.

### Browser validation pipeline

Reuse the existing shared PlanAxis APIs and preserve the established stage boundaries.

Process source text in this order:

```text
parseApartmentSvg
    ↓
validateApartmentSvgSchema
    ↓
validateApartmentSvgReferences
    ↓
validateApartmentSvgGeometry
    ↓
buildValidatedApartment2D
```

Do not duplicate or reinterpret Apartment SVG rules in `apps/web`.

A document is valid only after every validation stage succeeds. On success, retain the resulting `ValidatedApartment2D` in application state or an equivalent application-owned representation so later work can build on the trusted result.

Do not construct `ArchitecturalModel3D` in this task.

When a stage fails, present the diagnostics returned by that stage. Do not continue into validation stages whose trusted input contract has not been established.

Unexpected programming failures must be distinguished from ordinary invalid Apartment SVG input.

### Validation presentation

Validation status must remain clearly visible after a document is loaded.

At minimum distinguish:

```text
processing
valid
invalid
file / processing failure
```

For parser failures, show the parser error kind, message, and source location when available.

For schema, reference, and geometry failures, make the structured validation errors easy to inspect. Show the stable error code and message plus useful available context such as element ID, attribute, path, rule, actual value, and expected condition.

The detailed panel may use appropriate responsive/collapsible presentation, but users must be able to reach the complete diagnostics easily.

Loading a replacement document must not leave stale validation errors or trusted model data from the previous file.

### Safe read-only SVG preview

Display the uploaded source as the original SVG artwork even when it is not a valid Apartment SVG, provided the browser can render it as an image.

Render it in a safe image context using an object/blob URL and an `<img>` or an equivalently restricted image mechanism. Preserve vector SVG rendering.

Do not inject uploaded SVG markup into the application DOM. In particular, do not use:

```text
innerHTML
dangerouslySetInnerHTML
<object>
<iframe>
```

to display untrusted uploaded source.

Semantic parsing and validation must operate on the source text through the PlanAxis parser/validator pipeline; visual appearance must not become semantic input.

If the browser cannot render the SVG preview, show a clear preview-unavailable state without hiding the validation result.

Manage object/blob URL lifecycle correctly. Revoke superseded URLs when replacing a document and release the active URL when the relevant UI is disposed.

### 2D viewport interaction

The SVG preview must provide basic read-only navigation:

- fit the whole drawing to the available viewport;
- zoom in and out;
- pan the drawing;
- provide an explicit Fit/Reset action;
- support normal mouse/trackpad interaction on desktop;
- support practical touch pan/zoom interaction on mobile-sized devices.

Automatically fit a newly loaded renderable SVG once its intrinsic dimensions are available.

Keep the implementation focused on viewing. Do not add editing, measurement, rulers, selection, semantic overlays, or element highlighting.

A third-party pan/zoom dependency is not expected; use browser/React capabilities unless a concrete necessity is identified and justified under the repository dependency rules.

### Development entry point

Add a convenient root-level development command:

```bash
pnpm dev:web
```

that starts the PlanAxis browser application.

Document this command in the README.

This task does not require production hosting or integration with the Fastify server.

## Technical and Architectural Constraints

- Keep browser UI code in `apps/web`.
- Reuse `@planaxis/parser`, `@planaxis/validator`, and `@planaxis/model` through their public APIs.
- Preserve exact-decimal authoritative geometry inside the shared pipeline.
- Keep React, DOM, File API, drag/drop, and other browser-specific concerns out of shared core packages.
- Do not alter Apartment SVG 2.2 semantics.
- Do not weaken validation to make UI input succeed.
- Do not add Three.js or any renderer-specific dependency.
- Keep application state explicit and avoid speculative abstractions.
- Select all added dependency versions from current registry metadata according to `AGENTS.md` and `docs/development/coding-guidelines.md`.
- Do not modify any file under `docs/tasks/`.

## Out of Scope

This task does **not** include:

- Three.js or another 3D renderer;
- `ArchitecturalModel3D` construction or consumption;
- a 2D/3D view switch;
- predefined-camera viewing;
- free-walk/FPS navigation;
- materials, textures, lighting, shadows, sunlight, or runtime light controls;
- SVG editing;
- semantic element selection or highlighting;
- clicking a validation error to highlight its SVG element;
- project persistence, autosave, or file versioning;
- server upload or server-side validation;
- authentication or collaboration;
- AI-assisted rendering or redesign;
- production deployment/hosting;
- a general-purpose design system;
- end-to-end browser automation infrastructure unless an existing repository requirement makes it necessary.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/web/
package.json
pnpm-lock.yaml
README.md
AGENTS.md
docs/architecture/overview.md
docs/decisions/ADR-002-react-browser-ui.md
```

Other files may change only when required for workspace wiring, tests, linting, or TypeScript/Vite integration.

## Testing Requirements

Add focused automated tests for the new web workflow using Vitest and a minimal DOM-capable test setup as needed.

Cover at least:

- initial empty application state;
- valid Apartment SVG processing through all required stages;
- successful construction/retention of `ValidatedApartment2D`;
- parser failure presentation;
- schema, reference, and geometry failure presentation;
- file-read or application-level failure handling where practical;
- drag-and-drop and file-picker processing behavior at an appropriate component/application boundary;
- replacement of a loaded document without stale validation/model state;
- renderable invalid Apartment SVG remaining available in the 2D preview;
- safe preview resource lifecycle, including replacement cleanup;
- fit/zoom/pan state behavior;
- validation status being exposed with text rather than color alone.

Tests must not require network access, a running Fastify server, Three.js, or WebGL.

Do not introduce Playwright or another end-to-end browser framework solely for this task unless a concrete existing repository requirement makes it necessary.

Follow `docs/development/testing.md` and do not weaken existing coverage.

## Documentation Requirements

Create ADR-002 for the React browser-UI decision.

Update current-state wording in:

```text
README.md
AGENTS.md
docs/architecture/overview.md
```

so the repository describes:

- React as the browser UI framework;
- the browser application as the first official user-facing PlanAxis entry point;
- local Apartment SVG loading and validation;
- the read-only 2D SVG viewer;
- `pnpm dev:web`;
- Three.js renderer adaptation and 3D visualization as the next development stage.

Do not rewrite ADR-001 retroactively and do not modify the normative Apartment SVG 2.2 specification.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused `@planaxis/web` tests during development as useful.

Verify that:

```bash
pnpm dev:web
```

successfully starts the Vite browser application. Do not leave a development server running after verification.

If dependency manifests or the lockfile change, perform the dependency verification required by repository policy, including current registry checks and frozen-lockfile installation verification.

## Acceptance Criteria

The task is complete when:

1. `pnpm dev:web` starts a full-viewport React PlanAxis application;
2. one SVG can be loaded through Browse/Open or drag-and-drop and replaced with another;
3. the file is parsed and validated locally through the existing PlanAxis stage APIs with no server dependency;
4. valid input produces and retains `ValidatedApartment2D`;
5. validation state is obvious and complete parser/validation diagnostics are easily accessible;
6. the original SVG is displayed safely as a read-only vector image without injecting uploaded markup into the application DOM;
7. the 2D viewport supports fit, pan, and zoom on desktop and practical touch interaction on mobile-sized screens;
8. invalid Apartment SVG documents remain previewable when the browser can render their SVG source;
9. React adoption is documented in ADR-002 and current-state project documentation is updated;
10. no Three.js, 3D, editing, persistence, server-upload, or AI functionality is introduced;
11. focused tests and repository verification pass.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. dependencies added or changed and the stable versions selected;
4. tests added or updated;
5. verification commands and results;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-017
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
