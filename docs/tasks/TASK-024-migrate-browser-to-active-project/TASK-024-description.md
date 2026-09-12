# TASK-024: Migrate Browser to Active Project

## Context

TASK-022 implemented Project Format 1.0 loading and the safe project-filesystem boundary. TASK-023 integrated that foundation into `apps/server`: one project is selected at server startup, the server binds to loopback, and it exposes controlled project metadata and active-architecture APIs.

The React application still owns its input through a local file picker and drag-and-drop. Phase 0 is completed by moving that browser workflow to the server-selected project while preserving the existing Apartment SVG parsing, validation, 2D preview, 3D rendering, and diagnostics.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/decisions/ADR-004-filesystem-backed-projects.md
docs/specifications/planaxis-project/1.0.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Make the React browser application automatically load the single project selected by the server and process its active Apartment SVG through the existing browser-side deterministic pipeline.

The browser must no longer use local file selection or drag-and-drop as its normal document source.

## Scope

The task includes:

- loading project metadata from `GET /api/project` when the application starts;
- loading the active Apartment SVG from `GET /api/project/architecture`;
- validating the browser-facing project-metadata response before treating it as trusted application data;
- feeding the fetched SVG source into the existing `processDocument` pipeline without moving Apartment SVG validation to the server;
- replacing local file-picker/drop ownership with project-loading UI and state;
- showing useful project identity, including the project name and active architecture path, in the browser workspace;
- preserving the current validation diagnostics, safe 2D preview, 2D/3D switching, camera/framing controls, Focus view, free-walk behavior, and renderer lifecycle for valid documents;
- preserving 2D preview and validation diagnostics for invalid Apartment SVG content;
- representing project/API/network failures separately from Apartment SVG validation failures;
- adding development-time same-origin API integration through the Vite dev server, using a narrow proxy to the loopback PlanAxis server rather than permissive CORS;
- updating automated browser tests for the project-backed workflow;
- updating README/current-state architecture documentation and startup instructions to describe the completed Phase 0 workflow.

## Out of Scope

This task does **not** include:

- changing Project Format 1.0 or its manifest schema;
- changing the TASK-023 HTTP endpoint contracts;
- adding generic project-resource APIs;
- serving the React application from Fastify;
- runtime project switching or an `Open Project...` browser flow;
- project creation/initialization UI;
- local SVG picker or drag-and-drop fallback behavior;
- project writes, architecture editing, or changing `architecture.active`;
- polling, filesystem watching, or automatic reload when project files change;
- server-side Apartment SVG parsing or validation;
- renderer/material/lighting improvements;
- design scenarios, project assets, or later Phase 1+ functionality.

Do not retain the old local-file workflow as a parallel second source of truth.

## Functional Requirements

### Project startup loading

When the application mounts, it must load:

```text
GET /api/project
```

and then the active architecture through:

```text
GET /api/project/architecture
```

The browser must use relative `/api/...` URLs. It must not know or construct the physical project-root path.

The metadata response is external HTTP input. Validate its required shape before using it:

```json
{
  "schema": "planaxis-project/1.0",
  "name": "My apartment renovation",
  "architecture": {
    "active": "architecture/existing.svg"
  }
}
```

At minimum, require the exact supported schema identifier and the expected string fields/structure. Do not silently accept malformed metadata as a valid project.

The metadata endpoint identifies the project and active architecture. The architecture endpoint is the source of the SVG bytes; do not construct an asset URL from `architecture.active`.

### Apartment SVG processing

After the active architecture response is successfully obtained, convert it to the source text required by the existing browser pipeline and reuse the established sequence:

```text
source text
    -> parsing
    -> schema validation
    -> reference validation
    -> geometric/topological validation
    -> ValidatedApartment2D
    -> ArchitecturalModel3D
    -> existing 2D/3D browser workflow
```

Do not duplicate or move parser/validator rules into browser transport code.

Project-format success does not imply Apartment SVG validity. An invalid active SVG must still reach the existing parsing/validation path so its normal diagnostics can be shown.

The original SVG source must remain available to the safe 2D preview regardless of Apartment SVG validation success when source text was fetched successfully.

### Browser state and failures

Replace the file-oriented document-loading state with project-backed state appropriate to asynchronous startup.

The UI must clearly distinguish at least:

- loading project/application state;
- project metadata/API/transport failure;
- active architecture processing;
- invalid Apartment SVG;
- valid Apartment SVG;
- unexpected renderer failure.

Do not label API/network failures as Apartment SVG validation failures.

A failed metadata or architecture request must produce a clear user-facing failure state and must not leave stale content displayed as if it belonged to the current project.

Async request completion after unmount must not update disposed application state. Use an appropriate cancellation/staleness mechanism.

### User interface migration

Remove the local-file interaction model from the normal application UI, including:

- **Open SVG / Replace SVG** buttons;
- the file input;
- drag/drop document loading;
- drop overlays;
- wording that says the document is processed from a local browser file.

Use the loaded project metadata instead.

The main workspace should identify the project by its manifest `name` and make the active architecture project-relative path visible where useful. Do not display the physical project-root path.

Preserve existing viewer/navigation controls and do not redesign unrelated UI.

There is no project-switching control in this task. Switching projects remains a server restart operation under ADR-004.

### Development API integration

The browser application should access `/api/...` as same-origin requests.

For Vite development, configure a narrow proxy for the required API traffic to:

```text
http://127.0.0.1:3000
```

Do not add permissive CORS to the PlanAxis server.

The normal documented development flow may use separate server and Vite processes. It must clearly describe how to:

1. start the server with `--project <path>`;
2. start the web application;
3. open the Vite URL and have `/api/...` proxied to that server.

Do not introduce a process-manager dependency merely to combine the two processes unless an existing repository capability already provides an appropriate solution.

### API failure handling

Treat non-successful HTTP status codes as project/API failures.

Do not expose raw server internals or physical filesystem paths in browser error messages.

Malformed metadata must fail explicitly. Architecture content must still be passed to the normal Apartment SVG pipeline even when its SVG contents are invalid.

## Technical and Architectural Constraints

- Keep React and browser APIs in `apps/web` under ADR-002.
- Keep Apartment SVG parsing/validation browser-side for this task.
- Reuse `processDocument` and the existing trusted-model/rendering pipeline.
- Do not introduce a second document-processing path for project-loaded SVG.
- Do not make browser code depend on Node.js filesystem APIs.
- Do not add direct browser knowledge of the project root or arbitrary resource paths.
- Keep the Vite proxy development-only; application code should use relative API paths.
- Preserve renderer/domain separation under ADR-003.
- Avoid new dependencies unless there is a concrete requirement not served by the platform or existing repository.

## Expected Areas

Expected changes are primarily under:

```text
apps/web/src/
apps/web/test/
apps/web/vite.config.ts
README.md
docs/architecture/overview.md
```

Root scripts or other documentation may change when necessary to keep the development workflow accurate, but avoid unrelated tooling changes.

## Testing Requirements

Update/add focused automated coverage for:

- initial loading of valid project metadata and active architecture;
- metadata response validation, including unsupported schema and malformed shapes;
- metadata HTTP failure;
- architecture HTTP failure;
- fetched valid Apartment SVG reaching the existing valid 2D/3D workflow;
- fetched invalid Apartment SVG retaining its 2D preview and structured validation diagnostics;
- project/API failures remaining distinct from Apartment SVG validation failures;
- project name and active architecture path being presented without an absolute root path;
- removal of file-picker and drag/drop document-loading behavior;
- stale/cancelled startup requests not replacing newer/disposed state;
- existing Focus view and viewer behavior continuing to work after project-backed loading;
- relative `/api/...` use rather than hard-coded physical/network project paths;
- Vite proxy configuration targeting the loopback server for development.

Use mocked `fetch` or an equivalent deterministic browser-test boundary. Routine tests must not require a manually running server or real network access.

Existing renderer and viewport tests must remain valid unless changes are necessary solely because the input source is now project-backed.

## Documentation Requirements

Update current-state documentation and user/developer startup instructions so they no longer describe local SVG drag-and-drop as the normal browser workflow.

Document the implemented Phase 0 flow:

```text
start server with project root
    -> server loads Project Format 1.0 project
    -> browser loads project metadata
    -> browser fetches active Apartment SVG
    -> existing validation / 2D / 3D pipeline
```

Keep project-format validity and Apartment SVG validity clearly separate.

Phase 0 should be described as implemented after this task; do not imply that later asset, design-scenario, material, or redesign phases are implemented.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused web tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. the browser automatically loads the server-selected project metadata and active architecture through the TASK-023 APIs;
2. browser-side metadata handling validates the expected API shape and supported project schema;
3. the fetched active SVG uses the existing Apartment SVG processing pipeline unchanged in architectural responsibility;
4. valid SVGs retain the existing 2D/3D functionality and invalid SVGs retain safe 2D preview plus diagnostics;
5. project/API failures are explicit and separate from Apartment SVG validation failures;
6. local file picker and drag/drop ownership are removed from the normal browser workflow;
7. the UI identifies the project and active architecture without exposing physical filesystem paths;
8. Vite development uses a narrow loopback API proxy and the server does not require permissive CORS;
9. automated tests cover the project-backed loading lifecycle and existing viewer behavior remains protected;
10. repository verification passes;
11. README and architecture documentation describe the implemented server-backed project workflow, completing Phase 0.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands and results;
5. deviations from this description, or `None`;
6. follow-up items, or `None`;
7. a suggested Conventional Commits message including:

```text
Task: TASK-024
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
