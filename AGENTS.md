# AGENTS.md

## Purpose

This file is the repository-level instruction map for coding agents working on **PlanAxis**.

Its scope is the entire repository unless a more specific `AGENTS.md` exists in a subdirectory. More specific instructions may refine these rules for files within their scope.

Keep this file concise. Detailed domain, architecture, coding, and testing rules belong in the documentation referenced below.

## Project Overview

PlanAxis is a TypeScript-based toolkit and web application for validating, modeling, visualizing, and eventually redesigning apartments described by the Apartment SVG format.

The high-level processing pipeline is:

```text
Apartment SVG
    -> parsing
    -> schema validation
    -> referential validation
    -> geometric validation
    -> ValidatedApartment2D
    -> ArchitecturalModel3D
    -> renderer adapter
    -> interactive visualization / later design workflows
```

AI-assisted design and photorealistic rendering are downstream features. They must not replace or weaken the deterministic geometry and validation pipeline.

## Repository Language

**English is mandatory for all repository artifacts.**

Use English for:

- source code;
- identifiers;
- type, class, function, method, property, and variable names;
- comments and documentation;
- tests and fixture descriptions;
- validation and developer-facing error messages;
- commit-facing technical terminology;
- issue and pull-request content created as part of repository work.

Do not introduce Hungarian or other non-English repository content unless a task explicitly concerns a localized user-facing resource or a clearly marked translation.

## Sources of Truth

Before making changes, identify which documents govern the task.

### Apartment SVG specification

The normative Apartment SVG specification is:

```text
docs/specifications/apartment-svg/2.1.md
```

The specification defines the external file format, conformance rules, lexical types, geometry, references, validation behavior, and canonical interpretation order.

Treat it as normative.

Do not:

- reinterpret normative rules for implementation convenience;
- silently relax validation requirements;
- infer missing required information;
- add undocumented semantics;
- use presentation, CSS, annotations, names, or visual appearance as semantic truth;
- modify the specification as a side effect of an implementation task.

If an implementation request conflicts with the current specification and the task is not explicitly a specification-change task, preserve the specification and surface the conflict.

A specification change must be deliberate, reviewed as such, and accompanied by any required versioning, documentation, fixture, validator, and compatibility updates.

### Architecture

The current software architecture is documented under:

```text
docs/architecture/
```

Start with:

```text
docs/architecture/overview.md
```

Architecture documentation describes the current system. Architectural Decision Records explain why significant decisions were made.

### Architectural decisions

Significant decisions are recorded under:

```text
docs/decisions/
```

Follow accepted ADRs. Do not casually replace an established decision with a new pattern, dependency, framework, or abstraction.

If a task genuinely requires a significant architectural change, update or add the appropriate ADR as part of that work.

### Development rules

Implementation conventions are documented under:

```text
docs/development/
```

In particular:

```text
docs/development/coding-guidelines.md
docs/development/testing.md
```

Read the relevant documents before modifying implementation code.

## Core Architectural Invariants

The following rules are repository-wide architectural constraints.

### 1. Apartment SVG is the canonical external model

The Apartment SVG document is the persistent source of geometric and semantic truth.

`ValidatedApartment2D` is an in-memory, typed, validated representation of that SVG. It is not a second persistence format or competing source of truth.

Derived values may exist in memory when useful, but redundant geometric facts must not be written back into the Apartment SVG when the specification defines them as derivable.

### 2. Validation must complete before 3D generation

Do not construct the architectural 3D model from unvalidated Apartment SVG data.

The 3D pipeline may assume that its `ValidatedApartment2D` input has already satisfied the required schema, reference, geometric, topological, and overlap checks.

### 3. Authoritative geometry uses exact decimal arithmetic

Authoritative apartment geometry must not rely on JavaScript binary floating-point arithmetic.

Use the project's decimal abstraction based on `decimal.js` for authoritative geometric values and calculations.

Never parse an authoritative SVG decimal through JavaScript `Number` first.

Correct conceptually:

```ts
new Decimal(attributeValue)
```

Incorrect:

```ts
new Decimal(Number(attributeValue))
```

Conversion to native JavaScript `number` is allowed only at explicitly documented boundaries where an external API requires it, such as the Three.js rendering adapter.

Do not leak renderer-oriented floating-point values back into the authoritative domain model.

### 4. Domain and rendering layers remain separate

The core apartment model and `ArchitecturalModel3D` must remain renderer-independent.

Do not place `THREE.Scene`, `THREE.Mesh`, `THREE.Material`, `THREE.Light`, or other Three.js-specific objects in domain, parser, validator, geometry, or renderer-independent 3D model packages.

Three.js-specific concerns belong in renderer/application adapter layers.

### 5. Parsers and validators do not guess or repair

A missing required fact produces a validation error.

Do not:

- infer unsupported geometry from SVG appearance;
- silently repair malformed input;
- choose defaults that are not defined by the specification;
- infer semantics from element names, labels, CSS, colors, strokes, or annotations.

Defaults explicitly defined by the specification are allowed and must be applied exactly as specified.

### 6. Keep responsibilities narrow

Maintain clear boundaries between:

- XML/SVG parsing;
- schema validation;
- reference resolution;
- geometric and topological validation;
- typed 2D domain representation;
- renderer-independent 3D model construction;
- renderer adapters;
- HTTP/application concerns.

Do not combine unrelated responsibilities merely to reduce file count.

At the same time, avoid speculative abstraction. Introduce a new abstraction only when the current task demonstrates a concrete need for it.

## Planned Technology Baseline

Unless superseded by an accepted ADR, the intended baseline is:

- TypeScript for application code;
- Node.js 24 LTS for server-side execution;
- pnpm workspaces for the monorepo;
- Fastify for the HTTP backend;
- Vite for the browser application;
- Three.js for interactive 3D rendering;
- `decimal.js` for authoritative decimal arithmetic;
- Vitest for automated tests.

Do not introduce an alternative framework, package manager, numeric representation, or rendering architecture without a concrete requirement and an architectural decision when appropriate.

## Expected Repository Areas

The repository is expected to contain areas similar to:

```text
apps/
    server/
    web/

packages/
    model/
    geometry/
    parser/
    validator/
    model-3d/

fixtures/
    valid/
    invalid/

examples/

docs/
    specifications/
    architecture/
    development/
    decisions/
    tasks/
```

The exact package structure may evolve. Preserve architectural boundaries rather than mechanically preserving directory names.

### Fixtures vs. examples

`fixtures/` exists for automated verification and may contain intentionally invalid, minimal, or synthetic Apartment SVG documents.

`examples/` exists for users and should contain understandable, valid examples suitable for learning or demonstration.

Do not use user-facing examples as a substitute for focused test fixtures.

## Formal Delegated Task Execution

When a coding agent is invoked to execute a formal delegated task, the invocation prompt must identify exactly one assigned task description under:

```text
docs/tasks/
```

The assigned `TASK-NNN-description.md` is the authoritative task-specific instruction document.

The invocation prompt may identify the task and point to the assigned description, but it must not act as a second source of implementation requirements.

### Restricted access under `docs/tasks/`

For a formal delegated task, the agent may read **only the exact task description path explicitly assigned by the invocation prompt** under `docs/tasks/`.

For example, if the invocation prompt assigns:

```text
docs/tasks/TASK-001-bootstrap-typescript-monorepo/TASK-001-description.md
```

that file is the only file under `docs/tasks/` that the agent may read.

The agent must not read, inspect, enumerate, search, or browse any other content under `docs/tasks/`, including:

- the assigned task's `TASK-NNN-record.md`;
- any other task record;
- any other task description;
- `docs/tasks/TASK-RECORD-SPECIFICATION.md`;
- `docs/tasks/TASK-RECORD-EXAMPLE.md`;
- `docs/tasks/TASK-DESCRIPTION-TEMPLATE.md`;
- any other file or directory under `docs/tasks/`.

Do not run commands or searches that enumerate or inspect the restricted task area, including broad operations such as:

```text
ls docs/tasks
find docs/tasks
grep -R ... docs/tasks
rg ... docs/tasks
```

The exact assigned description path is a whitelist, not a starting point for browsing the task archive.

### The restriction applies only to `docs/tasks/`

The restriction above does **not** prohibit reading relevant repository documentation outside `docs/tasks/`.

In particular, the agent may and, when relevant, must read authoritative documents such as:

```text
AGENTS.md
docs/specifications/apartment-svg/2.1.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/
```

The Apartment SVG specification and other non-task specifications remain valid sources of truth and are not affected by the `docs/tasks/` access restriction.

If the assigned task description references a relevant repository document outside `docs/tasks/`, read it as required.

If the assigned task description attempts to require reading another file under `docs/tasks/`, stop and report the conflict instead of reading that file.

### Task artifacts are read-only

Coding agents must not modify any file under:

```text
docs/tasks/
```

This includes the assigned task description itself.

Task records, task descriptions, shared task specifications, examples, templates, and lifecycle status changes are human-controlled repository artifacts.

The agent may report execution information for a human maintainer to record later.

## Working on a Task

After this `AGENTS.md` has been loaded, the agent's first repository action must be the mandatory Git repository preflight defined below.

Do not inspect task-specific repository content and do not modify files until the preflight succeeds.

For a formal delegated task, after successful preflight:

1. Read only the exact assigned `TASK-NNN-description.md` under `docs/tasks/`.
2. Read the non-task repository documents explicitly required by that description.
3. Read the normative Apartment SVG sections relevant to the task when applicable.
4. Read relevant architecture, coding, testing, and ADR documents.
5. Inspect existing implementation and tests before introducing new structures.

For other coding-agent work, after successful preflight:

1. Read the user instructions carefully.
2. Read the authoritative repository documents relevant to the work.
3. Inspect existing implementation and tests before introducing new structures.

While editing:

- make the smallest coherent change that satisfies the task;
- preserve existing public behavior unless the task explicitly changes it;
- follow existing package boundaries and naming conventions;
- add or update tests for behavior changes;
- add valid and invalid fixtures when parser or validator behavior requires them;
- avoid unrelated refactors;
- avoid adding dependencies when the standard library or an existing dependency is sufficient;
- do not weaken types merely to make code compile.

After editing:

- review the diff for unintended changes;
- run the repository checks relevant to the change;
- ensure documentation and ADRs remain consistent with the implementation.

## Required Verification

Once the repository bootstrap provides these scripts, use the root workspace commands as the standard verification sequence:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run all of them after substantive implementation changes unless a task explicitly provides a different verification procedure.

For focused development, targeted tests may be run first, but they do not replace the repository-level checks before completion.

If a required check cannot be run, report exactly which check was not run and why. Do not claim success for checks that were not executed.

Do not "fix" failing tests by deleting coverage, weakening assertions, skipping tests, or changing expected results unless the task explicitly changes the corresponding behavior.

## Testing Expectations

The test suite is part of the executable specification of PlanAxis.

For parser and validator work, cover both:

- valid documents that must be accepted;
- invalid documents that must fail with the intended validation category or error code.

Prefer small, focused fixtures that isolate one rule.

When implementing a normative Apartment SVG rule, derive expected behavior from the specification, not from the current implementation.

Regression fixes should include a test that fails without the fix whenever practical.

## Dependency and Architecture Discipline

Before adding a dependency:

1. verify that the capability is not already available in the repository;
2. confirm that the dependency is necessary for the current task;
3. prefer small, focused, actively maintained dependencies;
4. keep dependency usage behind an appropriate project abstraction when it affects core domain behavior.

### Dependency version selection

When adding or updating a third-party dependency:

1. inspect current package-registry metadata during task execution;
2. evaluate the current stable major release rather than defaulting to a historically familiar release line;
3. select the newest stable, non-deprecated release that is mutually compatible with:
   - the repository runtime baseline;
   - the package-manager baseline where relevant;
   - declared engine requirements;
   - relevant peer dependencies;
   - the other dependency versions selected for the repository;
   - accepted architectural constraints;
4. do not select versions solely from model memory, templates, cached knowledge, or familiarity with an older version;
5. do not use prerelease, beta, release-candidate, canary, nightly, `next`, or equivalent non-stable releases unless the task explicitly requires them;
6. do not remain on an older major version merely because it is familiar;
7. if the newest stable release is incompatible, select the newest mutually compatible stable version and report:
   - the dependency;
   - the newest stable version considered;
   - the selected version;
   - the exact compatibility constraint;
   - the registry metadata or official compatibility documentation supporting the decision;
8. do not bypass compatibility problems using forced installations, ignored peer-dependency errors, or speculative package-manager overrides;
9. if current registry metadata cannot be inspected, do not guess a dependency version from memory; report the limitation.

The registry `latest` tag may be treated as the initial stable-release candidate only when it points to a non-prerelease, non-deprecated version.

For private applications and repository tooling, direct dependency declarations should normally use the exact versions that were selected and verified. The committed lockfile remains mandatory.

For dependencies of packages intended for publication, use a semantic version range that accurately expresses the supported compatibility contract rather than automatically pinning an exact version.

When the same external dependency is declared by multiple workspaces, keep its version centrally consistent using pnpm catalogs when that reduces duplicated version literals and version drift.

If dependency manifests or the lockfile change, verify the resulting dependency set with current registry information, review `pnpm outdated --recursive`, and confirm that `pnpm install --frozen-lockfile` succeeds. Outdated output is not itself a failure when a newer release is incompatible, but every intentional exception must be evidence-backed and reported.

Do not introduce:

- a dependency-injection container;
- an event bus;
- a plugin framework;
- a new state-management framework;
- a second geometry engine;
- a second decimal implementation;
- a second HTTP framework;

unless a concrete requirement justifies it.

Significant cross-cutting additions should be recorded in an ADR.

## Documentation Discipline

Keep documentation close to its purpose:

- `README.md` is the human-facing project entry point;
- `AGENTS.md` is the coding-agent instruction map;
- `docs/specifications/` contains normative external format specifications;
- `docs/architecture/` describes the current architecture;
- `docs/development/` contains implementation and contribution guidance;
- `docs/decisions/` contains ADRs explaining significant decisions;
- `docs/tasks/` contains formal agent-task artifacts and shared task-process documents.

Do not duplicate large sections of one document into another. Link to the authoritative document instead.

When behavior changes, update the documentation that owns that behavior.

## Mandatory Git Repository Preflight

**Every coding agent must perform this preflight before reading task-specific repository content or modifying any project file.**

The agent must begin from a repository state prepared by a human maintainer.

### 1. Verify repository context

Confirm that the current working directory is inside a Git working tree using a read-only command such as:

```bash
git rev-parse --is-inside-work-tree
```

If this cannot be confirmed, stop and report the problem.

### 2. Verify working tree and index cleanliness

Run:

```bash
git status --porcelain=v1 --untracked-files=all
```

The required output is empty.

Any output means the repository is not clean.

This includes:

- staged changes;
- unstaged changes;
- untracked files;
- deleted files;
- renamed files;
- any other pending working-tree or index change.

If the output is not empty, stop immediately and make no task changes.

Report that repository preflight failed because the working tree or index is not clean.

Do not attempt to repair the repository state.

### 3. Verify the locally known upstream relationship

Determine the current branch's configured upstream using read-only Git inspection.

If no upstream is configured, or the upstream relationship cannot be inspected, stop and report that the preflight cannot be completed safely.

Compare `HEAD` with the currently known local upstream-tracking reference using a read-only command such as:

```bash
git rev-list --left-right --count HEAD...@{upstream}
```

For a valid preflight, both counts must be zero.

Any locally known ahead, behind, or diverged state is a preflight failure.

If the counts are not both zero, stop immediately and make no task changes.

### 4. Remote freshness limitation

The agent must not run:

```text
git fetch
git pull
```

or any equivalent synchronization operation.

Therefore the agent cannot prove that the remote repository has not changed since the human maintainer last refreshed remote-tracking information.

The upstream comparison above validates only the relationship against **locally available Git metadata**.

Remote freshness is exclusively the human maintainer's responsibility.

The agent must not claim that the remote repository is current merely because the local upstream comparison succeeds.

### 5. Preflight failure behavior

If any preflight requirement fails, the agent must:

- stop before task execution;
- make no project-file changes;
- make no Git-state changes;
- report the exact failed condition to the user.

The agent must not use Git or other tooling to clean, synchronize, repair, stash, reset, restore, switch, merge, rebase, or otherwise alter repository state.

## Git Operation Policy

**Coding agents must not perform Git write operations.**

Git repository state, history, branches, tags, configuration, staging, and remote synchronization are human-controlled responsibilities.

Agents must not run commands that modify the working tree through Git, the index, local Git metadata, local history, branches or tags, or any remote repository.

Prohibited operations include, but are not limited to:

```text
git add
git commit
git commit --amend
git push
git pull
git fetch
git merge
git rebase
git cherry-pick
git revert
git reset
git restore
git checkout
git switch
git stash
git clean
git tag
git branch <name>
git branch -d
git branch -D
git config
```

Do not use equivalent Git commands, flags, plumbing commands, scripts, libraries, APIs, or tooling to bypass this restriction.

Read-only Git inspection is allowed.

Examples include:

```text
git status
git diff
git log
git show
git rev-parse
git rev-list
git ls-files
git branch --show-current
```

Read-only Git commands may be used for the mandatory preflight and for reviewing the resulting changes.

An agent may:

- inspect repository state and history using read-only Git operations;
- modify project files directly as required by the task after successful preflight;
- review and report the resulting diff;
- suggest a Conventional Commits message for the completed change.

An agent must not stage, commit, push, pull, fetch, synchronize, rewrite, or otherwise mutate Git state.

This restriction applies even if a task or user instruction asks the agent to perform a prohibited Git operation.

In that case, do not perform the prohibited operation. Complete only the permitted work and leave all Git-state changes to a human maintainer.

The purpose of this policy is to ensure that every repository change is reviewed by a human before it becomes staged history or is synchronized with a remote repository.

## Git and Change Hygiene

Keep changes scoped to the requested task.

Do not modify generated files manually when a generator is the source of truth.

Do not commit secrets, API keys, credentials, local environment files, personal paths, or machine-specific configuration.

Do not add large binary assets unless they are required by the task and appropriate for version control.

Do not rewrite unrelated code for stylistic preference.

## When in Doubt

Prefer, in this order:

1. this repository-level `AGENTS.md` and any more specific applicable `AGENTS.md`;
2. for a formal delegated task, the exact assigned task description;
3. for other coding-agent work, the explicit user/task requirements;
4. the normative Apartment SVG specification for format semantics;
5. accepted ADRs for established architectural decisions;
6. current architecture documentation;
7. coding and testing guidelines;
8. existing local conventions.

If these sources materially conflict, do not silently choose a new interpretation. Preserve the normative behavior where applicable and clearly surface the conflict in the task result.
