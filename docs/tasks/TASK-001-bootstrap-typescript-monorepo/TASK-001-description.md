# TASK-001: Bootstrap the PlanAxis TypeScript Monorepo

## Context

PlanAxis currently contains its core project documentation, architecture decisions, repository policies, and Apartment SVG specification, but it does not yet contain the executable TypeScript monorepo foundation.

This task establishes that foundation only.

The repository architecture has already been designed. The purpose of this task is to implement the agreed bootstrap without introducing Apartment SVG domain behavior prematurely.

The intended high-level pipeline is:

```text
Apartment SVG
→ parsing
→ schema validation
→ reference resolution / referential validation
→ geometric / topological validation
→ ValidatedApartment2D
→ ArchitecturalModel3D
→ renderer adapter
→ Three.js scene
→ interactive browser visualization
```

This task must stop before the domain-specific stages of that pipeline are implemented.

## Required Reading

Before making implementation changes, read and follow:

```text
AGENTS.md
```

Also read:

```text
README.md
CONTRIBUTING.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/specifications/apartment-svg/2.1.md
```

Use those documents as the authoritative repository context.

Do not read any other file under `docs/tasks/`.

## Goal

Bootstrap PlanAxis as a working TypeScript monorepo using pnpm workspaces, with:

- a minimal Fastify server application;
- a minimal Vite browser application;
- the planned shared package skeletons;
- strict shared TypeScript configuration;
- ESLint;
- Prettier;
- Vitest;
- root-level repository verification commands;
- a committed pnpm lockfile.

After this task, a fresh checkout with the documented Node.js and pnpm baseline must be able to install dependencies and successfully run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The result must be infrastructure only. It must not implement Apartment SVG parsing, validation, geometry, 3D modeling, rendering, or simulation behavior.

## Environment Baseline

The development baseline for this task is:

```text
Node.js 24 LTS
pnpm 11
TypeScript
```

The human maintainer's current environment is compatible with:

```text
Node.js 24
pnpm 11.24.0
```

The root package metadata should express the supported Node.js and pnpm baseline clearly.

Use pnpm workspaces as required by ADR-001.

## Required Repository Structure

Create the executable monorepo foundation around the existing repository documentation.

Required application workspaces:

```text
apps/server
apps/web
```

Required shared package workspaces:

```text
packages/model
packages/geometry
packages/parser
packages/validator
packages/model-3d
```

The package names must be:

```text
@planaxis/model
@planaxis/geometry
@planaxis/parser
@planaxis/validator
@planaxis/model-3d
```

Preserve the existing repository documentation, examples, fixtures, and other non-bootstrap content.

## Root Workspace Requirements

Create the root workspace configuration required for a pnpm TypeScript monorepo.

At minimum, add:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
```

The root `package.json` must:

- be private;
- identify the repository license as Apache-2.0;
- declare an appropriate Node.js 24 baseline;
- identify pnpm as the package manager;
- expose root scripts for:
  - `lint`;
  - `typecheck`;
  - `test`;
  - `build`;
- use workspace execution rather than duplicating workspace-specific commands unnecessarily.

The workspace configuration must include:

```text
apps/*
packages/*
```

Do not add Nx, Turborepo, or another monorepo orchestration framework unless a concrete requirement in this task cannot reasonably be satisfied with pnpm itself.

No such additional orchestration framework is expected for this bootstrap.

## TypeScript Requirements

Use TypeScript throughout the executable application and package code.

Create a shared strict TypeScript baseline in:

```text
tsconfig.base.json
```

It must enable at least:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

Workspace-specific TypeScript configurations should extend the shared baseline where appropriate.

Do not weaken strictness to avoid fixing type errors.

Do not introduce `any`, `@ts-ignore`, or equivalent shortcuts merely to make the bootstrap compile.

Choose module and resolution settings that work coherently across Node.js 24, Fastify, Vite, Vitest, and the shared packages.

Avoid unnecessary TypeScript project complexity that is not required by this initial bootstrap.

## Shared Package Skeletons

Create minimal buildable skeletons for:

```text
@planaxis/model
@planaxis/geometry
@planaxis/parser
@planaxis/validator
@planaxis/model-3d
```

Each package must:

- have clear package metadata;
- contain TypeScript source;
- participate in type checking and build verification;
- expose a minimal valid module entry point.

Do not invent domain APIs merely to make the packages appear substantial.

An empty or intentionally minimal exported module surface is preferable to speculative Apartment SVG abstractions.

The package structure should make later domain implementation straightforward without prematurely implementing it now.

## Server Application

Create a minimal TypeScript Fastify application under:

```text
apps/server
```

Requirements:

- use Fastify;
- keep application construction separate enough that it can be tested in process;
- provide a minimal application entry point;
- provide at least one focused automated test proving that the Fastify application can be constructed and exercised without opening an external network port.

A minimal health-style endpoint may be used if helpful for proving the server bootstrap, but do not add unrelated HTTP API design.

Do not introduce:

- persistence;
- authentication;
- database access;
- Apartment SVG endpoints;
- business logic;
- dependency-injection frameworks.

## Web Application

Create a minimal TypeScript Vite application under:

```text
apps/web
```

Requirements:

- use Vite;
- use TypeScript;
- do not add React, Vue, Svelte, Angular, or another frontend framework;
- keep the application intentionally minimal;
- ensure it builds successfully through the root build command.

The page may contain simple bootstrap content identifying PlanAxis.

Do not implement:

- Three.js scene construction;
- apartment rendering;
- navigation controls;
- lighting controls;
- runtime simulation;
- solar calculations;
- Apartment SVG loading.

Three.js is part of the planned architecture, but it does not need to be installed in this task unless the bootstrap genuinely uses it.

## Tooling Requirements

Configure repository-wide development tooling appropriate for the monorepo.

Required:

```text
ESLint
Prettier
Vitest
```

The configuration must:

- support the TypeScript workspaces;
- be runnable from root scripts;
- avoid unnecessary framework-specific plugins;
- be compatible with the repository's strict TypeScript rules;
- produce deterministic CI-friendly commands.

Avoid excessive configuration or tooling abstraction.

## Dependency Policy

Add only dependencies that are actually used by this bootstrap.

Expected bootstrap dependencies include the packages required for:

- TypeScript;
- Fastify;
- Vite;
- Vitest;
- ESLint;
- Prettier;
- necessary TypeScript/ESLint integration.

Do not install a planned dependency merely because it will be useful in a future task.

In particular:

```text
decimal.js
three
```

may be deferred if no code in this task genuinely uses them.

If either is deferred, report that explicitly in the final response.

Do not introduce alternative packages that compete with established architectural choices.

## Testing Requirements

Follow:

```text
docs/development/testing.md
```

The bootstrap must include enough automated testing to prove that the initial executable structure works.

At minimum:

- the Fastify application must have an in-process automated test;
- the root test command must execute successfully;
- tests must not require external services or network access;
- tests must be deterministic.

Do not add fake domain tests for behavior that does not yet exist.

Do not create Apartment SVG parser or validator fixtures merely to populate the test suite.

## Documentation Requirements

Once the workspace scripts actually exist, review existing repository documentation for bootstrap-dependent wording that has become obsolete.

Update statements such as:

```text
once available
once the repository bootstrap provides these scripts
the project is expected to expose
```

when the newly implemented bootstrap makes those statements factually outdated.

Review at least:

```text
README.md
AGENTS.md
CONTRIBUTING.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
```

Only change wording that the bootstrap has made obsolete.

Do not rewrite unrelated documentation.

Do not modify any file under:

```text
docs/tasks/
```

## Out of Scope

This task must not implement any Apartment SVG domain behavior.

The following are explicitly out of scope:

- Apartment SVG XML parsing;
- schema validation;
- referential validation;
- geometric validation;
- topological validation;
- overlap validation;
- validation error catalogs;
- `ValidatedApartment2D`;
- authoritative geometry primitives;
- decimal geometry algorithms;
- EPSILON logic;
- wall modeling;
- opening modeling;
- door modeling;
- zone modeling;
- fixed-item modeling;
- utility modeling;
- camera modeling;
- `ArchitecturalModel3D`;
- renderer adapters;
- Three.js scene construction;
- Three.js meshes, materials, lights, or cameras;
- solar position calculation;
- runtime date/time controls;
- light switching or dimming;
- persistence;
- databases;
- authentication;
- authorization;
- cloud infrastructure;
- AI integration;
- plugin frameworks;
- event buses;
- dependency-injection containers;
- speculative application architecture beyond what is required for this bootstrap.

Do not create placeholder domain APIs that imply any of the above behavior has already been designed in code.

## Architectural Constraints

The bootstrap must preserve the architecture defined by:

```text
docs/architecture/overview.md
docs/decisions/ADR-001-typescript-monorepo.md
AGENTS.md
```

In particular:

- TypeScript is the shared implementation language;
- pnpm workspaces are the monorepo mechanism;
- browser and server applications remain separate;
- reusable core behavior belongs in shared packages;
- domain packages remain independent from Three.js;
- no second geometry or numeric architecture is introduced;
- no premature plugin, event-bus, or DI framework is introduced.

Because this task does not yet implement geometry, `decimal.js` integration may remain for a later task.

Because this task does not yet render apartments, Three.js integration may remain for a later task.

## Files and Areas Expected to Change

Expected new or modified areas include:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json

apps/server/
apps/web/

packages/model/
packages/geometry/
packages/parser/
packages/validator/
packages/model-3d/

ESLint configuration
Prettier configuration
Vitest configuration

README.md
AGENTS.md
CONTRIBUTING.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
```

This list is guidance rather than a requirement to modify every listed documentation file.

Do not modify unrelated files.

Do not modify:

```text
docs/tasks/
```

## Verification

After implementation, run:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also inspect the resulting repository state using read-only Git commands as permitted by `AGENTS.md`, including:

```bash
git status
git diff
```

The final agent-created working tree is expected to contain the implementation changes for human review.

Do not stage or commit them.

If any required verification command fails, investigate and fix the bootstrap when the fix remains within this task.

If a required command cannot be completed, report the exact command and reason.

## Acceptance Criteria

This task is complete only when all applicable criteria are satisfied:

1. the repository is a valid pnpm workspace monorepo;
2. `apps/server` exists as a minimal TypeScript Fastify application;
3. `apps/web` exists as a minimal TypeScript Vite application without an additional frontend framework;
4. all five planned `@planaxis/*` package skeletons exist and are buildable;
5. the root workspace contains a shared strict TypeScript configuration;
6. TypeScript enables `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`;
7. ESLint is configured and runnable from the root;
8. Prettier is configured for the repository;
9. Vitest is configured and runnable from the root;
10. the Fastify application has a passing in-process automated test;
11. `pnpm-lock.yaml` is generated and present;
12. `pnpm lint` passes;
13. `pnpm typecheck` passes;
14. `pnpm test` passes;
15. `pnpm build` passes;
16. bootstrap-dependent documentation wording made obsolete by this task is updated;
17. no Apartment SVG domain implementation is introduced;
18. no files under `docs/tasks/` are modified;
19. no prohibited Git write or synchronization operation is performed;
20. no unnecessary monorepo framework, frontend framework, DI container, event bus, plugin framework, geometry engine, or speculative abstraction is introduced.

## Final Response

When finished, provide a concise execution report containing:

1. a summary of the bootstrap implementation;
2. the main files and directories created or modified;
3. the tooling and dependency decisions made;
4. any planned dependencies intentionally deferred, especially `decimal.js` or `three`;
5. tests added;
6. documentation wording updated because the bootstrap made it obsolete;
7. the exact verification commands executed and their results;
8. deviations from this task description, or `None`;
9. follow-up work identified during execution, or `None`;
10. a suggested Conventional Commits message for the implementation commit.

The suggested commit message must include:

```text
Task: TASK-001
```

Do not perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```
