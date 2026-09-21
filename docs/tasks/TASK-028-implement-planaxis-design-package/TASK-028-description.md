# TASK-028: Implement the PlanAxis Design Package

## Context

PlanAxis Design Format 1.0 is now the normative persistent design-scenario format for Phase 2.

The format records design intent for one explicitly bound Apartment SVG architecture. Version 1.0 supports optional finish assignments and optional presentation overrides while deliberately excluding material semantics, renderer serialization, filesystem access, and browser/server lifecycle behavior.

This task establishes the shared renderer-independent `@planaxis/design` package that later server and browser tasks will build on.

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
docs/decisions/ADR-001-typescript-monorepo.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/decisions/ADR-004-filesystem-backed-projects.md
```

Do not browse other task records or task descriptions under `docs/tasks/`.

## Goal

Add a reusable `@planaxis/design` workspace package that implements the pure, renderer-independent PlanAxis Design Format 1.0 model, JSON parsing and validation, and architecture/finish-target resolution primitives required by later Phase 2 integration.

## Scope

The task includes:

- create the `@planaxis/design` package following existing workspace/package conventions;
- model trusted Design Format 1.0 data and its optional `finishes` and `presentation` sections;
- parse untrusted JSON text and validate Design Format 1.0 content and descriptor-path conformance;
- validate project-relative architecture and material-reference syntax required by the design specification;
- validate all Version 1.0 finish-target lexical forms and reject duplicate finish assignments;
- provide pure architecture-resolution behavior that enforces exact architecture binding and detects unresolved/stale finish targets against the derived architectural surface target set;
- expose deliberate public APIs and structured validation/resolution failures;
- add focused automated tests;
- update current architecture/README documentation where the new implemented package makes existing implementation-status text inaccurate.

## Out of Scope

The task explicitly does **not** include:

- filesystem discovery, reading, creation, writing, or atomic replacement of design files;
- server routes or project-serving APIs;
- React state, UI, scenario selection, creation, or editing workflows;
- loading or validating Apartment SVG files inside `@planaxis/design`;
- material-resource existence checks, material parsing, material semantics, or material rendering;
- conversion of persisted finish assignments into `RuntimePbrMaterial`;
- renderer integration or application of presentation overrides;
- persistent active-design state;
- duplicate, delete, rename, move, or rebind workflows;
- environment, furniture/object, lighting, or post-processing schema additions;
- changes to the accepted Design Format 1.0 specification.

## Functional Requirements

The implementation MUST conform to `docs/specifications/planaxis-design/1.0.md`.

In particular:

- Design JSON MUST be treated as untrusted until validated.
- The trusted model MUST preserve the descriptor's project-relative path as its external identity without adding a serialized internal ID.
- Descriptor paths MUST satisfy Design Format 1.0 location rules under `designs/` and use a lowercase `.json` suffix.
- The root object and all nested Version 1.0 objects MUST be closed.
- `schema`, `name`, and `architecture` MUST be required and validated exactly as specified.
- `finishes` and `presentation` MUST be optional, but when present MUST be non-empty and valid.
- Architecture references MUST be valid project-relative paths under `architecture/` with the required lowercase `.svg` suffix.
- Material references MUST be valid project-relative paths under `assets/materials/`; their existence and contents MUST NOT be checked.
- Finish-target strings MUST be validated against the complete Version 1.0 lexical grammar, including Apartment SVG `Id` lexical rules.
- Duplicate finish assignments for the same target MUST be rejected.
- `toneMapping` MUST accept exactly `agx`, `aces-filmic`, or `neutral`.
- `exposureEv` MUST accept any finite JSON number; current browser slider limits MUST NOT become format limits.
- Ordinary JavaScript/TypeScript numbers MUST be used for design numeric data; `Decimal` MUST NOT be introduced for Design Format values.
- Architecture resolution MUST remain separate from Design Format conformance. It MUST:
  - require the caller-provided architecture identity to match the descriptor's bound architecture exactly;
  - check finish assignments against the finish targets derived from that architecture;
  - report syntactically valid but missing targets as unresolved/stale references rather than malformed Design JSON.
- Normal validation and resolution failures MUST be represented as structured expected outcomes rather than collapsed into generic exceptions.

## Technical and Architectural Constraints

`@planaxis/design` is a pure shared domain/format package.

It MAY depend on renderer-independent workspace packages needed for the contract, including `@planaxis/model-3d` for finish-target types or architectural surface data.

It MUST NOT depend on:

```text
apps/server
apps/web
@planaxis/renderer-three
Node.js filesystem APIs
React
Three.js
```

The package MUST NOT acquire project-root or filesystem-security responsibility. Later server integration remains responsible for resolving paths through the project filesystem boundary and for loading the referenced Apartment SVG.

The package MUST NOT duplicate architectural geometry or treat design data as a second architectural source of truth.

Do not extract or redesign unrelated server project-path infrastructure in this task. Design-format lexical/path validation may be implemented locally according to the normative specifications.

No new third-party runtime dependency is expected for this task. Add one only if a concrete need is demonstrated and the repository dependency rules are followed.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/design/
README.md
docs/architecture/overview.md
pnpm-lock.yaml
```

Other workspace configuration may change only as required by the established monorepo conventions.

Do not modify any file under:

```text
docs/tasks/
```

Do not modify `docs/specifications/planaxis-design/1.0.md` as part of implementation.

## Dependencies

Expected dependency policy for this task:

- reuse existing repository dependencies and renderer-independent workspace packages;
- no new third-party runtime dependency is expected;
- use the existing Vitest catalog for package tests;
- if any dependency manifest or lockfile changes, follow the dependency-verification requirements in `docs/development/coding-guidelines.md`.

## Testing Requirements

Add focused automated tests covering at least:

- minimal and complete valid Design 1.0 descriptors;
- descriptor-path validation under `designs/`;
- required fields, closed-object behavior, and non-empty `name`;
- architecture path restrictions and lowercase `.svg` requirement;
- optional/non-empty `finishes` and `presentation`;
- every supported finish-target family plus representative malformed target forms;
- duplicate finish-target rejection;
- valid material paths and invalid/out-of-scope project-relative paths;
- all supported tone-mapping values and invalid values;
- finite exposure values, including values outside the current browser UI range;
- exact architecture-binding success and mismatch;
- successful finish-target resolution;
- stale/unresolved finish-target reporting;
- the distinction between structural validity and architecture resolution.

Tests MUST be deterministic and require no filesystem, browser, GPU, or network access.

## Documentation Requirements

Update only documentation made inaccurate by implementing the package.

At minimum, review and update as needed:

```text
README.md
docs/architecture/overview.md
```

Keep Design Format 1.0 semantics in the normative specification rather than duplicating them extensively.

## Verification

Run:

```bash
pnpm --filter @planaxis/design test
pnpm --filter @planaxis/design typecheck
pnpm --filter @planaxis/design build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Because this task adds a package manifest and may update the lockfile, also run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. `@planaxis/design` exists as a buildable, tested workspace package with a deliberate public API;
2. Design Format 1.0 JSON and descriptor paths are validated according to the normative specification;
3. trusted design data remains renderer-, filesystem-, React-, and Three.js-independent;
4. exact architecture binding and finish-target resolution are implemented as a separate pure stage;
5. stale targets are distinguishable from malformed Design Format data;
6. material references are syntax/path validated but never resolved or interpreted;
7. focused package tests cover valid, invalid, boundary, and resolution cases;
8. required repository verification passes;
9. relevant implementation-status documentation is updated without changing the specification;
10. no out-of-scope server, browser, renderer, material, or lifecycle behavior is introduced.

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
Task: TASK-028
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
