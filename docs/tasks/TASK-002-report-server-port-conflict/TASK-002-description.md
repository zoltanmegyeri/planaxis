# TASK-002: Report Server Port Conflicts at Startup

## Context

TASK-001 established the initial PlanAxis TypeScript monorepo and minimal Fastify server.

During human review of that task, a practical server-start check revealed that when the configured HTTP port is already occupied by another operating-system process, the server exits with a non-zero status without presenting a sufficiently clear, human-understandable explanation of the failure.

The current server entry point starts Fastify on:

```text
host = 0.0.0.0
port = 3000
```

and handles `application.listen(...)` failures generically.

This task improves that startup failure path only.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
```

Also read:

```text
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
```

Use those documents as the authoritative repository context.

Do not read any other file under `docs/tasks/`.

## Goal

When the PlanAxis server cannot start because its configured HTTP port is already in use, report a clear, human-understandable startup error that identifies the port conflict and then terminate unsuccessfully.

The resulting behavior must be covered by automated regression tests.

Other server startup behavior must remain unchanged.

## Scope

The task includes:

- detecting the server startup failure that represents an address/port already being in use;
- reporting a clear human-readable message for that failure;
- including the affected port in the diagnostic;
- preserving a non-zero process exit status for startup failure;
- keeping unexpected startup failures distinguishable from the port-conflict case;
- restructuring the small server startup boundary when necessary to make the behavior testable;
- adding automated regression coverage for the port-conflict behavior.

## Out of Scope

The task explicitly does **not** include:

- making the server port configurable through environment variables, configuration files, command-line options, or another configuration system;
- changing the default server host;
- changing the default server port;
- automatically selecting another free port;
- retrying server startup on another port;
- discovering or terminating the operating-system process that owns the conflicting port;
- introducing a general logging framework or redesigning application logging;
- changing the `/health` endpoint;
- adding HTTP API functionality;
- changing application architecture outside the narrow startup concern;
- Apartment SVG parsing, validation, geometry, modeling, rendering, or simulation behavior.

Do not implement adjacent server features merely because the startup code is being modified.

## Functional Requirements

The implementation MUST satisfy the following behavior.

### Successful startup

When the configured host and port can be bound successfully:

- server startup MUST continue to work as before;
- the default host MUST remain:

```text
0.0.0.0
```

- the default port MUST remain:

```text
3000
```

### Port already in use

When server startup fails because the requested address or port is already in use:

- the failure MUST be recognized specifically as an address-in-use condition rather than treated only as an unknown startup failure;
- the server MUST emit a clear human-readable diagnostic;
- the diagnostic MUST identify that the port is already in use;
- the diagnostic MUST include the affected port number;
- the diagnostic SHOULD identify the PlanAxis server or server startup context so that the source of the message is clear;
- the diagnostic MUST be emitted through a channel visible to a person starting the server from a terminal;
- the process MUST terminate with a non-zero exit status.

An acceptable message is conceptually similar to:

```text
Failed to start the PlanAxis server: port 3000 is already in use.
```

The exact wording does not need to match this example, but it must communicate the same information clearly.

Do not depend on raw Node.js error-object formatting as the only user-facing explanation.

### Other startup failures

A startup failure that is not an address-in-use condition MUST NOT be falsely reported as a port conflict.

Unexpected startup errors MUST retain useful diagnostic information and MUST result in a non-zero exit status.

Do not swallow the original failure or replace every startup error with a generic port message.

## Technical and Architectural Constraints

The implementation MUST comply with the repository architecture and development rules.

Task-specific constraints:

- keep Fastify as the server framework;
- preserve the existing separation between Fastify application construction and executable startup;
- keep startup-specific behavior in the server application rather than introducing it into shared domain packages;
- use runtime-safe error narrowing for `unknown` errors;
- do not use `any`, `@ts-ignore`, unsafe blanket assertions, or equivalent shortcuts to inspect the startup error;
- prefer a small testable startup boundary over embedding additional complex logic directly in top-level module execution;
- do not introduce platform-specific process-management logic;
- do not introduce a new logging abstraction merely for this task;
- do not introduce a new configuration abstraction merely to make the startup code testable.

The implementation may refactor the startup code into a focused function or module when that improves testability, provided the executable behavior and scope remain narrow.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/server/src/index.ts
apps/server/src/
apps/server/test/
```

A focused startup module and corresponding test file MAY be introduced when useful.

The existing:

```text
apps/server/src/app.ts
```

should change only if required by a coherent implementation.

Do not modify unrelated packages or applications.

Do not modify any file under:

```text
docs/tasks/
```

## Dependencies

Expected dependency policy for this task:

- reuse existing repository and Node.js capabilities;
- no new third-party dependency is expected;
- add a new dependency only if the task genuinely cannot be implemented cleanly with existing capabilities;
- if a dependency is added or updated, select its version from current registry metadata at execution time;
- use the newest stable, non-deprecated, mutually compatible release by default;
- evaluate the current stable major release rather than defaulting to a familiar older major;
- do not use prerelease or deprecated releases unless this task explicitly requires them;
- do not bypass compatibility problems using forced installs, ignored peer-dependency errors, or speculative overrides;
- follow the detailed dependency rules in `docs/development/coding-guidelines.md`;
- report every new dependency and every intentional version exception in the final response.

Task-specific dependency requirements:

```text
None expected.
```

If current registry metadata must be consulted because dependencies change and that metadata cannot be inspected, do not guess versions from memory. Report the limitation.

## Testing Requirements

Add automated regression coverage for the startup port-conflict behavior.

The tests MUST verify that:

- an address-in-use startup failure is recognized correctly;
- the resulting human-readable diagnostic identifies that the port is already in use;
- the diagnostic contains the affected port number;
- the failure path produces or preserves a non-zero exit outcome;
- an unrelated startup error is not incorrectly classified as a port conflict.

At least one test MUST exercise the behavior corresponding to an actual occupied local port, unless there is a concrete technical reason why a deterministic lower-level test provides stronger and safer coverage.

If a real port collision is used:

- do not assume that port `3000` is free or occupied on the test machine;
- obtain a temporary local port deterministically through the operating system;
- occupy that port for the duration of the test;
- attempt startup against that same port;
- release all resources in cleanup;
- do not depend on an external service or network resource.

Tests MUST be deterministic and MUST NOT leave a listening socket or server process behind after completion.

Existing server tests, including the in-process `/health` test, MUST continue to pass.

Tests MUST follow:

```text
docs/development/testing.md
```

Do not weaken, skip, or delete existing tests merely to make this task pass.

## Documentation Requirements

No repository documentation change is expected.

If implementation makes an existing non-task document factually inaccurate, update that owning document narrowly.

Do not modify task artifacts under:

```text
docs/tasks/
```

## Verification

Run the focused server test suite:

```bash
pnpm --filter @planaxis/server test
```

Then run the standard repository verification:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If dependency manifests or `pnpm-lock.yaml` change, also run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

`pnpm outdated --recursive` does not need to produce empty output when a newer release is incompatible. Every intentionally unselected newer stable release must instead have an explicit, evidence-backed compatibility justification.

Review the final repository state using read-only Git inspection permitted by `AGENTS.md`.

Do not report a verification step as successful unless it actually completed successfully.

If a required command cannot be run, report the exact command and reason.

## Acceptance Criteria

This task is complete only when all applicable criteria are satisfied:

1. starting the server on an available port continues to work;
2. the production default host remains `0.0.0.0`;
3. the production default port remains `3000`;
4. an address-in-use startup failure produces a clear human-readable diagnostic;
5. the diagnostic explicitly communicates that the port is already in use;
6. the diagnostic contains the affected port number;
7. the address-in-use condition results in a non-zero process exit outcome;
8. unrelated startup failures are not misreported as port conflicts;
9. automated regression coverage protects the occupied-port behavior;
10. tests do not assume that port `3000` has any particular availability state;
11. tests clean up all local server or socket resources they create;
12. the existing `/health` behavior remains unchanged;
13. no new configuration system, automatic port fallback, retry mechanism, or process-management behavior is introduced;
14. no unnecessary dependency is added;
15. `pnpm --filter @planaxis/server test` passes;
16. `pnpm lint` passes;
17. `pnpm typecheck` passes;
18. `pnpm test` passes;
19. `pnpm build` passes;
20. architecture and package boundaries remain intact;
21. no unrelated changes are introduced;
22. no out-of-scope functionality is implemented.

If dependencies are added or updated, acceptance additionally requires that:

- current registry metadata was inspected for every changed direct dependency;
- no selected direct dependency is prerelease or deprecated unless explicitly required;
- the newest mutually compatible stable release was selected, or an evidence-backed exception was documented;
- package manifests and `pnpm-lock.yaml` represent the same reviewed dependency set;
- `pnpm install --frozen-lockfile` succeeds.

## Final Response

When finished, provide a concise execution report containing:

1. a summary of the startup-error handling implementation;
2. the main files or areas changed;
3. the exact behavior for an occupied server port;
4. tests added or updated;
5. verification commands actually run and their results;
6. dependency versions added or updated, or confirmation that no dependencies changed;
7. deviations from this task description, or `None`;
8. follow-up work identified during execution, or `None`;
9. a suggested Conventional Commits message that includes:

```text
Task: TASK-002
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```