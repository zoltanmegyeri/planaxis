# Contributing to PlanAxis

Thank you for your interest in contributing to **PlanAxis**.

PlanAxis is an open-source project for deterministic apartment modeling, validation, 3D visualization, and later AI-assisted redesign based on the Apartment SVG format.

Contributions are welcome in areas such as:

- Apartment SVG parsing;
- schema, referential, geometric, and topological validation;
- exact geometry utilities;
- renderer-independent 2D and 3D domain models;
- Three.js visualization;
- browser and server applications;
- tests and fixtures;
- documentation;
- examples;
- performance improvements;
- bug fixes;
- accessibility and developer experience.

Before contributing, please read the relevant project documentation and keep changes focused, testable, and consistent with the existing architecture.

---

## 1. Repository Language

**English is mandatory for repository contributions.**

Use English for:

- source code;
- identifiers;
- comments;
- documentation;
- tests;
- fixture descriptions;
- issue and pull-request content;
- commit messages;
- developer-facing validation and error messages.

Localized user-facing resources may use other languages when localization is explicitly part of the contribution.

---

## 2. Read Before You Change Code

Before making a substantive change, read the documents relevant to your work.

Start with:

```text
README.md
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/development/agent-task-workflow.md
```

For Apartment SVG behavior, the normative specification is:

```text
docs/specifications/apartment-svg/2.1.md
```

For established architectural decisions, review:

```text
docs/decisions/
```

The Apartment SVG specification is normative for format semantics. Implementation convenience is not a reason to reinterpret, weaken, or silently extend it.

---

## 3. Development Philosophy

PlanAxis is built around a few non-negotiable engineering principles:

- Apartment SVG is the canonical external model;
- validation must complete before 3D model generation;
- authoritative geometry uses exact decimal arithmetic;
- parser, validator, domain, renderer, and HTTP responsibilities remain separated;
- renderer-independent models must not depend on Three.js;
- invalid input must produce validation errors rather than guessed or silently repaired geometry;
- deterministic domain logic should be reusable between browser and server environments where practical.

Contributions should preserve these boundaries unless the change explicitly proposes an architectural revision.

---

## 4. Repository Structure

The repository is organized as a pnpm workspace monorepo.

The repository is organized around areas such as:

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

Exact package boundaries may evolve, but architectural responsibilities should remain clear.

`docs/tasks/` contains formal coding-agent task artifacts and shared task-process documentation. It is part of the repository history rather than an implementation package.

Do not move behavior across boundaries merely for convenience.

---

## 5. Setting Up the Development Environment

The repository bootstrap is designed around:

```text
Node.js 24 LTS
pnpm
TypeScript
```

Install a fresh checkout with:

```bash
pnpm install
```

Use these standard repository verification commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Always prefer the actual scripts defined by the repository over assumptions in this document.

If the tooling changes, this document should be updated together with the change.

---

## 6. Choosing What to Work On

Good contributions are focused and have a clear purpose.

Examples:

- fix one validator rule;
- add support for one documented Apartment SVG construct;
- add a missing regression fixture;
- improve one package API;
- add a documented example;
- fix a rendering adapter bug;
- improve one section of the documentation.

Avoid combining unrelated changes into one pull request.

For larger work, open or discuss an issue first when practical so the intended direction can be agreed before substantial implementation effort is spent.

Before implementation begins, decide whether the work will be **human-owned** or **fully delegated to a coding agent**. If the latter, follow the formal Mode B workflow defined in `docs/development/agent-task-workflow.md`.

---

## 7. Issues

When reporting a bug, include enough information to reproduce it.

Useful information includes:

- what you expected;
- what happened;
- relevant PlanAxis version or commit;
- relevant Apartment SVG version;
- minimal Apartment SVG input when applicable;
- validation errors or error codes;
- operating system and runtime information when relevant;
- steps to reproduce.

Prefer minimal reproducible examples.

When reporting a validator issue, identify the relevant specification rule or section when possible.

Do not include private apartment data, credentials, API keys, personal file paths, or other sensitive information.

---

## 8. Feature Proposals

A feature proposal should explain:

- the problem being solved;
- the expected user or developer benefit;
- whether the feature affects Apartment SVG semantics;
- whether it affects architecture or only implementation;
- likely compatibility impact;
- any relevant alternatives.

Do not implement undocumented extensions to Apartment SVG as ordinary feature work.

If a proposal requires changing the format, treat it as a specification change.

---

## 9. Apartment SVG Specification Changes

Changes to Apartment SVG are different from ordinary implementation changes.

The current normative specification is versioned independently from PlanAxis.

A specification change may require:

- a clear problem statement;
- updated normative documentation;
- versioning analysis;
- compatibility analysis;
- parser changes;
- validator changes;
- updated fixtures;
- updated examples;
- updated architecture or ADR documentation where relevant.

Do not modify:

```text
docs/specifications/apartment-svg/
```

as a side effect of making existing code easier to implement.

If implementation and specification disagree, first determine whether the implementation is wrong or whether a deliberate specification revision is required.

---

## 10. Architectural Changes

Significant architectural changes should be documented with an ADR.

Examples include:

- replacing the primary runtime or framework;
- adding another geometry engine;
- changing the authoritative numeric representation;
- changing the canonical persistence model;
- introducing a new cross-cutting infrastructure pattern;
- moving renderer-specific concepts into core domain packages;
- splitting or merging major architectural responsibilities.

Architecture documentation describes the current system.

ADRs explain why significant decisions were made.

For an accepted architectural change, update both where appropriate.

---

## 11. Coding Guidelines

Follow:

```text
docs/development/coding-guidelines.md
```

Important expectations include:

- use TypeScript;
- keep strict typing;
- avoid unnecessary `any`;
- treat untrusted input as untrusted;
- use exact decimal arithmetic for authoritative geometry;
- do not convert authoritative geometry through JavaScript `number`;
- use domain terminology consistently;
- keep modules focused;
- avoid speculative abstractions;
- avoid hidden global dependencies;
- do not log directly from core domain libraries;
- keep environment-specific APIs out of shared core packages;
- avoid circular dependencies.

Do not weaken compiler or lint rules merely to make new code pass.

---

## 12. Testing Requirements

Follow:

```text
docs/development/testing.md
```

Behavior changes should normally include automated test coverage.

For parser and validator work, test both:

```text
valid input
invalid input
```

where relevant.

For Apartment SVG rules, prefer focused fixtures under:

```text
fixtures/valid/
fixtures/invalid/
```

An invalid fixture should ideally violate one primary rule so that the expected failure remains unambiguous.

Bug fixes should include regression tests when practical.

Do not make tests pass by:

- deleting the failing test;
- weakening assertions;
- skipping coverage;
- widening geometric tolerances without normative justification;
- accepting invalid fixtures;
- changing expected validation codes arbitrarily.

---

## 13. Examples vs. Fixtures

The repository distinguishes two purposes.

### `fixtures/`

Used by automated tests.

Fixtures may be:

- minimal;
- synthetic;
- intentionally malformed;
- intentionally invalid.

### `examples/`

Used by people learning or demonstrating PlanAxis.

Examples should normally be:

- valid;
- understandable;
- documented;
- suitable for public use.

Do not use large user-facing examples as a substitute for focused test fixtures.

---

## 14. Dependencies

Before adding a dependency:

1. verify that the required capability is not already available;
2. confirm that the dependency is necessary for the current change;
3. prefer a focused and actively maintained package;
4. consider whether the dependency affects architecture;
5. keep specialized dependencies behind appropriate boundaries;
6. select the version using current registry information rather than memory or an old template;
7. prefer the newest stable, non-deprecated release that is mutually compatible with the repository.

Do not remain on an older major version merely because it is familiar.

Do not introduce prerelease, beta, release-candidate, canary, nightly, `next`, or deprecated dependency versions unless the contribution explicitly requires them.

If the newest stable release is incompatible, use the newest mutually compatible stable version and document the concrete compatibility reason and supporting source.

For detailed version-selection, declaration, workspace-consistency, and verification rules, follow:

```text
docs/development/coding-guidelines.md
```

Do not introduce a second framework or competing core implementation casually.

Examples that require architectural justification include:

- another HTTP framework;
- another decimal library;
- another geometry engine;
- a dependency-injection container;
- an event bus;
- a plugin framework;
- a second renderer abstraction.

---

## 15. Commit Messages

PlanAxis uses **Conventional Commits**.

Use the format:

```text
<type>[optional scope]: <description>
```

Examples:

```text
feat(validator): validate hinged door geometry
fix(parser): preserve decimal attribute values
docs(architecture): document renderer boundary
test(validator): add invalid window fixtures
refactor(geometry): centralize tolerance comparisons
chore(repo): configure workspace tooling
```

Common types include:

```text
feat
fix
docs
test
refactor
perf
build
ci
chore
```

Use a concise imperative description.

A longer body is encouraged when the change benefits from additional context.

Example:

```text
fix(validator): reject invalid door hinge positions

Validate hinged door endpoints against the supporting wall centerline
and opening bounds using the normative geometric tolerance.
```

Breaking changes must follow the Conventional Commits breaking-change syntax when applicable.

For implementation commits produced through a formal agent-delegated task, the final human-created commit message should identify the task using:

```text
Task: TASK-NNN
```

Example:

```text
feat(parser): implement Apartment SVG XML parsing

Parse the supported Apartment SVG structure into the raw typed
representation while preserving authoritative decimal lexemes.

Task: TASK-003
```

Do not include unrelated changes in the same commit solely to reduce commit count.

---

## 16. Branches

No strict branch naming convention is currently required.

Use short, descriptive branch names when working in a fork or feature branch.

Examples:

```text
door-validation
fix-window-overlap
docs-contributing
```

If a formal branch policy is introduced later, it should be documented here.

---

## 17. Pull Requests

A pull request should be small enough to review coherently.

A good pull request explains:

- what changed;
- why it changed;
- which specification or architectural rule is relevant;
- how the change was tested;
- whether documentation changed;
- whether an ADR or specification update is required;
- when applicable, which formal `TASK-NNN` produced the implementation.

Keep unrelated refactors out of feature and bug-fix pull requests.

If a refactor is necessary to enable a feature, keep it clearly scoped and explain the relationship.

---

## 18. Pull Request Verification

Before opening or updating a pull request, run the repository verification commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If a required check cannot be run, state clearly in the pull request:

- which check was not run;
- why it was not run.

Do not claim that checks passed unless they were actually executed.

CI is expected to run the same repository-level verification.

---

## 19. Documentation Changes

Update documentation when a contribution changes:

- public behavior;
- domain contracts;
- architecture;
- setup instructions;
- contributor workflow;
- formal agent-task workflow;
- Apartment SVG semantics;
- examples;
- important developer conventions.

Do not duplicate large blocks of documentation in multiple places.

Update the document that owns the relevant rule and link to it elsewhere.

---

## 20. Code Review Expectations

Reviewers should evaluate more than whether the code works.

Important review questions include:

- does the behavior match the Apartment SVG specification?
- are domain and renderer concerns still separated?
- is authoritative geometry still exact-decimal based?
- are invalid inputs rejected rather than guessed or repaired?
- are package dependencies flowing in the correct direction?
- is the API appropriately typed?
- are the tests meaningful and deterministic?
- are new dependencies justified?
- were new or updated dependency versions selected from current registry metadata?
- are dependency versions the newest mutually compatible stable releases, or is an exception documented with evidence?
- is an ADR required?
- is the documentation still accurate?

Contributors are expected to respond to review feedback constructively and keep follow-up changes focused.

---

## 21. Development Modes and AI-Assisted Contributions

AI-assisted development is allowed.

Before implementation begins, a contributor must distinguish between two development modes:

```text
Mode A — Human-Owned Development
Mode B — Agent-Delegated Task Execution
```

The detailed process is defined in:

```text
docs/development/agent-task-workflow.md
```

That document is the authoritative source for the human workflow. Do not duplicate or reinterpret its lifecycle rules in pull requests or task descriptions.

### Mode A — Human-Owned Development

Use Mode A when the human contributor owns the implementation.

The contributor may use AI for:

- discussion;
- explanations;
- code review;
- isolated code suggestions;
- completion;
- debugging ideas;
- test ideas;
- other assistive work.

Formal task artifacts are not required merely because AI was used.

AI-assisted code accepted and integrated under Mode A is treated as part of the human contributor's own implementation.

The contributor remains responsible for understanding and reviewing the submitted result.

### Mode B — Agent-Delegated Task Execution

Use Mode B when a complete, explicitly scoped unit of repository implementation work is delegated to a coding agent.

Mode B requires a formal task under:

```text
docs/tasks/
```

with:

```text
TASK-NNN-record.md
TASK-NNN-description.md
```

The task artifacts must conform to:

```text
docs/tasks/TASK-RECORD-SPECIFICATION.md
```

The task description should be prepared using:

```text
docs/tasks/TASK-DESCRIPTION-TEMPLATE.md
```

A contributor choosing Mode B must follow the complete lifecycle in:

```text
docs/development/agent-task-workflow.md
```

This includes the required separation between:

```text
task preparation
task authorization
agent execution
human review
implementation commit
task finalization
```

Do not start agent execution from uncommitted task artifacts.

Do not combine task preparation, agent implementation, and task finalization into one undifferentiated commit.

### Coding-agent repository rules

Coding agents working directly in the repository must follow:

```text
AGENTS.md
```

For formal Mode B tasks, `AGENTS.md` defines agent-side requirements including:

- mandatory repository preflight;
- Git write and synchronization restrictions;
- hard-stop behavior for an unclean repository;
- restricted access under `docs/tasks/`;
- task-artifact read-only rules.

The human contributor is responsible for preparing a repository state in which those preconditions can succeed.

### Human responsibility

Regardless of mode, the contributor remains responsible for the submitted result.

AI-assisted or agent-produced changes must be reviewed for:

- correctness;
- security;
- specification compliance;
- architecture compliance;
- dependency quality;
- test coverage;
- licensing concerns;
- accidental unrelated changes.

Do not submit generated or delegated code that you have not meaningfully reviewed and understood.

---

## 22. Security and Sensitive Data

Never commit or publish:

- API keys;
- access tokens;
- credentials;
- private keys;
- passwords;
- `.env` secrets;
- personal apartment data that should remain private;
- machine-specific private paths.

Apartment SVG files contributed as fixtures or examples must be safe for public distribution.

If you discover a security issue, do not include exploit-sensitive private information in a public issue when private reporting is more appropriate.

A formal security-reporting policy may be added as the project gains deployed services and security-sensitive functionality.

---

## 23. Licensing

PlanAxis is licensed under the **Apache License 2.0**.

Contributions submitted to the repository must be compatible with the project's license.

Do not contribute source code, assets, test data, documentation, or other material that you do not have the right to redistribute under compatible terms.

Third-party code or assets must retain required notices and attribution.

If licensing is unclear, resolve it before submitting the contribution.

---

## 24. Definition of Done

A contribution is normally ready for review when:

- the change has one clear purpose;
- code follows the coding guidelines;
- Apartment SVG behavior matches the normative specification;
- architecture boundaries remain intact;
- tests cover the changed behavior;
- regression coverage exists for bug fixes where practical;
- fixtures or examples are updated when relevant;
- documentation is updated where needed;
- an ADR is included when the architecture changes significantly;
- lint, typecheck, test, and build checks pass;
- commit messages follow Conventional Commits;
- dependency additions or updates follow the current-version and compatibility rules in the coding guidelines;
- for Mode B work, the formal task lifecycle and human review requirements are satisfied;
- for completed Mode B work, implementation commits are recorded in the task record and task finalization is committed separately when practical;
- no secrets or unrelated changes are included.

---

## 25. Thank You

PlanAxis aims to combine precise geometry, strong software architecture, interactive visualization, and practical apartment redesign workflows in an open and reusable project.

Thoughtful bug reports, focused pull requests, careful tests, documentation improvements, and architectural discussions are all valuable contributions.
