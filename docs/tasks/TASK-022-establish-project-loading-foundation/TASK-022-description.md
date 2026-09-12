# TASK-022: Establish PlanAxis Project Loading Foundation

## Context

PlanAxis Project Format 1.0 and ADR-004 define the filesystem-backed project model that will become the foundation for later material, asset, design, and AI workflows.

The current application does not yet implement that model. Before the server can expose a project through HTTP or the browser can migrate away from local SVG drag-and-drop, PlanAxis needs one safe server-side foundation for opening a project root, validating its manifest, and accessing project-relative files without escaping the authorized root.

This task establishes that foundation only. Server startup/API integration and browser migration remain separate follow-up tasks.

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

Implement the server-side project-loading and project-filesystem foundation required by PlanAxis Project Format 1.0.

Given a physical project-root path, PlanAxis must be able to establish the canonical project root, validate `planaxis.project.json` and the required project structure, and safely resolve/read project-relative resources while enforcing root containment and the Project Format 1.0 symbolic-link policy.

## Scope

The task includes:

- loading and validating `planaxis.project.json` according to Project Format 1.0;
- establishing the canonical physical project root from the supplied root path;
- validating the required `architecture/` directory and active architecture file;
- implementing canonical project-relative path validation;
- centralizing safe project-resource resolution and read access behind one project-filesystem abstraction;
- enforcing project-root containment and prohibiting symbolic-link traversal below the canonical root;
- exposing a cohesive server-side API/context suitable for later server startup and HTTP integration;
- adding focused automated tests for manifest, path, filesystem-boundary, symlink, and project-conformance behavior;
- updating current-state documentation only where completion of this foundation makes existing wording inaccurate.

## Out of Scope

This task does **not** include:

- Fastify project routes or resource-serving endpoints;
- changing server command-line/startup arguments or one-project-per-process wiring;
- changing the server's network bind address;
- browser integration or removal of local SVG drag-and-drop;
- project switching or an `Open Project...` UI;
- project creation or initialization tooling;
- writing or modifying durable project files;
- material, model-asset, design-scenario, lighting, or AI descriptor formats;
- Apartment SVG parsing or validation;
- changing Apartment SVG or PlanAxis Project Format semantics;
- exposing the project root as a static directory.

Do not implement the later server/API or browser phases merely because the project loader makes them possible.

## Functional and Architectural Requirements

### Project loading

The loader must treat `docs/specifications/planaxis-project/1.0.md` as normative.

A successful load must establish at least:

- the canonical physical project root;
- the validated Project Format 1.0 manifest;
- the active architecture project-relative path;
- a project-filesystem boundary through which later server code can access project resources safely.

Project-format validity and Apartment SVG validity must remain independent. The active architecture must be verified as the required accessible regular `.svg` file, but its XML or Apartment SVG contents must not be parsed or validated by this task.

Optional reserved directories may be absent, and unrelated non-reserved files/directories must not invalidate an otherwise conforming project.

### Manifest validation

Validate the complete Project Format 1.0 manifest contract, including:

- required `schema`, `name`, and `architecture.active`;
- exact supported schema identifier;
- closed root and `architecture` objects;
- the non-empty human-readable project name rule;
- the normative project-relative path rules for `architecture.active`;
- the requirement that the active architecture is below `architecture/` and has the lowercase `.svg` extension.

Invalid JSON, unsupported schema versions, invalid manifest shapes, unsafe paths, missing required structure, or invalid required resource types must fail explicitly and predictably.

Do not invent additional manifest fields or future format semantics.

### Project filesystem boundary

Filesystem access for project resources must be centralized rather than implemented through ad hoc path joining.

The boundary must enforce the Project Format 1.0 rules for:

- `/`-separated project-relative paths;
- prohibited absolute paths, backslashes, empty segments, `.` / `..`, drive prefixes, URI-style paths, and NUL characters;
- canonical root containment;
- symbolic-link traversal prohibition below the canonical project root.

The supplied project-root path itself may be canonicalized according to the specification before the project boundary is established.

Unrelated symbolic links elsewhere in the project do not need to invalidate the whole project merely by existing, but an accessed/required resource path must not traverse one.

Containment checks must be filesystem/path-aware; simple string-prefix checks are insufficient.

The implementation should expose safe read/resource-resolution behavior needed by later backend work without introducing write operations that this task does not require.

### Layering

ADR-004 assigns physical project filesystem ownership to the backend. Keep Node.js filesystem behavior in server-side application code or another clearly Node-specific boundary; do not leak `fs`, absolute local paths, or other Node-only concerns into renderer-independent shared domain packages.

Do not introduce a new reusable package, dependency, framework, or abstraction unless the existing repository structure demonstrates a concrete need for it.

Project-loading code must not depend on React, Three.js, or Apartment SVG validation.

## Expected Areas

The implementation is expected primarily under:

```text
apps/server/src/
apps/server/test/
```

Exact module names and internal organization may follow the existing server conventions.

Documentation should change only when necessary to keep current-state descriptions accurate.

## Testing Requirements

Use isolated temporary directories for filesystem tests.

Cover at least:

- a minimal conforming Project Format 1.0 project;
- manifest JSON/shape/schema/name failures;
- unknown manifest properties;
- missing or invalid required `architecture/` structure;
- missing, non-regular, wrong-extension, or unsafe active architecture paths;
- optional reserved directories being absent;
- unrelated extra files/directories being allowed;
- each important prohibited project-relative path form;
- containment edge cases, including similarly prefixed sibling paths;
- symbolic links in the target or intermediate resource path being rejected;
- canonicalization of the supplied project root;
- a project remaining project-format valid when its active SVG contains invalid/non-Apartment-SVG content;
- safe reading of an allowed project-relative resource through the centralized boundary.

Tests must remain deterministic, cross-platform where practical, and must not rely on network access or machine-specific paths.

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

1. a conforming Project Format 1.0 directory can be loaded into a validated server-side project context;
2. the complete 1.0 manifest contract and required project structure are enforced without validating Apartment SVG contents;
3. project-relative path validation, canonical root containment, and symbolic-link restrictions are implemented in one reusable server-side filesystem boundary;
4. unsafe or non-conforming project/resource paths fail predictably and cannot escape the project root;
5. the implementation introduces no HTTP routes, browser workflow changes, project-writing behavior, or future asset/design schemas;
6. focused automated tests cover the security and conformance boundaries above;
7. repository-level verification passes;
8. documentation remains consistent with the fact that only the project-loading foundation—not full server-backed project operation—is implemented.

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
Task: TASK-022
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
