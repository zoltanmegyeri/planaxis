# TASK-037: Serve the Browser Application from the PlanAxis Server

## Context

PlanAxis currently requires two separately started processes for browser use:

- the Fastify backend on `127.0.0.1:3000`;
- the Vite development server, which serves the React application and proxies supported project API requests to Fastify.

This is useful during frontend development, but it is unnecessarily inconvenient for normal local use. ADR-001 already anticipates the server serving the web application.

The normal PlanAxis workflow should therefore become a single-command, single-process, single-port workflow while preserving Vite as the optional development/HMR path.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-004-filesystem-backed-projects.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Make the Fastify server the normal PlanAxis runtime entry point for both the built React application and the existing backend APIs.

From the repository root, a user must be able to start PlanAxis for one project with one command conceptually equivalent to:

```bash
pnpm start -- --project "/path/to/project"
```

That command must prepare the required build artifacts, start one Fastify process on the existing default port, print the browser URL, and provide a working PlanAxis application from that single origin.

## Scope

The task includes:

- serving the production Vite build from the PlanAxis Fastify server;
- preserving all existing API and project-loading behavior on the same origin;
- adding a root-level one-command startup workflow that builds what it needs before launching the server;
- printing the browser URL after successful normal startup;
- failing clearly when normal startup cannot provide the required browser build;
- retaining the Vite proxy/HMR workflow for development;
- updating tests and current-state documentation for the new normal startup model.

## Out of Scope

This task does **not** include:

- changing PlanAxis Project Format semantics;
- exposing the project root as static content;
- changing existing project-resource API contracts;
- adding authentication, remote hosting, deployment packaging, installers, or production infrastructure;
- adding configurable host or port behavior;
- introducing a client-side router or new browser navigation model;
- replacing Vite as the browser build/development tool;
- redesigning the browser UI;
- changing Apartment SVG, Design Format, or Material Format behavior.

## Functional Requirements

### Normal one-command startup

Add a root-level startup command whose intended invocation is:

```bash
pnpm start -- --project "/path/to/project"
```

From an installed workspace, this command must:

1. build the server and browser application, including required workspace dependencies;
2. start the PlanAxis server with the supplied project root;
3. require no separately started Vite process;
4. expose the application and APIs through the existing Fastify port, `127.0.0.1:3000`.

Preserve the existing `--project <path>` semantics, project validation, non-zero failure behavior, and occupied-port reporting.

On successful normal startup, print a concise browser URL such as:

```text
PlanAxis is running at http://127.0.0.1:3000/
```

The URL must only be reported after the server has successfully started listening.

### Static browser application

The Fastify application must serve the built Vite application from the same origin as the APIs.

At minimum:

- `GET /` serves the built browser entry document;
- browser build assets referenced by that document are served correctly;
- appropriate content types are returned by the static-serving mechanism;
- the existing `/health` route remains available;
- all existing `/api/...` routes retain their current behavior.

Do not make project files or arbitrary repository files reachable through static serving.

PlanAxis currently has no client-side router. Do not introduce a catch-all SPA fallback that converts unknown API paths or arbitrary unknown paths into the browser entry document merely to support hypothetical future routing.

### Missing browser build

Normal server operation must not silently start as an apparently complete PlanAxis application when its required production browser build is unavailable or unusable.

Report a clear startup failure and return a non-zero process status.

The root startup command should normally prevent this condition by building the required artifacts before launch.

### Vite development workflow

Keep Vite available for frontend development and HMR.

The existing development proxy model may remain:

```text
Vite -> Fastify API on 127.0.0.1:3000
```

The backend must remain usable for this development workflow without requiring developers to maintain a production browser build solely to run the API server. If the production-serving behavior requires a distinct development/API-only server mode, implement the smallest explicit mechanism necessary and document it.

Do not replace the normal single-server workflow with a process manager that merely hides two concurrently running servers.

## Technical and Architectural Constraints

- Fastify owns normal runtime HTTP serving for both the production browser build and backend APIs.
- Browser API requests must remain relative and same-origin; do not add permissive CORS for this task.
- Preserve the existing project-filesystem boundary and deliberate resource routes.
- Static serving must be limited to the built browser application, never the selected PlanAxis project root.
- Keep Vite in `apps/web` as the build/development tool.
- Do not introduce another HTTP server, reverse proxy, or application framework.
- A small Fastify-compatible static-serving dependency may be added when appropriate; follow the repository dependency policy in `docs/development/coding-guidelines.md`.
- Resolve the browser build location deterministically from the application/repository layout rather than from the selected project path.
- Keep the implementation focused on startup and HTTP serving; do not mix unrelated browser or project changes into this task.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
package.json
pnpm-lock.yaml                         # only if dependency metadata changes
apps/server/package.json
apps/server/src/
apps/server/test/
apps/web/vite.config.ts                # only if development behavior needs adjustment
README.md
AGENTS.md
docs/architecture/overview.md
```

Use the established repository structure if a better exact location already exists.

## Testing Requirements

Add or update automated tests covering the changed server behavior.

At minimum verify:

- the production browser entry document is served from `/`;
- representative built static assets are served correctly;
- `/health` and existing project APIs still take precedence and retain their behavior;
- unknown API paths are not converted into browser HTML;
- missing required browser build content causes a clear normal-startup failure;
- successful startup reports the correct browser URL;
- any new development/API-only startup behavior is parsed and exercised correctly;
- existing project-loading and port-conflict behavior remains covered.

Use isolated test static content where practical rather than depending on incidental repository build state.

Do not weaken existing tests.

## Documentation Requirements

Update current-state documentation so normal operation is described as a single Fastify server serving both the browser application and APIs.

At minimum update:

```text
README.md
AGENTS.md
docs/architecture/overview.md
```

The documentation must clearly distinguish:

- normal one-command, single-port operation;
- the optional Vite development/HMR workflow.

Remove statements that Fastify does not serve the React build or that the two-process workflow is the supported normal browser startup model.

No normative format specification change or new ADR is expected.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also perform a smoke check with an existing valid PlanAxis project:

1. run the new root startup command;
2. confirm the printed URL serves the browser application;
3. confirm an existing API such as `/api/project` works from the same origin;
4. confirm no Vite process is required for that normal workflow.

## Acceptance Criteria

The task is complete when:

1. normal PlanAxis browser use requires one command and one Fastify process;
2. `pnpm start -- --project <path>` or the established equivalent builds the required artifacts and starts PlanAxis;
3. the Fastify port serves both the built React application and the existing APIs from one origin;
4. successful startup prints the browser URL;
5. missing required production browser assets fail clearly in normal server mode;
6. Vite remains available as a documented development/HMR workflow;
7. project filesystem isolation, API contracts, project loading, and port-conflict behavior remain intact;
8. automated tests and repository verification pass;
9. README, AGENTS, and architecture documentation describe the resulting workflow accurately.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands and results;
5. smoke-test result for the single-server workflow;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-037
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
