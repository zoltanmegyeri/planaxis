# TASK-023: Implement Server-Backed Project Operation

## Context

TASK-022 implemented the server-side PlanAxis Project Format 1.0 loading foundation under `apps/server/src/project/`. It provides validated project manifest loading, a canonical project root, and a read-only `ProjectFilesystem` boundary that enforces project-relative paths, containment, and symbolic-link restrictions.

ADR-004 requires the next application step: one explicitly selected project per server process, loopback-safe server operation, and controlled HTTP access to project metadata and the active Apartment SVG.

The browser still loads local SVG files directly. Migrating it to these server APIs is a separate follow-up task.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/decisions/ADR-004-filesystem-backed-projects.md
docs/specifications/planaxis-project/1.0.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Make `apps/server` operate on exactly one PlanAxis project selected at process startup and expose the minimal controlled HTTP API needed for clients to inspect that project and retrieve its active Apartment SVG.

The server must load and validate the project before listening, bind to loopback by default, and keep all physical filesystem access behind the TASK-022 project boundary.

## Scope

The task includes:

- accepting one required project-root argument when starting the server;
- loading that root through the existing TASK-022 project loader before the server begins listening;
- failing startup clearly and with a non-zero process status when invocation or project loading fails;
- changing the default server host from all interfaces to loopback;
- constructing the Fastify application with the single loaded project context;
- preserving the existing `/health` route;
- adding:
  - `GET /api/project` for safe project metadata;
  - `GET /api/project/architecture` for the active Apartment SVG file bytes;
- ensuring project APIs do not expose the canonical/absolute project root or arbitrary filesystem access;
- handling post-start resource read failures as controlled HTTP failures without bypassing `ProjectFilesystem`;
- adding focused automated tests for startup behavior and the HTTP contracts;
- updating current-state and server-startup documentation made inaccurate by this change.

## Out of Scope

This task does **not** include:

- modifying `apps/web`;
- removing browser file picker or drag-and-drop behavior;
- Vite proxy/CORS integration for the browser;
- serving the entire project root or adding a generic arbitrary-file endpoint;
- runtime project switching;
- project creation or initialization;
- serving material, model, reference, design, output, or `.planaxis/` resources;
- project writes or manifest mutation;
- Apartment SVG parsing or validation on the server;
- moving existing browser parsing/validation to the server;
- authentication, LAN/remote exposure, or collaboration;
- serving/building the React application from Fastify.

Do not implement the later browser migration as part of this task.

## Functional Requirements

### Startup contract

The server process must require a project root through this command-line form:

```text
--project <path>
```

The invocation parser must reject missing `--project`, a missing value, duplicate project options, or unsupported arguments with a concise developer-facing error and non-zero process status.

Use the existing `loadProject()` foundation. Do not reproduce manifest or filesystem validation in startup code.

The project must be loaded successfully **before** Fastify begins listening. If project loading fails, report a concise useful error and do not start the HTTP server.

One process owns exactly one loaded project context for its lifetime. Dynamic project replacement is not required.

### Listen address

Filesystem-backed project operation must bind to:

```text
127.0.0.1
```

by default, using the existing port `3000` unless the current server configuration already provides a deliberate equivalent.

Preserve the existing TASK-002 behavior for meaningful port-conflict reporting.

Do not add LAN binding or a broad network-exposure option in this task.

### Application construction

The Fastify application must receive the already loaded project context explicitly rather than reading a hidden global or independently loading a project.

The existing:

```text
GET /health
```

route must remain available and compatible.

### `GET /api/project`

Return only safe client-facing project metadata derived from the validated manifest.

The response contract is:

```json
{
  "schema": "planaxis-project/1.0",
  "name": "My apartment renovation",
  "architecture": {
    "active": "architecture/existing.svg"
  }
}
```

Do not return:

- the canonical or supplied absolute project-root path;
- filesystem-native paths;
- internal `ProjectFilesystem` details;
- `.planaxis/` information;
- arbitrary directory listings.

The API contract may mirror the currently safe Project Format 1.0 manifest fields, but this is an application response, not a raw static exposure of `planaxis.project.json`.

### `GET /api/project/architecture`

Return the bytes of the active architecture file selected by the loaded manifest.

Requirements:

- read the file through the loaded `ProjectFilesystem`;
- do not accept a client-supplied filesystem/project-relative path;
- do not re-resolve the active file using ad hoc Node.js filesystem calls;
- preserve the file bytes;
- use a non-executable generic response content type such as `application/octet-stream`;
- send `X-Content-Type-Options: nosniff`;
- do not parse or validate Apartment SVG contents.

An invalid Apartment SVG is still a valid response when the project container itself is conforming. Apartment SVG diagnostics remain the downstream client's responsibility.

If the active resource becomes unavailable or violates the established filesystem boundary after startup, return a controlled server error rather than leaking physical paths or raw internal exceptions.

### HTTP boundary

The complete project directory must not be statically mounted.

Do not introduce routes that accept arbitrary project-relative or absolute paths.

No route may expose `.planaxis/` in this task.

Do not add permissive CORS behavior merely to anticipate the browser-migration task. Browser development integration should be solved deliberately there.

## Technical and Architectural Constraints

- Reuse the TASK-022 `ProjectContext`, `loadProject()`, and `ProjectFilesystem`; do not duplicate their responsibilities.
- Keep command-line, process, Fastify, and filesystem concerns in `apps/server`.
- Keep project-format validity separate from Apartment SVG validity.
- Keep project context explicit in application construction and route registration.
- Do not introduce a dependency for basic command-line parsing unless a demonstrated repository need justifies it.
- Do not expose absolute local paths in successful HTTP responses or normal API errors.
- Preserve current server behavior unrelated to the project-backed operating model.

## Expected Areas

Expected changes are primarily under:

```text
apps/server/src/
apps/server/test/
apps/server/package.json
package.json
README.md
docs/architecture/overview.md
```

Not every listed file must change. Add or change scripts only when they provide a clear documented way to run the project-backed server.

## Testing Requirements

Add focused automated coverage for:

- valid `--project <path>` parsing;
- missing, malformed, duplicate, and unsupported startup arguments;
- successful startup preparation with a conforming project;
- invalid project loading preventing server startup;
- application construction with one explicit project context;
- `/health` remaining compatible;
- `GET /api/project` returning exactly the safe project metadata contract without absolute paths;
- `GET /api/project/architecture` returning the exact active file bytes;
- architecture responses using the safe content type and `nosniff`;
- invalid Apartment SVG contents still being served unchanged;
- active-resource filesystem failures after project load producing a controlled HTTP error;
- no client path being required or accepted by the active-architecture endpoint;
- default loopback host configuration;
- preservation of existing port-conflict behavior.

Use temporary project directories and Fastify injection where practical. Tests must not require a manually running server, real network access, or machine-specific filesystem paths.

## Documentation Requirements

Update current-state documentation so it accurately states that:

- project-root startup selection and one-project-per-server operation are implemented;
- the server binds to loopback for filesystem-backed operation;
- controlled project metadata and active-architecture APIs are implemented;
- the browser still uses its existing local-file workflow until the next task.

Document the concrete server startup command available after this task.

Do not describe the browser as migrated yet.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused server tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. the server requires exactly one `--project <path>` selection and loads it through TASK-022 before listening;
2. project-loading or invocation failures prevent server startup and produce a non-zero process result;
3. filesystem-backed server operation binds to `127.0.0.1` by default while preserving meaningful port-conflict reporting;
4. one explicit loaded project context is supplied to the Fastify application;
5. `/health` remains compatible;
6. `GET /api/project` exposes only the defined safe project metadata;
7. `GET /api/project/architecture` serves the exact active file through `ProjectFilesystem` without accepting a client path or validating Apartment SVG contents;
8. the server does not statically expose the project root, `.planaxis/`, or arbitrary project resources;
9. focused automated tests and repository-level verification pass;
10. documentation reflects implemented server-backed project operation while correctly leaving browser migration for the next task.

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
Task: TASK-023
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
