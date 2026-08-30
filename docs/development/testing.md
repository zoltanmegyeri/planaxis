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

The normative Apartment SVG behavior is defined by:

```text
docs/specifications/apartment-svg/2.1.md
```

Tests must verify the implementation against the specification. They must not accidentally redefine it.

---

## 2. Testing Goals

The PlanAxis test suite should provide confidence that:

- Apartment SVG documents are interpreted deterministically;
- valid documents are accepted;
- invalid documents are rejected for the correct reason;
- exact decimal arithmetic is preserved in authoritative geometry;
- parser, validator, domain, 3D model, and renderer responsibilities remain separated;
- architectural invariants survive refactoring;
- regressions are captured permanently;
- browser and server consumers observe compatible core behavior;
- future features do not weaken the deterministic geometry pipeline.

Tests are part of the executable specification of PlanAxis.

A passing suite is necessary but not sufficient: the tests themselves must reflect the normative rules correctly.

---

## 3. General Testing Principles

### 3.1. Test behavior, not implementation trivia

Prefer tests that verify observable contracts and domain behavior.

Good targets include:

- accepted or rejected Apartment SVG documents;
- structured validation errors;
- exact derived geometry;
- domain-model invariants;
- renderer-independent 3D output;
- public package APIs.

Avoid unnecessary coupling to:

- private helper structure;
- internal file layout;
- incidental iteration order;
- temporary implementation objects;
- exact formatting of non-normative internal strings.

Tests should permit safe refactoring without losing behavioral coverage.

### 3.2. Derive expected behavior from authoritative sources

For Apartment SVG behavior, expected results must come from the normative specification.

Do not encode an implementation bug into a test merely because the current implementation behaves that way.

When a test and implementation disagree:

1. inspect the relevant specification rule;
2. determine the normative behavior;
3. fix the incorrect side.

If the specification is ambiguous, do not silently invent semantics. Surface the ambiguity as a specification issue.

### 3.3. Keep tests deterministic

The same test must produce the same result regardless of:

- operating system;
- locale;
- current date;
- local time zone;
- machine clock;
- random execution order;
- network availability;
- browser state.

Where runtime time, location, or simulation state matters, provide it explicitly.

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
- wall-axis derivation;
- door leaf calculations;
- heading normalization;
- coordinate conversion;
- focused validation helpers.

Unit tests should normally avoid:

- filesystem access;
- HTTP;
- browser APIs;
- Three.js unless the unit is renderer-specific;
- large Apartment SVG fixtures when direct typed input is clearer.

Boundary values are especially important for geometric logic.

---

## 6. Parser Tests

Parser tests verify XML/SVG interpretation without conflating it with later geometric validation.

Typical responsibilities to test include:

- malformed XML handling;
- root element extraction;
- metadata extraction;
- group discovery;
- attribute extraction;
- preservation of lexical decimal values;
- relevant permitted XML/SVG structures;
- exclusion of non-semantic annotation content from the semantic pipeline.

Parser tests must distinguish:

```text
syntactically parseable input
```

from:

```text
semantically valid Apartment SVG
```

A document may parse successfully and still fail schema or geometric validation.

Parser tests must not depend on Three.js or 3D model generation.

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
- unknown non-extension group;
- missing required element attribute;
- prohibited attribute;
- invalid enum;
- invalid lexical number;
- duplicate ID;
- conditional attribute requirements.

For each normative rule, prefer at least:

```text
one valid case
one invalid case
```

where practical.

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

Geometric tests are central to PlanAxis and must use exact decimal values and the normative geometric tolerance.

### 9.1. Walls

Cover cases such as:

- valid horizontal wall;
- valid vertical wall;
- invalid `data-axis="x"` with `width <= height`;
- invalid `data-axis="y"` with `height <= width`;
- prohibited square wall;
- explicit wall height;
- default wall height derived from metadata.

### 9.2. Windows

Cover at least:

- valid window on a horizontal wall;
- valid window on a vertical wall;
- equality within `EPSILON`;
- equality outside `EPSILON`;
- opening extending before wall start;
- opening extending beyond wall end;
- opening not covering the full wall thickness;
- sill plus opening height exceeding wall height.

### 9.3. Doors

Test door types separately.

For hinged doors, cover:

- both legal hinge endpoints on horizontal walls;
- both legal hinge endpoints on vertical walls;
- both legal 90-degree opening sides;
- invalid hinge between endpoints;
- invalid hinge off the wall centerline;
- invalid open-leaf length;
- invalid open-leaf orientation;
- valid values at tolerance boundaries;
- invalid values immediately outside tolerance.

For sliding and opening-only doors, verify that hinged-door-only attributes are prohibited.

### 9.4. Zones

Cover:

- valid polygon;
- too few distinct vertices;
- zero-area polygon;
- self-intersection;
- zone-to-zone positive-area overlap;
- shared boundary without interior overlap;
- zone interior overlapping a wall;
- boundary contact with a wall.

### 9.5. Fixed elements and utilities

Cover:

- valid fixed-element dimensions and Z ranges;
- conditional `data-wall` behavior for radiators;
- `fixed-object` description requirements;
- wall-associated utility on wall footprint or boundary;
- wall-associated utility outside wall footprint;
- `ceiling-light` with prohibited wall reference.

### 9.6. Cameras

Cover:

- valid camera in free space;
- camera XY inside wall but Z outside wall volume;
- camera XY and Z both inside wall volume;
- collision with fixed element;
- marker radius not affecting collision detection.

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

---

## 12. `ValidatedApartment2D` Tests

Tests for `ValidatedApartment2D` should verify that it is produced only from fully valid Apartment SVG input.

Test important deterministic derived values where they are part of the domain contract, such as:

- effective wall height;
- wall length;
- wall thickness;
- wall centerline;
- resolved wall references;
- door opening width;
- door leaf length;
- closed free endpoint;
- specification-defined metadata defaults or resolved values.

Do not require the in-memory model to preserve irrelevant XML details such as:

- attribute order;
- CSS;
- presentation styles;
- annotation rendering details.

The test should reflect domain meaning rather than serialization trivia.

---

## 13. `ArchitecturalModel3D` Tests

The 3D architectural model is renderer-independent.

Its tests should construct or obtain a valid `ValidatedApartment2D`, then verify the deterministic 3D result.

Typical assertions include:

- correct wall volume dimensions;
- correct base Z and wall height;
- correctly represented wall openings;
- correct window Z range;
- correct door opening Z range;
- correct fixed-element volume;
- correct camera position and orientation data;
- consistent coordinate-system mapping.

These tests must not require WebGL and must not assert on `THREE.Mesh`, `THREE.Material`, or other renderer-specific objects.

---

## 14. Renderer Tests

Renderer tests cover PlanAxis mapping from renderer-independent data into Three.js-specific structures or behavior.

Potential targets include:

- correct Decimal-to-`number` conversion at the renderer boundary;
- mesh dimensions;
- camera conversion;
- light direction mapping;
- runtime simulation state application;
- stable renderer-specific scene behavior owned by PlanAxis.

Avoid testing Three.js itself.

Where WebGL is unnecessary, test renderer-facing structures without creating a real GPU context.

---

## 15. Runtime and Solar Simulation Tests

Runtime simulation tests must not depend on the machine's current date, time, or time zone.

Provide explicit:

- latitude;
- longitude;
- north heading;
- optional elevation;
- runtime instant or offset-aware timestamp.

Where practical, test separately:

```text
astronomical calculation/provider output
```

and:

```text
Apartment SVG coordinate-system transformation
```

At minimum, test the normative transformation from geographic azimuth/elevation into the PlanAxis 3D direction independently of an external astronomical provider.

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

A valid fixture should:

- conform to the relevant Apartment SVG version;
- have a clear purpose;
- exercise one or a small number of related rules;
- remain as small as practical.

Example names:

```text
minimal.svg
horizontal-wall.svg
window-horizontal-wall.svg
hinged-door-vertical-left.svg
camera-above-low-fixed-element.svg
```

### 16.2. Invalid fixtures

An invalid fixture should intentionally violate a known rule.

Prefer one primary violation per fixture.

Example names:

```text
duplicate-id.svg
missing-required-group.svg
broken-wall-reference.svg
invalid-wall-axis.svg
window-outside-wall.svg
invalid-door-hinge.svg
invalid-door-open-leaf.svg
self-intersecting-zone.svg
camera-inside-wall.svg
```

When practical, an invalid fixture should have an expected primary error code.

### 16.3. Keep invalid fixtures focused

A fixture intended to test one rule should otherwise remain valid.

For example, a fixture for an invalid door hinge should not also contain:

- a broken wall reference;
- missing metadata;
- an invalid wall axis.

Otherwise the test becomes ambiguous and may fail earlier for the wrong reason.

---

## 17. Fixtures vs. Examples

Do not confuse:

```text
fixtures/
```

with:

```text
examples/
```

`fixtures/` exists for automated testing and may contain deliberately malformed or invalid documents.

`examples/` exists for users and documentation.

Every normal user-facing example should be valid.

Tests may validate examples as an additional safeguard, but examples do not replace focused fixtures.

---

## 18. Validation Error Assertions

Prefer assertions on structured error data.

Good:

```ts
expect(result.errors).toContainEqual(
  expect.objectContaining({
    code: "APSVG-DOOR-001",
    elementId: "door-bedroom-01",
  }),
);
```

Less useful:

```ts
expect(result.message).toBe(
  "The door is invalid because the hinge is wrong...",
);
```

Exact human-readable wording should be asserted only when the wording itself is a stable public contract.

Prefer stable structured fields such as:

- code;
- category;
- element ID;
- relevant attribute;
- expected condition.

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

For Apartment SVG bugs, add a focused fixture when the regression is naturally represented as a document.

A regression test should explain the protected behavior, not merely reference an issue number.

---

## 21. Test Naming

Test names should describe behavior.

Preferred:

```text
rejects a hinged door whose hinge is not on an opening endpoint
accepts a window whose wall-thickness difference equals EPSILON
uses the default ceiling height when data-height is absent
does not include annotation geometry in the domain model
```

Avoid vague names:

```text
works
test door
invalid case
should pass
case 1
```

Use terminology consistent with the Apartment SVG specification.

---

## 22. Test Structure

Use a clear Arrange / Act / Assert structure when it improves readability.

Example:

```ts
it("rejects a broken wall reference", () => {
  const svg = loadFixture("invalid/broken-wall-reference.svg");

  const result = validateApartmentSvg(svg);

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({ code: "APSVG-REF-001" }),
  );
});
```

Explicit `Arrange`, `Act`, and `Assert` comments are optional.

Avoid excessive helper abstraction that makes the actual tested data invisible.

---

## 23. Test Helpers and Builders

Small test builders are encouraged when they remove irrelevant boilerplate.

Examples:

```text
wall(...)
window(...)
hingedDoor(...)
validMetadata(...)
apartmentFixture(...)
```

A builder should make important values explicit and provide only safe, well-understood defaults.

Do not create builders that silently repair invalid data or hide the rule under test.

For validation tests, raw SVG fixtures are often preferable because they exercise the real external format.

For geometry or 3D-model unit tests, typed builders may be more appropriate.

---

## 24. Snapshot Testing

Use snapshot tests sparingly.

Snapshots are acceptable when:

- output is structured and stable;
- reviewing the complete structure is useful;
- accidental changes should be visible;
- the snapshot remains small enough to understand.

Avoid large snapshots of:

- entire Three.js scenes;
- huge parsed XML trees;
- long validation-result arrays;
- generated object graphs.

Do not update snapshots automatically without reviewing the semantic change.

A snapshot must never become the source of truth for Apartment SVG semantics.

---

## 25. Property-Based Testing

Property-based testing may be introduced for geometry primitives when it provides concrete value.

Potential candidates include:

- geometric-equality symmetry;
- rectangle-intersection invariants;
- normalized heading range;
- distance properties;
- polygon helper invariants.

Property-based tests complement but do not replace normative example tests.

Do not introduce a property-testing dependency before real use cases justify it.

---

## 26. Randomness

Avoid uncontrolled randomness.

If randomized input is used:

- use a deterministic seed;
- report the seed on failure;
- keep generated cases reproducible.

Flaky randomized tests are not acceptable.

---

## 27. Integration Tests

Integration tests verify cooperation between multiple PlanAxis components.

Examples:

```text
Apartment SVG
    -> parser
    -> validator
    -> ValidatedApartment2D

ValidatedApartment2D
    -> ArchitecturalModel3D

HTTP request
    -> server route
    -> core validation
    -> structured response
```

Integration tests should not replace focused unit and conformance tests.

Use them where component cooperation is itself the behavior being verified.

---

## 28. Browser Application Tests

Browser-facing tests may cover:

- loading an Apartment SVG;
- presenting validation results;
- creating a renderer from a valid model;
- switching predefined cameras;
- changing runtime date/time;
- toggling lights;
- changing dimmer values;
- preserving domain state while renderer state changes.

Prefer testing application behavior without pixel-perfect rendering unless visual output itself is the feature.

Real-browser tests should be reserved for behavior that cannot be covered reliably in a lightweight environment.

---

## 29. End-to-End Tests

End-to-end tests should be added when stable user workflows exist.

Potential workflow:

```text
open application
    ↓
load valid Apartment SVG
    ↓
see successful validation
    ↓
enter 3D viewer
    ↓
switch camera
    ↓
change time
    ↓
observe runtime scene update
```

E2E tests are comparatively expensive.

Use a small number of high-value workflows rather than duplicating every validator rule at the UI level.

---

## 30. Server Tests

Server tests should distinguish:

```text
domain behavior
```

from:

```text
transport behavior
```

Core domain validation belongs in core tests.

Server tests should focus on:

- route contracts;
- request validation;
- response serialization;
- HTTP status behavior;
- file handling;
- persistence integration;
- authentication or authorization when introduced.

Do not duplicate the complete validator suite through HTTP.

---

## 31. External Services

Routine tests must not require real external AI or third-party services.

Use:

- adapters;
- fakes;
- deterministic fixtures;
- provider-independent recorded responses where appropriate.

Live integration tests may exist separately, but the normal deterministic suite must not require real secret credentials.

---

## 32. XML and Security-Oriented Tests

Apartment SVG is untrusted external XML input.

Once the XML parser and configuration are selected, add tests for relevant unsafe or unsupported behavior, for example:

- external entity handling;
- external resource resolution;
- unsupported declarations;
- malformed or pathological structures where practical.

The exact cases must correspond to the selected parser and its real configuration.

Do not add speculative parser-security tests unrelated to the implementation.

---

## 33. Performance Tests

Performance benchmarks are not correctness tests.

Do not add brittle timing assertions to the normal unit suite.

When performance becomes important:

- create explicit benchmarks;
- use representative apartment documents;
- compare meaningful operations;
- separate benchmark thresholds from correctness tests.

Potential future benchmarks include:

- parsing large Apartment SVG documents;
- validation throughput;
- 2D-to-3D model construction;
- browser scene construction.

Optimize only after measurement.

---

## 34. Coverage

Code coverage is a diagnostic tool, not the definition of quality.

Do not optimize for a percentage at the expense of meaningful tests.

High-value coverage means that:

- normative rules are exercised;
- edge cases are covered;
- invalid paths are tested;
- architectural boundaries are protected;
- regressions are reproduced.

If coverage thresholds are introduced later, they should prevent accidental loss of meaningful coverage rather than encourage trivial tests.

---

## 35. Test Isolation

Tests must not depend on execution order.

A test must not leave mutable state that affects later tests.

Reset or isolate:

- temporary files;
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

Do not write generated test output into:

```text
fixtures/
examples/
docs/
source directories
```

unless the task explicitly tests a generator whose intended output is committed.

Temporary test artifacts should be cleaned up automatically.

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

Keep these concepts distinct:

```text
domain geometric tolerance
renderer numeric comparison tolerance
```

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

The standard test command must not require:

- network access;
- secrets;
- interactive input;
- a manually running service;
- uncommitted local files.

---

## 40. Focused Development vs. Final Verification

During development, run the narrowest useful test first.

Package-scoped or pattern-scoped tests may be used during development.

Before considering a substantive change complete, run the repository-level verification required by `AGENTS.md`.

Targeted tests accelerate iteration but do not replace final verification.

---

## 41. Failing Tests

Do not make a failing test pass by weakening the test unless expected behavior has legitimately changed.

Prohibited shortcuts include:

- deleting the failing test;
- skipping it;
- replacing a precise assertion with a vague one;
- changing expected error codes without a normative reason;
- widening tolerances arbitrarily;
- accepting invalid fixtures;
- mocking away the behavior under test.

If behavior intentionally changes, update implementation, tests, documentation, ADRs, and the specification where applicable as one coherent change.

---

## 42. Specification Versioning Tests

Apartment SVG specifications are independently versioned.

When support for multiple versions is introduced, tests must make the target version explicit.

Avoid silently interpreting an older document using newer semantics.

A versioned fixture hierarchy may be introduced when multiple supported versions make it useful, for example:

```text
fixtures/
    apartment-svg/
        2.1/
            valid/
            invalid/
        2.2/
            valid/
            invalid/
```

Do not add this complexity before it is needed.

---

## 43. Example Validation

User-facing examples should be automatically validated when practical.

A CI test may enumerate normative Apartment SVG files under:

```text
examples/
```

and require them to pass the validator.

This prevents documentation examples from silently becoming stale.

Intentionally invalid educational examples must be clearly separated or marked so they are not mistaken for normal valid examples.

---

## 44. Package API Tests

Where packages expose public APIs, integration tests should prefer imports through the package's public entry point.

Example:

```ts
import { validateApartmentSvg } from "@planaxis/validator";
```

rather than a deep internal path.

Internal unit tests may import internal modules when directly testing that unit.

---

## 45. Test Review Checklist

Before considering test work complete, verify:

- expected behavior comes from the normative specification or documented architecture;
- valid and invalid cases are both covered where relevant;
- boundary values are tested;
- exact decimal arithmetic is preserved;
- `EPSILON` boundary cases are covered for geometric rules;
- invalid fixtures primarily violate the intended rule;
- validation errors are asserted structurally;
- tests are deterministic;
- tests do not depend on local time zone or current time;
- tests do not require network access or secrets;
- snapshots are small and justified;
- regression fixes include regression coverage;
- fixtures and examples are not confused;
- renderer tests do not redefine domain semantics;
- package boundaries remain independently testable;
- repository-level verification passes when available.

---

## 46. Definition of Done for Tested Behavior

A behavior change is not complete merely because the implementation compiles.

For behavior covered by the PlanAxis domain, completion normally requires:

1. implementation;
2. focused automated tests;
3. valid and/or invalid fixtures when appropriate;
4. regression coverage for bug fixes;
5. updated documentation when behavior or contracts change;
6. successful lint, typecheck, test, and build verification once those commands are available.

For normative Apartment SVG rules, tests should make the relationship between the specification rule and implemented behavior clear enough that future contributors can understand which invariant is being protected.
