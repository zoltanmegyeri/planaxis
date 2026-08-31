# TASK-003: Establish Authoritative Decimal Geometry Foundations

## Context

TASK-001 established the initial PlanAxis TypeScript monorepo and created shared package skeletons including:

```text
@planaxis/model
@planaxis/geometry
@planaxis/parser
@planaxis/validator
@planaxis/model-3d
```

The `@planaxis/geometry` package currently contains only its bootstrap structure and has no domain implementation.

PlanAxis architecture requires authoritative apartment geometry to use exact decimal arithmetic rather than JavaScript binary floating-point arithmetic. The Apartment SVG 2.1 specification defines the normative geometric tolerance as:

```text
EPSILON = 0.01 cm
```

with geometric equality defined as:

```text
abs(a - b) <= EPSILON
```

The architecture also requires tolerance-aware geometric operations to be centralized in the geometry layer rather than reimplemented ad hoc by later validators.

The planned implementation order places numeric and geometric foundations before Apartment SVG parsing. This task establishes that foundation while deliberately avoiding parser, validator, model, 3D, and renderer behavior.

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
docs/specifications/apartment-svg/2.1.md
```

Use those documents as the authoritative repository context.

Do not read any other file under `docs/tasks/`.

## Goal

Turn `@planaxis/geometry` into the authoritative shared foundation for exact decimal apartment geometry.

The completed package must provide:

- a deliberate project-facing decimal API based on `decimal.js`;
- direct construction of authoritative decimal values from lexical decimal strings without an intermediate JavaScript `number`;
- the normative Apartment SVG geometric tolerance;
- reusable tolerance-aware decimal comparison operations;
- minimal exact-decimal 2D point and axis-aligned rectangle primitives;
- simple deterministic rectangle-derived geometry needed by later domain work;
- focused automated tests that protect exact arithmetic and tolerance boundary semantics.

The resulting API must be suitable for later parser and validator packages without implementing Apartment SVG parsing or validation in this task.

## Scope

The task includes:

- adding `decimal.js` as the authoritative decimal arithmetic dependency of `@planaxis/geometry`;
- establishing a deliberate public decimal contract in `@planaxis/geometry` so PlanAxis core consumers do not need to import `decimal.js` directly for authoritative geometry;
- ensuring authoritative decimal construction can consume lexical string values directly;
- defining and exporting the normative geometric tolerance of `0.01` cm;
- implementing reusable geometric comparison helpers for equality and ordered comparisons with tolerance;
- defining minimal exact-decimal `Point2D` and axis-aligned `Rect2D` primitives;
- implementing simple exact rectangle derivations needed repeatedly by later geometry and validation code;
- exposing the intended public geometry API through the package entry point;
- adding package-level automated tests and any minimal test configuration required for `@planaxis/geometry`;
- updating the package manifest and lockfile for dependencies required by this task.

The implementation should remain small and explicit. Introduce only geometry operations justified by this task.

## Out of Scope

The task explicitly does **not** include:

- Apartment SVG XML parsing;
- parsing SVG attributes or metadata;
- lexical validation of Apartment SVG `Number`, `PositiveNumber`, or other specification types;
- schema validation;
- validation errors or Apartment SVG error codes;
- identifier or reference handling;
- wall, window, door, zone, utility, camera, or other Apartment SVG domain models;
- wall-axis validation;
- window-to-wall or door-to-wall validation;
- door hinge or open-leaf validation;
- polygon area calculation;
- polygon self-intersection detection;
- general segment-intersection algorithms;
- zone topology;
- overlap or collision validation;
- 3D geometry;
- `ValidatedApartment2D`;
- `ArchitecturalModel3D`;
- Three.js integration;
- renderer-facing conversion to JavaScript `number`;
- broad geometry-engine functionality introduced only for anticipated future needs.

Do not implement advanced geometry speculatively. Add such operations later when a concrete parser, validator, or model task requires them.

## Functional Requirements

### Authoritative decimal values

The package MUST use `decimal.js` as the implementation basis for authoritative geometry.

The public geometry API MUST provide a deliberate way for PlanAxis core code to create and use authoritative decimal values.

Authoritative decimal input originating from an Apartment SVG lexical value MUST be constructible directly from its string representation.

The implementation MUST NOT require or encourage this pattern for authoritative geometry:

```ts
new Decimal(Number(attributeValue))
```

or:

```ts
new Decimal(parseFloat(attributeValue))
```

An equivalent binary floating-point round trip is also prohibited.

It is acceptable for the public package contract to re-export a deliberately selected `decimal.js` type or constructor, or to wrap it behind a small project-owned API, provided that:

- the public contract is explicit;
- authoritative values can be created directly from strings;
- later PlanAxis core packages can depend on `@planaxis/geometry` rather than importing `decimal.js` independently for authoritative geometry;
- no unnecessary abstraction layer is introduced merely to hide the dependency.

Do not introduce a second decimal implementation.

### Geometric tolerance

The package MUST define the normative Apartment SVG geometric tolerance exactly as:

```text
0.01 cm
```

The tolerance MUST itself be represented in the authoritative decimal domain.

There MUST be one clear exported source for this tolerance in the geometry package.

Do not scatter independently constructed `0.01` tolerance constants across modules.

### Tolerance-aware comparisons

The geometry package MUST provide reusable comparison operations covering at least these semantics:

```text
geometric equality:
abs(a - b) <= EPSILON

less-than-or-equal within tolerance:
a <= b + EPSILON

greater-than-or-equal within tolerance:
a >= b - EPSILON
```

The API names should describe their semantics clearly and should follow the terminology already used by the repository coding guidelines.

The comparison implementation MUST remain entirely in the authoritative decimal domain.

It MUST NOT convert operands or intermediate values to JavaScript `number`.

Equality at exactly `EPSILON` MUST be accepted.

Values whose difference is greater than `EPSILON` MUST not be considered geometrically equal.

### `Point2D`

Provide a minimal immutable-by-contract 2D point representation whose authoritative coordinates are decimal values:

```text
x
y
```

The type MUST remain renderer-independent and environment-independent.

Do not add domain-specific semantics such as wall, door, or zone behavior to `Point2D`.

### `Rect2D`

Provide a minimal immutable-by-contract axis-aligned 2D rectangle representation using authoritative decimal values:

```text
x
y
width
height
```

The primitive represents geometry only.

This task MUST NOT make `Rect2D` responsible for Apartment SVG schema validation such as rejecting non-positive dimensions. Schema validity belongs to later validation work.

Provide simple deterministic operations for rectangle values that later code will repeatedly need, covering at least:

```text
right edge  = x + width
bottom edge = y + height
center X    = x + width / 2
center Y    = y + height / 2
```

These calculations MUST remain in the authoritative decimal domain.

Do not convert through JavaScript `number`.

### Public API

The intended decimal contract, tolerance value, comparison helpers, `Point2D`, `Rect2D`, and rectangle derivation operations MUST be available through the public `@planaxis/geometry` package entry point.

Consumers MUST NOT need to import internal source-file paths.

Do not expose unrelated experimental helpers as part of the public package API.

## Technical and Architectural Constraints

The implementation MUST comply with the repository architecture and development rules.

Task-specific constraints:

- all authoritative geometry calculations must remain in the `decimal.js`-based decimal domain;
- `@planaxis/geometry` must remain renderer-independent;
- `@planaxis/geometry` must remain reusable from both Node.js and browser environments;
- do not use Node.js-only APIs in the geometry implementation;
- do not use browser-only APIs in the geometry implementation;
- do not depend on Three.js;
- do not depend on application packages;
- do not introduce Apartment SVG parsing or validation responsibilities into the geometry package;
- do not use `number` for authoritative coordinates, dimensions, distances, tolerance values, or intermediate geometry calculations;
- do not introduce `any`, `@ts-ignore`, unsafe blanket assertions, or weakened TypeScript compiler settings;
- prefer plain functions and explicit data types for these stateless operations;
- keep modules focused rather than creating a catch-all `utils.ts` or `helpers.ts`;
- avoid speculative abstractions and generic geometry-engine architecture.

The implementation MUST NOT silently depend on mutable global decimal configuration whose correctness is unclear.

If `decimal.js` configuration is changed or a configured clone is introduced, the configuration MUST be explicit, local to the project-owned decimal contract where practical, documented by code structure, and covered by tests relevant to this task.

If the agent discovers that an unrestricted Apartment SVG 2.1 numeric rule cannot be represented consistently with the accepted `decimal.js` architecture without an additional architectural or specification decision, it MUST NOT silently weaken the exact-arithmetic requirement. It must keep changes within this task where possible and report the concrete limitation as a deviation or follow-up item.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/geometry/package.json
packages/geometry/src/
packages/geometry/test/
pnpm-lock.yaml
```

The exact test directory may follow the repository's established package conventions.

The workspace configuration may change only if genuinely required for consistent dependency management or testing.

Do not modify unrelated applications or shared packages.

Do not modify any file under:

```text
docs/tasks/
```

## Dependencies

Expected dependency policy for this task:

- reuse existing repository dependencies where practical;
- add a new dependency only when the task genuinely requires it;
- select new or updated versions from current registry metadata at execution time;
- use the newest stable, non-deprecated, mutually compatible release by default;
- evaluate the current stable major release rather than defaulting to a familiar older major;
- do not use prerelease or deprecated releases unless this task explicitly requires them;
- do not bypass compatibility problems using forced installs, ignored peer-dependency errors, or speculative overrides;
- keep repeated dependency versions consistent across workspaces, using pnpm catalogs when appropriate;
- follow the detailed dependency rules in `docs/development/coding-guidelines.md`;
- document newly added dependencies and every intentional version exception in the final response.

If current registry metadata cannot be inspected, the agent must not guess dependency versions from memory and must report the limitation.

Task-specific dependency requirements:

```text
decimal.js
```

`decimal.js` is required as the authoritative decimal implementation established by the PlanAxis architecture.

A test dependency such as Vitest MAY be added to `@planaxis/geometry` when required by the existing workspace test setup. Reuse the repository's established testing technology; do not introduce a second test framework.

If the same testing dependency is declared by multiple workspaces, keep versions consistent and follow the repository policy on pnpm catalogs without performing an unrelated dependency-upgrade refactor.

## Testing Requirements

Add focused automated tests for all behavior introduced by this task.

Tests MUST follow:

```text
docs/development/testing.md
```

At minimum, cover:

### Exact decimal construction and arithmetic

Protect direct string-based decimal behavior using values called out by the testing guidelines, including:

```text
0.1
0.2
2.33
12.01
```

Include at least one assertion demonstrating authoritative decimal arithmetic that would be unsafe to specify through ordinary IEEE-754 binary floating-point arithmetic, for example the exact decimal result of:

```text
0.1 + 0.2
```

Tests MUST exercise the project-facing geometry decimal API rather than bypassing it with an unrelated numeric representation.

### Geometric equality boundaries

Cover exact decimal differences of:

```text
0
0.009
0.010
0.011
```

Required behavior:

```text
0       -> equal
0.009   -> equal
0.010   -> equal
0.011   -> not equal
```

Construct these values exactly in the decimal domain.

### Ordered tolerance comparisons

Test both less-than-or-equal and greater-than-or-equal tolerance helpers at:

- ordinary values clearly inside the accepted relation;
- exact `EPSILON` boundary cases;
- values immediately outside the tolerance.

### Point and rectangle primitives

Verify that:

- `Point2D` coordinates preserve exact decimal values;
- `Rect2D` fields preserve exact decimal values;
- right edge, bottom edge, center X, and center Y are derived exactly;
- decimal values with fractional coordinates and dimensions remain exact through the derivations.

Do not add Apartment SVG fixtures in this task because parsing and schema validation are explicitly out of scope.

Do not weaken, skip, or delete existing tests merely to make this task pass.

## Documentation Requirements

No repository documentation change is expected because the current architecture and development documents already describe exact decimal arithmetic and the geometry-package responsibility.

If the implementation makes an existing non-task document factually inaccurate, update the owning document narrowly.

Do not modify task artifacts under:

```text
docs/tasks/
```

## Verification

Run the focused geometry package tests:

```bash
pnpm --filter @planaxis/geometry test
```

Then run the standard repository verification:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Because this task is expected to add or update dependency manifests and `pnpm-lock.yaml`, also run:

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

1. `@planaxis/geometry` has a deliberate public authoritative decimal contract based on `decimal.js`;
2. authoritative decimal values can be constructed directly from lexical strings without an intermediate JavaScript `number`;
3. later PlanAxis core code does not need to import `decimal.js` directly for authoritative geometry;
4. the normative geometric tolerance is represented exactly as decimal `0.01`;
5. the geometry package exposes one clear source for the normative tolerance;
6. geometric equality implements `abs(a - b) <= EPSILON`;
7. equality accepts a difference exactly equal to `0.01`;
8. equality rejects a difference of `0.011`;
9. reusable less-than-or-equal and greater-than-or-equal tolerance comparisons are implemented in the decimal domain;
10. a minimal exact-decimal `Point2D` representation is available publicly;
11. a minimal exact-decimal axis-aligned `Rect2D` representation is available publicly;
12. rectangle right edge, bottom edge, center X, and center Y can be derived without converting through JavaScript `number`;
13. public geometry consumers can import the intended API from `@planaxis/geometry` without deep internal imports;
14. focused tests protect exact decimal arithmetic using values including `0.1`, `0.2`, `2.33`, and `12.01`;
15. focused tests cover tolerance differences `0`, `0.009`, `0.010`, and `0.011`;
16. focused tests cover the ordered tolerance comparison boundaries;
17. focused tests cover exact rectangle-derived values;
18. no Apartment SVG parser, schema validator, reference resolver, domain-specific geometric validator, 3D model, or renderer behavior is introduced;
19. no JavaScript `number` is used for authoritative geometry calculations introduced by this task;
20. no second decimal implementation or test framework is introduced;
21. required direct dependency versions were selected using current registry metadata;
22. no selected direct dependency is prerelease or deprecated unless explicitly required;
23. the newest mutually compatible stable dependency release was selected, or an evidence-backed exception is reported;
24. repeated dependency versions do not drift across workspaces;
25. package manifests and `pnpm-lock.yaml` represent the same reviewed dependency set;
26. `pnpm --filter @planaxis/geometry test` passes;
27. `pnpm lint` passes;
28. `pnpm typecheck` passes;
29. `pnpm test` passes;
30. `pnpm build` passes;
31. `pnpm install --frozen-lockfile` succeeds;
32. architecture and package boundaries remain intact;
33. no unrelated changes are introduced;
34. no out-of-scope functionality is implemented.

## Final Response

When finished, provide a concise execution report containing:

1. a summary of the decimal and geometry foundation implemented;
2. the public API established in `@planaxis/geometry`;
3. the main files or areas changed;
4. tests added or updated;
5. verification commands actually run and their results;
6. dependency versions added or updated, including the selected `decimal.js` version and any intentionally unselected newer stable release with its evidence-backed compatibility reason;
7. deviations from this task description, or `None`;
8. follow-up work identified during execution, or `None`;
9. a suggested Conventional Commits message that includes:

```text
Task: TASK-003
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```
