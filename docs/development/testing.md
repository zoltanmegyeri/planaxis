# PlanAxis Testing Guidelines

## 1. Purpose

This document defines the testing strategy and testing conventions for **PlanAxis**.

It complements:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/decisions/
```

Normative format behavior is defined by:

```text
docs/specifications/apartment-svg/2.2.md
docs/specifications/planaxis-project/1.0.md
```

Tests must verify implementation against the applicable specification. They must not accidentally redefine it.

---

## 2. Testing Goals

The PlanAxis test suite should provide confidence that:

- Apartment SVG documents are interpreted deterministically;
- PlanAxis projects and project-relative paths are interpreted according to Project Format 1.0;
- valid inputs are accepted;
- invalid inputs are rejected for the correct reason;
- project-format validity remains separate from Apartment SVG validity;
- project filesystem access cannot escape the canonical project root;
- exact decimal arithmetic is preserved in authoritative geometry;
- parser, validator, domain, project-filesystem, 3D model, and renderer responsibilities remain separated;
- architectural invariants survive refactoring;
- regressions are captured permanently;
- browser and server consumers observe compatible shared behavior;
- future features do not weaken the deterministic geometry or project-root security foundations.

Tests are part of the executable specification of PlanAxis.

A passing suite is necessary but not sufficient: the tests themselves must reflect normative rules correctly.

---

## 3. General Testing Principles

### 3.1. Test behavior, not implementation trivia

Prefer tests that verify observable contracts and domain behavior.

Good targets include:

- accepted or rejected Apartment SVG documents;
- accepted or rejected project manifests and project-relative paths;
- structured validation errors;
- exact derived geometry;
- project-root containment behavior;
- domain-model invariants;
- renderer-independent 3D output;
- public package APIs.

Avoid unnecessary coupling to private helper structure, internal file layout, incidental iteration order, temporary implementation objects, or exact formatting of non-normative internal strings.

Tests should permit safe refactoring without losing behavioral coverage.

### 3.2. Derive expected behavior from authoritative sources

For Apartment SVG behavior, expected results must come from the Apartment SVG specification.

For project-container, manifest, path, and project-filesystem behavior, expected results must come from the PlanAxis Project Format specification and accepted architecture/ADR constraints.

Do not encode an implementation bug into a test merely because the current implementation behaves that way.

When a test and implementation disagree:

1. inspect the relevant normative or architectural rule;
2. determine the intended behavior;
3. fix the incorrect side.

If a specification is ambiguous, do not silently invent semantics. Surface the ambiguity as a specification issue.

### 3.3. Keep tests deterministic

The same test must produce the same result regardless of operating system, locale, current date, local time zone, machine clock, random execution order, network availability, or browser state unless the test explicitly targets an environment-specific boundary.

Where runtime time, location, simulation state, or filesystem layout matters, provide it explicitly.

### 3.4. Prefer focused tests

A failing test should make the violated rule easy to identify.

Prefer several focused tests over one large test that validates many unrelated behaviors at once.

Large integration examples are useful, but they do not replace focused rule-level tests.

---

## 4. Test Levels

PlanAxis should use complementary test levels:

```text
unit tests
    ↓
package/component tests
    ↓
fixture-based conformance tests
    ↓
integration tests
    ↓
application / end-to-end tests
```

Not every feature requires every level.

Use the lowest level that gives reliable coverage, then add broader tests where cross-component integration is itself important behavior.

---

## 5. Unit Tests

Unit tests cover small deterministic pieces of logic in isolation.

Typical examples:

- decimal comparison;
- geometric tolerance checks;
- rectangle containment;
- segment or polygon operations;
- orthogonal-polygon and polygon-containment operations;
- wall-axis derivation;
- door leaf calculations;
- heading normalization;
- coordinate conversion;
- canonical Project Format path validation;
- focused validation helpers.

Unit tests should normally avoid filesystem access, HTTP, browser APIs, Three.js unless the unit is renderer-specific, and large Apartment SVG fixtures when direct typed input is clearer.

Pure project-relative path validation should be testable without touching the filesystem. Filesystem existence, type, canonicalization, and symlink behavior belong in focused filesystem tests.

Boundary values are especially important for geometric logic.

---

## 6. Parser Tests

Parser tests verify XML/SVG interpretation without conflating it with later geometric validation.

Typical responsibilities to test include malformed XML handling, root element extraction, metadata extraction, group discovery, attribute extraction, preservation of lexical decimal values, permitted XML/SVG structures, and exclusion of non-semantic annotation content from the semantic pipeline.

Parser tests must distinguish syntactically parseable input from semantically valid Apartment SVG input.

A document may parse successfully and still fail schema or geometric validation.

Parser tests must not depend on Three.js or 3D model generation.

Project-manifest JSON parsing is a separate concern from Apartment SVG parsing and should not be folded into these tests merely because both parse external text.

---

## 7. Schema Validation Tests

Schema validation tests verify structural rules defined by the Apartment SVG specification.

Examples include:

- required root attributes;
- invalid schema version;
- invalid `data-unit`;
- missing metadata;
- malformed metadata structure;
- missing required top-level group;
- duplicate top-level group;
- missing or duplicate `footprint` group;
- a `footprint` group that does not contain exactly one polygon;
- invalid or missing footprint attributes;
- unknown non-extension group;
- missing required element attribute;
- prohibited attribute;
- invalid enum;
- invalid lexical number;
- duplicate ID;
- conditional attribute requirements.

For each normative rule, prefer at least one valid and one invalid case where practical.

Boundary values should be tested explicitly for lexical and numeric constraints.

---

## 8. Referential Validation Tests

Reference tests must verify both existence and referenced type.

Examples:

```text
data-wall -> existing wall
data-wall -> missing ID
data-wall -> existing non-wall element
data-radiator-below -> existing radiator
data-radiator-below -> wrong element kind
```

Do not test only broken IDs. A reference to an existing element of the wrong semantic kind is also invalid.

Resolved references in `ValidatedApartment2D` should be tested through domain contracts rather than temporary lookup implementation details.

---

## 9. Geometric and Topological Validation Tests

Geometric tests are central to PlanAxis and must use exact decimal values and the normative geometric tolerance where the specification defines tolerance-aware comparison.

### 9.1. Apartment footprint

Cover at least:

- valid rectangular footprint;
- valid concave orthogonal footprint;
- too few distinct vertices;
- zero-area footprint;
- self-intersecting footprint;
- diagonal footprint edge;
- proof that a nearly horizontal or vertical diagonal edge is still invalid rather than accepted through `EPSILON`;
- footprint extending outside the root `viewBox`;
- wall, window, door, fixed-element, and zone geometry fully contained in the closed footprint;
- rectangle or polygon crossing outside a concave footprint even when selected vertices are inside;
- utility and camera center points inside or on the footprint boundary;
- utility and camera marker radii not participating in footprint containment;
- hinged-door `open-leaf` reference geometry outside the footprint but still inside the root `viewBox`.

### 9.2. Walls

Cover valid horizontal/vertical walls, invalid axis/dimension relationships, prohibited square walls, explicit wall height, and default wall height derived from metadata.

### 9.3. Windows

Cover valid horizontal/vertical cases, tolerance boundaries, wall-end containment, full wall-thickness coverage, vertical bounds, and level-relative sill/opening semantics.

### 9.4. Doors

Test door variants separately.

For hinged doors, cover legal hinge endpoints, both opening sides, invalid hinges, invalid open-leaf length/orientation, and tolerance boundaries.

For sliding and opening-only doors, verify that hinged-door-only attributes are prohibited.

Door opening Z must be tested as level-relative.

### 9.5. Zones

Cover valid polygons, too few vertices, zero area, self-intersection, zone overlap, shared boundaries, wall overlap/contact, and footprint containment.

### 9.6. Fixed elements and utilities

Cover dimensions, level-relative Z ranges, conditional references, fixed-object description requirements, wall-associated utility placement, prohibited wall references for ceiling lights, and utility `data-z` semantics.

### 9.7. Cameras

Cover valid free-space cameras, wall/fixed-element collision based on XY and level-relative Z, equivalent results under common `level.baseZ` offsets, and marker-radius irrelevance.

---

## 10. Exact Decimal Arithmetic Tests

The test suite must protect the exact-arithmetic policy.

Include values that are problematic in IEEE-754 arithmetic, such as:

```text
0.1
0.2
2.33
12.01
```

Tests must verify calculations through the project's decimal geometry APIs, not after conversion to JavaScript `number`.

Where a renderer adapter intentionally converts to `number`, test that the conversion occurs at that boundary and does not replace the authoritative decimal representation.

---

## 11. Tolerance Boundary Tests

The Apartment SVG specification defines:

```text
EPSILON = 0.01 cm
```

Tests must explicitly cover:

```text
difference = 0
difference < EPSILON
difference = EPSILON
difference > EPSILON
```

For example:

```text
0.009 cm -> equal
0.010 cm -> equal
0.011 cm -> not equal
```

Use exact decimal construction in these tests.

Do not use binary floating-point approximations to test the domain tolerance policy.

Do not apply `EPSILON` to specification rules that require exact equality, such as footprint edge orthogonality.

---

## 12. `ValidatedApartment2D` Tests

Tests for `ValidatedApartment2D` should verify that it is produced only from fully valid Apartment SVG input.

Test important canonical and deterministic values where they are part of the domain contract, such as the validated apartment footprint, effective wall height, wall length/thickness/centerline, resolved references, door derived values, level-relative Z values, `metadata.level.baseZ`, and specification-defined defaults.

Do not require the in-memory model to preserve irrelevant XML presentation details.

---

## 13. `ArchitecturalModel3D` Tests

The 3D architectural model is renderer-independent.

Tests should construct or obtain a valid `ValidatedApartment2D`, then verify deterministic 3D results including wall volumes, openings, model-space Z values, fixed-element volumes, utilities/cameras, floor and ceiling surfaces, and the absence of invented slab/material assumptions.

These tests must not require WebGL and must not assert on `THREE.Mesh`, `THREE.Material`, or other renderer-specific objects.

---

## 14. Renderer Tests

Renderer tests cover PlanAxis mapping from renderer-independent data into Three.js-specific structures or behavior.

Potential targets include Decimal-to-`number` conversion, mesh dimensions, camera conversion, light direction mapping, runtime simulation state application, and stable renderer-specific scene behavior owned by PlanAxis.

Avoid testing Three.js itself.

Where WebGL is unnecessary, test renderer-facing structures without creating a real GPU context.

---

## 15. Runtime and Solar Simulation Tests

Runtime simulation tests must not depend on the machine's current date, time, or time zone.

Provide explicit latitude, longitude, north heading, optional elevation, and runtime instant or offset-aware timestamp.

Where practical, test astronomical provider output separately from the Apartment SVG coordinate-system transformation.

Routine tests must not require network access.

---

## 16. Fixture Strategy

The repository uses:

```text
fixtures/
    valid/
    invalid/
```

for automated Apartment SVG verification.

### 16.1. Valid fixtures

A valid fixture should conform to the relevant Apartment SVG version, have a clear purpose, exercise one or a small number of related rules, and remain as small as practical.

### 16.2. Invalid fixtures

An invalid fixture should intentionally violate a known rule. Prefer one primary violation per fixture.

When practical, an invalid fixture should have an expected primary error code.

### 16.3. Keep invalid fixtures focused

A fixture intended to test one rule should otherwise remain valid so the failure is not masked by an earlier unrelated error.

### 16.4. Project-format test trees

PlanAxis Project Format filesystem behavior should normally use isolated temporary project trees created by the test.

Committed project-format fixtures may be added when they improve readability or conformance coverage, but do not create large user-specific directory trees in the repository merely to test path logic.

A focused temporary project tree should make the relevant filesystem property explicit: manifest content, file type, directory structure, symlink, missing file, or escape attempt.

---

## 17. Fixtures vs. Examples

Do not confuse `fixtures/` with `examples/`.

`fixtures/` exists for automated testing and may contain deliberately malformed or invalid documents.

`examples/` exists for users and documentation. Every normal user-facing example should be valid.

Tests may validate examples as an additional safeguard, but examples do not replace focused fixtures.

---

## 18. Validation Error Assertions

Prefer assertions on structured error data.

For Apartment SVG, prefer stable fields such as error code, category, element ID, relevant attribute, and expected condition.

For Project Format errors, prefer stable rule/category/path information defined by the implementation contract rather than exact machine-specific absolute paths or incidental filesystem error wording.

Exact human-readable wording should be asserted only when the wording itself is a stable public contract.

---

## 19. Error Ordering

Do not rely on incidental validation-error ordering unless ordering is explicitly part of the validator contract.

When order is not normative, test errors as a set or by targeted lookup.

If deterministic ordering is intentionally introduced for API or UX stability, document and test that policy explicitly.

---

## 20. Regression Tests

Every significant bug fix should include a regression test when practical.

Preferred sequence:

1. reproduce the bug with a failing test;
2. implement the fix;
3. verify the test passes;
4. keep the test permanently.

For Apartment SVG bugs, add a focused fixture when natural.

For project-filesystem bugs, prefer a focused temporary tree that reproduces the path or containment condition.

A regression test should explain the protected behavior, not merely reference an issue number.

---

## 21. Test Naming

Test names should describe behavior.

Preferred examples include:

```text
rejects a footprint containing a diagonal edge
rejects a wall that crosses outside a concave footprint
accepts a window whose wall-thickness difference equals EPSILON
rejects an absolute active-architecture path
rejects a project path containing a parent segment
rejects a project resource reached through a symbolic link
keeps a conforming project openable when its active SVG is invalid
```

Avoid vague names such as `works`, `invalid case`, or `case 1`.

Use terminology consistent with the applicable specification.

---

## 22. Test Structure

Use a clear Arrange / Act / Assert structure when it improves readability.

Explicit `Arrange`, `Act`, and `Assert` comments are optional.

Avoid excessive helper abstraction that makes the actual tested data invisible.

---

## 23. Test Helpers and Builders

Small test builders are encouraged when they remove irrelevant boilerplate.

Examples include Apartment SVG semantic builders and a small project-tree helper for project-format/filesystem tests.

A builder should make important values explicit and provide only safe, well-understood defaults.

Do not create builders that silently repair invalid data or hide the rule under test.

For project tests, helpers must not normalize a deliberately invalid project-relative path before the code under test sees it.

---

## 24. Snapshot Testing

Use snapshot tests sparingly.

Snapshots are acceptable when output is structured and stable, reviewing the complete structure is useful, accidental changes should be visible, and the snapshot remains small enough to understand.

Avoid large snapshots of entire Three.js scenes, huge parsed XML trees, long validation arrays, or generated object graphs.

Do not update snapshots automatically without reviewing the semantic change.

A snapshot must never become the source of truth for Apartment SVG or PlanAxis Project Format semantics.

---

## 25. Property-Based Testing

Property-based testing may be introduced for geometry or pure path primitives when it provides concrete value.

Potential candidates include geometric-equality symmetry, rectangle-intersection invariants, orthogonal-polygon invariants, normalized heading range, and canonical project-path invariants.

Property-based tests complement but do not replace normative example tests.

Do not introduce a property-testing dependency before real use cases justify it.

---

## 26. Randomness

Avoid uncontrolled randomness.

If randomized input is used, use a deterministic seed, report the seed on failure, and keep generated cases reproducible.

Flaky randomized tests are not acceptable.

---

## 27. Integration Tests

Integration tests verify cooperation between multiple PlanAxis components.

Examples:

```text
PlanAxis project tree
    -> project-format validation
    -> active SVG acquisition
    -> Apartment SVG pipeline

Apartment SVG
    -> parser
    -> validator
    -> ValidatedApartment2D

ValidatedApartment2D
    -> ArchitecturalModel3D

HTTP request
    -> server route
    -> project-filesystem boundary
    -> resource response
```

Integration tests should not replace focused unit and conformance tests.

Use them where component cooperation is itself the behavior being verified.

---

## 28. Browser Application Tests

Browser-facing tests may cover the currently implemented local Apartment SVG workflow and, once implemented, the project-backed workflow.

Current behavior includes loading an Apartment SVG, presenting validation results, creating a renderer from a valid model, switching cameras/modes, and preserving domain state while renderer state changes.

When ADR-004's project-backed workflow is implemented, browser tests should additionally cover loading project metadata/resource responses and consuming the active SVG without gaining arbitrary filesystem-path authority.

Prefer testing application behavior without pixel-perfect rendering unless visual output itself is the feature.

Real-browser tests should be reserved for behavior that cannot be covered reliably in a lightweight environment.

---

## 29. End-to-End Tests

End-to-end tests should be added when stable user workflows exist.

The current high-value workflow may continue to exercise local SVG loading while that is the implemented UI.

Once the project-backed workflow is implemented, a representative E2E flow becomes:

```text
start PlanAxis with a project root
    ↓
open application
    ↓
load project metadata and active Apartment SVG
    ↓
see successful validation or SVG diagnostics
    ↓
enter 3D viewer
    ↓
switch camera / navigate
```

E2E tests are comparatively expensive. Use a small number of high-value workflows rather than duplicating every validator or Project Format rule at the UI level.

---

## 30. Server Tests

Server tests should distinguish domain/format behavior from transport behavior.

Core Apartment SVG validation belongs in core tests. Pure Project Format path/manifest validation should likewise be tested at the lowest appropriate layer.

Server tests should focus on:

- route contracts;
- request validation;
- response serialization;
- HTTP status behavior;
- project-root startup/configuration behavior;
- file handling through the project-filesystem boundary;
- controlled resource serving;
- persistence integration;
- loopback-default behavior where practical to verify;
- authentication or authorization when introduced.

Do not duplicate the complete Apartment SVG or Project Format conformance suite through HTTP.

### 30.1. PlanAxis Project Format and project-filesystem tests

Project-format and filesystem work must cover the rules that form the persistence/security boundary.

At minimum, where the corresponding capability is implemented, cover:

- valid minimal `planaxis.project.json`;
- missing manifest;
- malformed JSON;
- unsupported `schema`;
- empty/whitespace-only `name`;
- unknown root manifest property;
- unknown `architecture` property;
- missing `architecture.active`;
- active path outside `architecture/`;
- active path with the wrong extension;
- missing active file;
- active target that is not a regular file;
- project-relative path using `/` successfully on supported hosts;
- leading `/` rejection;
- backslash rejection;
- empty segment rejection;
- `.` segment rejection;
- `..` segment rejection;
- URI-scheme rejection;
- Windows drive-prefix rejection, including when tests run on a non-Windows host;
- NUL/path-invalid input rejection where representable at the relevant API boundary;
- root-containment enforcement;
- symbolic-link rejection for target and intermediate components where the host supports symlinks;
- proof that a valid project with an invalid active Apartment SVG remains project-format valid/openable and reaches the normal SVG diagnostic path;
- proof that a valid standalone Apartment SVG does not make a malformed project conforming;
- deletion/absence of `.planaxis/` not affecting durable project interpretation;
- absence of generic unrestricted static serving of `.planaxis/` or arbitrary project files when testing project resource APIs.

Symlink tests must be written portably. If the host or CI environment cannot create symlinks due to platform permissions, the test suite should distinguish an unsupported test setup from successful traversal. Do not silently treat an unexecuted symlink scenario as passing behavior.

Use isolated temporary directories for these tests. Do not depend on a developer's real home directory, project collection, or machine-specific paths.

---

## 31. External Services

Routine tests must not require real external AI or third-party services.

Use adapters, fakes, deterministic fixtures, or provider-independent recorded responses where appropriate.

Live integration tests may exist separately, but the normal deterministic suite must not require real secret credentials.

---

## 32. XML and Security-Oriented Tests

Apartment SVG is untrusted external XML input.

Once the XML parser and configuration are selected, add tests for relevant unsafe or unsupported behavior such as external entity handling or external resource resolution.

Project manifests and resource identifiers are also untrusted external/application input. Security-oriented tests should protect traversal, containment, symlink, and unintended resource-serving boundaries according to the Project Format and ADR-004.

Do not add speculative security tests unrelated to the implementation.

---

## 33. Performance Tests

Performance benchmarks are not correctness tests.

Do not add brittle timing assertions to the normal unit suite.

When performance becomes important, create explicit benchmarks, use representative inputs, compare meaningful operations, and separate benchmark thresholds from correctness tests.

Potential future benchmarks include parsing large Apartment SVG documents, validation throughput, 2D-to-3D model construction, project scanning/asset processing when introduced, and browser scene construction.

Optimize only after measurement.

---

## 34. Coverage

Code coverage is a diagnostic tool, not the definition of quality.

Do not optimize for a percentage at the expense of meaningful tests.

High-value coverage means normative rules are exercised, edge cases are covered, invalid paths are tested, architectural boundaries are protected, and regressions are reproduced.

If coverage thresholds are introduced later, they should prevent accidental loss of meaningful coverage rather than encourage trivial tests.

---

## 35. Test Isolation

Tests must not depend on execution order.

A test must not leave mutable state that affects later tests.

Reset or isolate:

- temporary files and project roots;
- global state;
- fake timers;
- mocks;
- application stores;
- browser state;
- environment variables.

Prefer explicit test dependencies over hidden global mutation where practical.

---

## 36. Temporary Files

Tests requiring filesystem output should use isolated temporary directories.

This rule is especially important for PlanAxis Project Format and project-filesystem tests.

Do not write generated test output into:

```text
fixtures/
examples/
docs/
source directories
```

unless the task explicitly tests a generator whose intended output is committed.

Temporary test artifacts should be cleaned up automatically.

Do not use the actual repository root as a fake PlanAxis project root for tests that intentionally exercise deletion, mutation, path errors, or cache cleanup.

---

## 37. Time and Time Zones

Tests involving civil time or solar simulation must use explicit time-zone-aware values.

Do not depend on `new Date()` without an injected test clock when current time affects behavior.

Do not assume the developer machine is in a specific time zone.

Use fixed instants or explicit local-time-plus-zone inputs.

Daylight-saving transitions should be tested if and when local civil-time conversion logic is introduced.

---

## 38. Floating-Point Renderer Assertions

Renderer outputs may use native floating-point values.

Do not reuse the Apartment SVG authoritative `EPSILON` automatically for every renderer assertion.

Keep domain geometric tolerance and renderer numeric comparison tolerance distinct.

A renderer-specific tolerance must not redefine authoritative domain equality.

---

## 39. CI Expectations

The standard verification commands are:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI should run the same repository-level checks.

The standard test command must not require network access, secrets, interactive input, a manually running service, a developer-specific project directory, or uncommitted local files.

---

## 40. Focused Development vs. Final Verification

During development, run the narrowest useful test first.

Package-scoped or pattern-scoped tests may be used during development.

Before considering a substantive change complete, run the repository-level verification required by `AGENTS.md`.

Targeted tests accelerate iteration but do not replace final verification.

---

## 41. Failing Tests

Do not make a failing test pass by weakening the test unless expected behavior has legitimately changed.

Prohibited shortcuts include deleting/skipping tests, replacing precise assertions with vague ones, changing expected error codes without a normative reason, widening tolerances arbitrarily, accepting invalid fixtures, mocking away the behavior under test, or weakening project path/root-containment assertions to accommodate an implementation shortcut.

If behavior intentionally changes, update implementation, tests, documentation, ADRs, and the applicable specification where required as one coherent change.

---

## 42. Specification Versioning Tests

Apartment SVG and PlanAxis Project Format are independently versioned.

When support for multiple versions of either format is introduced, tests must make the target version explicit.

Avoid silently interpreting an older document/project using newer semantics.

A versioned fixture hierarchy may be introduced when multiple supported versions make it useful. Do not add this complexity before it is needed.

Project Format migration tests, when migration is introduced, must verify that migration is explicit and preserves durable project data rather than silently rewriting a project merely because it was opened.

---

## 43. Example Validation

User-facing examples should be automatically validated when practical.

A CI test may enumerate normative Apartment SVG examples and require them to pass the validator.

If user-facing example PlanAxis projects are introduced, they should conform to the supported Project Format and should not depend on machine-specific absolute paths or symlinks prohibited by the specification.

Intentionally invalid educational examples must be clearly separated or marked so they are not mistaken for normal valid examples.

---

## 44. Package API Tests

Where packages expose public APIs, integration tests should prefer imports through the package's public entry point rather than deep internal paths.

Internal unit tests may import internal modules when directly testing that unit.

---

## 45. Test Review Checklist

Before considering test work complete, verify:

- expected behavior comes from the applicable normative specification or documented architecture;
- valid and invalid cases are both covered where relevant;
- boundary values are tested;
- exact decimal arithmetic is preserved;
- `EPSILON` boundary cases are covered for tolerance-aware geometric rules;
- exact geometric rules such as footprint orthogonality are not weakened by tolerance;
- footprint topology and containment are covered when relevant;
- level-relative and model-space Z semantics are distinguished correctly;
- Project Format closed-manifest rules are covered when relevant;
- project-relative path syntax is tested independently from filesystem resolution where practical;
- root containment and symbolic-link policy are covered for filesystem-backed project work;
- project-format validity is tested separately from Apartment SVG validity;
- `.planaxis/` remains disposable;
- invalid fixtures primarily violate the intended rule;
- validation errors are asserted structurally;
- tests are deterministic;
- tests do not depend on local time zone or current time;
- tests do not require network access or secrets;
- filesystem tests use isolated temporary roots rather than real user paths;
- snapshots are small and justified;
- regression fixes include regression coverage;
- fixtures and examples are not confused;
- renderer tests do not redefine domain semantics;
- package boundaries remain independently testable;
- repository-level verification passes when available.

---

## 46. Definition of Done for Tested Behavior

A behavior change is not complete merely because the implementation compiles.

For behavior covered by PlanAxis, completion normally requires:

1. implementation;
2. focused automated tests;
3. valid and/or invalid fixtures or temporary project trees when appropriate;
4. regression coverage for bug fixes;
5. updated documentation when behavior or contracts change;
6. updated normative specification and/or ADR when the contract or architecture changes;
7. successful lint, typecheck, test, and build verification once those commands are available.

For normative Apartment SVG and PlanAxis Project Format rules, tests should make the relationship between the specification rule and implemented behavior clear enough that future contributors can understand which invariant is being protected.
