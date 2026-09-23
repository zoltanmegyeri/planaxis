# TASK-032: Add Server Material Resource APIs

## Context

TASK-031 implemented PlanAxis Material Format 1.0 as the pure `@planaxis/material` package.

The next Phase 3 step is to let the browser read explicitly referenced material descriptors and texture resources from the selected PlanAxis project. The server owns physical filesystem access and must expose only narrow project-relative resources through the existing project-filesystem boundary.

Material parsing, texture decoding, design-material resolution, and renderer adaptation remain downstream concerns.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/specifications/planaxis-material/1.0.md
docs/specifications/planaxis-project/1.0.md
docs/specifications/planaxis-design/1.0.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-004-filesystem-backed-projects.md
```

Inspect the existing controlled project/design resource routes and project-filesystem boundary under:

```text
apps/server/src/
```

Do not read any other file under `docs/tasks/`.

## Goal

Add read-only server APIs for explicitly requested Material 1.0 descriptors and supported material texture files under `assets/materials/`, preserving the existing project-root and symbolic-link protections without introducing generic project-file serving.

## Scope

The task includes:

- extend controlled project-resource path validation for Material 1.0 descriptor and texture resource selectors;
- add read-only HTTP endpoints for one explicitly requested material descriptor and one explicitly requested supported texture resource;
- read both resource types through the existing `ProjectFilesystem` boundary;
- preserve resource bytes unchanged;
- reuse the server's existing safe project-error handling;
- add focused route/path/filesystem integration tests;
- update implementation-status/API documentation made inaccurate by the new server behavior.

## HTTP Contract

### `GET /api/project/material?path=<project-relative-path>`

Requirements:

- require exactly one `path` query parameter and reject unknown query parameters;
- accept only canonical project-relative paths below `assets/materials/` whose filename has a lowercase `.json` extension;
- read the file through the project-filesystem boundary;
- return the bytes unchanged with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`;
- do not parse or validate the descriptor contents.

A malformed, unsupported, or otherwise non-conforming JSON document at a valid material-descriptor path therefore remains readable for downstream Material Format validation.

### `GET /api/project/material-texture?path=<project-relative-path>`

Requirements:

- require exactly one `path` query parameter and reject unknown query parameters;
- accept only canonical project-relative paths below `assets/materials/` whose filename has one of these lowercase extensions:

```text
.png
.jpg
.jpeg
.webp
```

- read the file through the project-filesystem boundary;
- return the bytes unchanged with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`;
- do not inspect image contents, dimensions, color space, channels, or decodability.

## Functional Requirements

- Both endpoints MUST use the existing centralized project-filesystem boundary for I/O.
- Resource selection MUST enforce the Material Format 1.0 location/extension restrictions above without broadening access to arbitrary files under `assets/` or the project root.
- Texture files MAY be anywhere below `assets/materials/`; they are not required to be siblings of a descriptor.
- Reads MUST re-enter the filesystem boundary at I/O time and MUST preserve project-root containment and symbolic-link protections.
- Missing resources and normal invalid/unsafe requests MUST use controlled client-facing responses consistent with existing project resource APIs.
- Unexpected infrastructure failures MUST remain server-side diagnostics and produce a generic safe HTTP 500 response.
- Descriptor contents MUST NOT be parsed with `@planaxis/material` in this task.
- Texture bytes MUST NOT be decoded or semantically validated in this task.
- No material discovery/listing endpoint may be introduced. A selected design supplies the exact descriptor references needed later.
- No generic arbitrary-project-file endpoint may be introduced.

## Out of Scope

This task does **not** include:

- material discovery or catalog APIs;
- material create/update/delete/rename/move APIs;
- browser fetch/orchestration code or Vite proxy changes needed by later browser integration;
- Design 1.0 finish-assignment resolution;
- Material 1.0 JSON parsing or validation on the server read path;
- texture decoding or image-format sniffing;
- conversion to runtime PBR materials or Three.js textures;
- renderer changes;
- material-management UI;
- filesystem watching or hot reload;
- changes to Material Format 1.0, Design Format 1.0, or Project Format 1.0.

## Technical and Architectural Constraints

Follow the existing project/design route and filesystem patterns rather than introducing a second resource-access mechanism.

The project filesystem remains the only owner of physical path resolution, containment, symbolic-link checks, and safe file opening.

Material descriptor and texture selector validation may extend the existing controlled project-resource path layer. Do not expose physical absolute paths or move filesystem-security responsibilities into `@planaxis/material`.

No new third-party dependency is expected. A new server dependency on `@planaxis/material` is also not expected because descriptor contents remain unparsed; add one only if a concrete implementation need justifies it without changing the task boundary.

Do not modify normative specifications. If an actual specification conflict is found, report it rather than silently changing the contract.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/server/src/
apps/server/test/
README.md
docs/architecture/overview.md
```

Exact test locations should follow existing server conventions.

Do not modify any file under:

```text
docs/tasks/
```

## Testing Requirements

Use isolated temporary project trees and add focused coverage for:

- successful nested material descriptor reads with unchanged bytes;
- malformed or unsupported descriptor contents remaining readable;
- successful `.png`, `.jpg`, `.jpeg`, and `.webp` texture reads with unchanged bytes;
- material descriptor rejection for wrong directory, missing/uppercase/wrong extension, traversal, absolute, backslash, dot-segment, and URI-like paths;
- texture rejection for wrong directory, unsupported/uppercase extension, traversal, absolute, backslash, dot-segment, and URI-like paths;
- missing resources;
- non-regular-file targets;
- symbolic-link file or directory traversal;
- exact query-parameter requirements;
- `application/octet-stream` and `nosniff` response headers;
- preservation of existing project, architecture, and design route behavior;
- absence of unrestricted arbitrary project-file access.

Tests MUST NOT require a browser, image decoder, GPU, external network, or real user project.

## Documentation Requirements

Update only documentation made inaccurate by the new server resource APIs.

At minimum, review and update as needed:

```text
README.md
docs/architecture/overview.md
```

Describe Material Format parsing/validation as implemented in `@planaxis/material`, the new server APIs as raw controlled resource access, and browser material resolution/rendering as still pending.

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
```

If dependency manifests or the lockfile change, also perform the repository dependency verification required by `docs/development/coding-guidelines.md`.

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. the server exposes the two read-only material resource endpoints defined above;
2. descriptor access is confined to lowercase `.json` files below `assets/materials/`;
3. texture access is confined to lowercase PNG/JPEG/WebP files below `assets/materials/`;
4. resource bytes are returned unchanged without Material JSON parsing or image decoding;
5. project-root containment, regular-file checks, and symbolic-link protections apply to all new reads;
6. invalid, missing, unsafe, and unexpected failures follow the existing controlled server error model;
7. no discovery, write, generic file-serving, browser, decoding, or renderer behavior is introduced;
8. focused server tests cover the new contract and existing resource behavior remains compatible;
9. relevant implementation-status/API documentation is current;
10. required repository verification passes.

## Final Response

Provide a concise execution report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands actually run and their results;
5. dependency changes, or `None`;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-032
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
