# TASK-029: Add Server Design Persistence APIs

## Context

PlanAxis Design Format 1.0 is implemented as the renderer-independent `@planaxis/design` package.

Phase 2 now needs a controlled server-side persistence boundary so the browser can discover and read design descriptors, explicitly create or update them, and read the exact Apartment SVG architecture referenced by a selected design. The server owns physical project filesystem access; Design 1.0 structural validation remains separate from Apartment SVG semantic validation and finish-target resolution.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
```

Also read:

```text
docs/specifications/planaxis-design/1.0.md
docs/specifications/planaxis-project/1.0.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-004-filesystem-backed-projects.md
```

Inspect the public API of:

```text
packages/design/
```

Do not browse other task records or task descriptions under `docs/tasks/`.

## Goal

Extend the server-owned project filesystem boundary and HTTP API with safe design discovery, read, create, and update operations, plus controlled reading of a design-bound architecture, without introducing browser workflow or Apartment SVG semantic validation into the server.

## Scope

The task includes:

- add `@planaxis/design` as a server workspace dependency;
- extend the project-filesystem layer with the safe enumeration and durable-write capabilities required by design persistence;
- discover candidate design descriptors recursively under `designs/`;
- expose controlled HTTP APIs for design discovery, reading, creation, and update;
- expose controlled reading of a specific project architecture under `architecture/` for later design resolution;
- validate created/updated design documents with `@planaxis/design`;
- use failure-safe/atomic replacement for durable descriptor updates where the host filesystem permits it;
- add focused filesystem and HTTP integration tests;
- update implementation-status/API documentation made inaccurate by the new server behavior.

## HTTP Contract

Implement these endpoints.

### `GET /api/project/designs`

Return:

```json
{
  "designs": [
    "designs/example.json",
    "designs/nested/other.json"
  ]
}
```

Requirements:

- enumerate recursively below `designs/`;
- return only accessible regular files whose project-relative path has a lowercase `.json` suffix;
- sort paths lexicographically for deterministic output;
- return an empty array when `designs/` does not exist;
- do not parse descriptor contents during discovery;
- therefore malformed or unsupported JSON descriptors remain discoverable;
- never traverse symbolic links.

### `GET /api/project/design?path=<project-relative-path>`

Requirements:

- require exactly one `path` query parameter and reject unknown query parameters;
- accept only a Design 1.0 descriptor path below `designs/`;
- read through the project-filesystem boundary;
- return the file bytes unchanged with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`;
- do not parse or validate descriptor contents on read.

### `POST /api/project/design?path=<project-relative-path>`

Create a new design descriptor.

Requirements:

- require exactly one valid descriptor `path`;
- treat the JSON request body as the Design 1.0 document itself, not a wrapper object;
- validate the body with `@planaxis/design` using the requested path as descriptor identity;
- reject invalid Design 1.0 data with HTTP 400 and a safe structured error containing the stable design error code, location, and message;
- create missing ordinary parent directories below `designs/` as needed without weakening root-containment or symbolic-link protections;
- fail with HTTP 409 rather than overwrite an existing target;
- persist validated data as UTF-8 JSON using deterministic two-space indentation and one trailing newline;
- return HTTP 201 with:

```json
{
  "path": "designs/example.json"
}
```

### `PUT /api/project/design?path=<project-relative-path>`

Update an existing design descriptor.

Requirements:

- use the same query and Design 1.0 body validation rules as `POST`;
- require the target to already exist as an accessible regular file;
- return HTTP 404 when the target does not exist;
- replace the descriptor using a failure-safe/atomic strategy where supported;
- persist the same deterministic UTF-8 JSON representation as `POST`;
- return HTTP 204 on success.

### `GET /api/project/architecture-resource?path=<project-relative-path>`

Requirements:

- require exactly one `path` query parameter and reject unknown query parameters;
- accept only a valid project-relative lowercase `.svg` path below `architecture/`;
- read through the project-filesystem boundary;
- return the bytes unchanged with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`;
- do not parse or validate Apartment SVG contents.

The existing:

```text
GET /api/project/architecture
```

must retain its current active-architecture behavior and continue rejecting query parameters.

## Functional Requirements

- Discovery MUST treat descriptor path/location as the only discovery criterion; it MUST NOT silently hide a candidate because its JSON or Design 1.0 contents are invalid.
- Read operations MUST re-enter the project-filesystem boundary at I/O time rather than trust previously observed absolute paths.
- Symbolic-link traversal and project-root escape MUST remain prohibited for enumeration, reads, directory creation, and writes.
- Create/update MUST validate Design 1.0 format conformance but MUST NOT:
  - require referenced material resources to exist;
  - parse material resources;
  - validate Apartment SVG semantics;
  - derive architectural surfaces;
  - resolve finish targets.
- Write validation MUST NOT add, remove, repair, or infer design properties.
- Normal client/input failures MUST produce controlled HTTP responses without exposing the physical project root or machine-local absolute paths.
- Unexpected infrastructure failures MUST be logged server-side and returned as a generic safe HTTP 500 response.
- No generic arbitrary-project-file HTTP endpoint may be introduced.

## Technical and Architectural Constraints

The server owns physical filesystem and persistence concerns.

`@planaxis/design` remains the source of Design 1.0 structural validation. Do not duplicate its schema rules in route handlers.

Keep route handling, project-filesystem mechanics, and Design-format validation as separable responsibilities.

The server MUST NOT depend on the Apartment SVG parser/validator, `@planaxis/renderer-three`, React, or browser code for this task.

Durable design writes must not modify:

```text
planaxis.project.json
architecture/
assets/
references/
outputs/
.planaxis/
```

except that `GET /api/project/architecture-resource` may read eligible architecture files.

## Out of Scope

The task explicitly does **not** include:

- browser design discovery, selection, loading, editing, or save UI;
- session-state selection of an active design;
- Apartment SVG parsing/validation or finish-target resolution in the server;
- material existence checks, material semantics, or rendering;
- applying `toneMapping` or `exposureEv`;
- design duplicate, delete, rename, move, or rebind workflows;
- a persistent active-design property;
- changing `planaxis.project.json`;
- changes to PlanAxis Design Format 1.0 or Project Format 1.0.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/server/
packages/design/package.json or public API only if a demonstrated integration need requires it
README.md
docs/architecture/overview.md
pnpm-lock.yaml
```

Prefer using the existing `@planaxis/design` public API unchanged.

Do not modify any file under:

```text
docs/tasks/
```

Do not modify normative specifications unless an actual specification conflict is discovered; report such a conflict instead of silently changing the contract.

## Dependencies

Expected dependency changes:

```text
@planaxis/server -> @planaxis/design (workspace:*)
```

No new third-party dependency is expected.

Follow the repository dependency rules for any manifest or lockfile changes.

## Testing Requirements

Use isolated temporary project trees and add focused coverage for:

- missing `designs/` returning an empty discovery list;
- recursive deterministic discovery of nested lowercase `.json` regular files;
- non-JSON files being ignored;
- malformed/unsupported descriptor contents still being listed and readable;
- symbolic-link files/directories never being traversed during discovery or access;
- safe read of a selected design;
- traversal, absolute, backslash, dot-segment, wrong-directory, and wrong-extension rejection;
- creation of the first design when `designs/` is absent;
- nested design creation with safe parent-directory creation;
- create conflict without overwriting an existing descriptor;
- update of an existing descriptor and 404 for a missing target;
- Design 1.0 validation failures returning controlled HTTP 400 responses;
- persisted JSON formatting and round-trip content;
- update behavior not leaving a partially written authoritative descriptor under normal tested failure paths where practical;
- safe reading of a non-active architecture under `architecture/`;
- rejection of invalid architecture-resource paths and symlink traversal;
- preservation of the existing active-architecture endpoint behavior;
- no unrestricted arbitrary project-file serving.

Tests must not require browser, GPU, network access, or a real user project.

## Documentation Requirements

Update documentation made inaccurate by implementing server design persistence.

At minimum, review and update as needed:

```text
README.md
docs/architecture/overview.md
```

Do not duplicate the complete HTTP contract into multiple documents; keep documentation concise and link to normative format specifications where appropriate.

## Verification

Run:

```bash
pnpm --filter @planaxis/server test
pnpm --filter @planaxis/server typecheck
pnpm --filter @planaxis/server build
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

1. the server can deterministically discover candidate design descriptors under `designs/` without parsing them;
2. selected design files and explicitly requested architecture files can be read only through controlled project-boundary APIs;
3. valid Design 1.0 documents can be explicitly created and updated durably;
4. invalid Design 1.0 write requests are rejected without modifying durable data;
5. create cannot overwrite an existing design and update cannot silently create a missing design;
6. project-root containment and symbolic-link protections apply to all new enumeration/read/write behavior;
7. existing active-architecture API behavior remains compatible;
8. no Apartment SVG semantic validation, material resolution, renderer behavior, or browser workflow is introduced;
9. focused server/filesystem tests cover the new contract;
10. required repository verification passes and relevant documentation is current.

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
Task: TASK-029
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
