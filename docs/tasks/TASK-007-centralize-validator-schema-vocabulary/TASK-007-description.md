# TASK-007: Centralize Apartment SVG Validator Schema Vocabulary

## Context

TASK-006 completed Apartment SVG 2.1 semantic-element schema validation and established the validator-owned `SchemaValidApartmentSvgDocument` intermediate representation.

During human review of that implementation, one maintainability observation was identified: the validator source contains many normative schema string literals, and several of those literals are repeated across multiple files.

Examples of the current pattern include:

- the SVG namespace URI being defined or referenced in multiple validation modules;
- required/core group IDs such as `spaces`, `walls`, `windows`, `doors`, `fixed-elements`, `utilities`, `cameras`, and `annotations`;
- core SVG element names such as `g`, `polygon`, `rect`, and `circle`;
- common attribute names such as `id`, `transform`, `data-kind`, `data-wall`, and `data-status`;
- element-specific Apartment SVG attribute names;
- semantic kind values;
- enum values such as status values, wall axes/classes, door types, window materials/types, fixed-element kinds, utility kinds, and similar schema vocabulary;
- TypeScript union types and runtime validation collections independently repeating the same enum values.

The current implementation is accepted and correct. This task is not a bug fix.

The purpose of TASK-007 is to make the validator easier and safer to maintain by creating a cohesive internal source of truth for Apartment SVG schema vocabulary and updating validator code to reuse it.

This refactor must preserve:

- the complete public API of `@planaxis/validator`;
- current validation behavior;
- current validation error codes;
- current structured error fields;
- schema-valid output semantics;
- exact-decimal behavior;
- parser/validator/geometry package boundaries;
- the architectural stage separation established by TASK-006.

The next architectural feature after this refactor remains reference resolution and referential validation.

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

Refactor `@planaxis/validator` so normative Apartment SVG schema vocabulary used by production validator code has a clear, cohesive internal source of truth rather than being independently duplicated as ad hoc string literals.

The completed refactor must:

- centralize appropriate Apartment SVG schema constants;
- reuse those constants throughout validator production code;
- derive existing enum-like TypeScript union types from canonical runtime value collections where practical;
- eliminate duplicate authoritative definitions of the same schema vocabulary;
- preserve local readability by keeping non-schema and genuinely one-off strings local;
- preserve all existing public APIs and observable validation behavior;
- avoid introducing a generic constants framework or unrelated repository-wide cleanup.

The result should make a future Apartment SVG vocabulary change less likely to require synchronized edits to multiple independent literal definitions.

## Scope

The task includes:

- auditing `packages/validator/src/` for normative Apartment SVG schema string literals;
- identifying literals that represent canonical schema vocabulary rather than prose or implementation-local details;
- introducing one cohesive internal schema-vocabulary module, or a very small number of cohesive internal vocabulary modules if separation is clearly justified;
- centralizing the SVG namespace URI used by validator modules;
- centralizing required and core semantic group IDs;
- centralizing canonical SVG element names used as Apartment SVG structural/schema tokens where useful;
- centralizing Apartment SVG attribute names used by validator schema logic;
- centralizing semantic kind values and other normative literal discriminators where useful;
- centralizing canonical enum value collections used by runtime validation;
- deriving existing public union types from those canonical value collections where practical;
- updating validator modules to consume the centralized constants;
- deriving `Set` instances or lookup structures from canonical readonly value collections rather than duplicating their member literals;
- preserving existing public type names;
- preserving existing validator entry points;
- preserving existing structured validation errors and error codes;
- preserving exact-decimal behavior;
- updating tests only as required to protect or accommodate the refactor;
- removing obsolete duplicate literal collections after canonical constants are adopted.

## Out of Scope

The task explicitly does **not** include:

- adding new Apartment SVG validation rules;
- changing the meaning of any existing validation rule;
- changing Apartment SVG 2.1;
- implementing reference resolution;
- implementing reference target existence or kind validation;
- implementing geometric or topological validation;
- constructing `ValidatedApartment2D`;
- changing the parser;
- changing exact-decimal behavior;
- changing validation error codes;
- redesigning validation error categories;
- deliberately rewriting validation error messages;
- renaming public validator functions;
- renaming existing public schema-valid types merely for style;
- introducing a public constants API for consumers;
- exporting the new vocabulary module from `packages/validator/src/index.ts` unless an existing public contract genuinely requires it;
- moving validator-owned schema-stage types to `@planaxis/model`;
- introducing a generic repository-wide `constants` package;
- refactoring unrelated string literals outside `@planaxis/validator`;
- centralizing ordinary English error messages;
- centralizing validation rule IDs solely because they are strings;
- centralizing `expected` prose strings;
- centralizing exception/error prose;
- replacing every string literal in the validator with a named constant;
- speculative abstraction intended for future Apartment SVG versions;
- dependency upgrades unrelated to this refactor.

Do not broaden this task into a general cleanup of the validator or monorepo.

## Functional Requirements

### Behavior preservation

This is a behavior-preserving refactor.

For the same parsed Apartment SVG input, the existing public validator APIs MUST continue to produce the same semantic results as before the refactor.

The following public functions MUST retain their established behavior:

```ts
validateApartmentSvgDocumentSchema(...)
validateApartmentSvgSchema(...)
```

Any other existing public exports from `@planaxis/validator` MUST remain compatible unless a change is strictly internal and invisible to package consumers.

### Schema-valid representation preservation

`SchemaValidApartmentSvgDocument` and its related exported schema-valid types MUST retain the trust boundary established by TASK-006.

The refactor MUST NOT:

- resolve reference strings;
- alter exact-decimal values;
- add geometric interpretation;
- remove existing semantic fields;
- add inferred semantic defaults;
- change which inputs are schema-valid.

### Validation error preservation

Existing `APSVG-*` validation codes MUST remain unchanged.

For existing covered inputs, structured error behavior SHOULD remain unchanged, including:

- code;
- category;
- rule;
- element ID;
- attribute;
- actual value;
- expected condition.

Human-readable message text SHOULD also remain unchanged unless an unavoidable non-semantic formatting difference is required by the refactor.

Do not use this task as an opportunity to rewrite error wording.

### Canonical schema vocabulary

Introduce a project-owned internal source of truth for recurring normative Apartment SVG vocabulary.

The exact module name is an implementation choice. A name such as:

```text
schema-vocabulary.ts
apartment-svg-schema-vocabulary.ts
```

is appropriate if it matches repository naming style.

The canonical vocabulary should cover categories that materially reduce duplication, including where applicable:

- namespaces;
- top-level group IDs;
- core semantic group IDs;
- SVG element names used by the Apartment SVG schema;
- Apartment SVG attribute names;
- semantic `data-kind` values;
- enum value collections.

The implementation MUST keep the vocabulary organized and discoverable.

Do not create an unstructured file containing unrelated constants with no domain grouping.

### Namespace URI

The SVG namespace URI:

```text
http://www.w3.org/2000/svg
```

MUST have one authoritative validator definition rather than separate validator-local definitions.

Where the XMLNS namespace URI is used only by a single internal implementation concern, it MAY remain local unless centralizing it clearly improves cohesion.

### Group IDs

Canonical Apartment SVG group IDs MUST be defined once and reused where they participate in validator logic.

The required group vocabulary is:

```text
spaces
walls
windows
doors
fixed-elements
utilities
cameras
annotations
```

The implementation SHOULD distinguish:

- all required top-level groups;
- the seven core semantic groups;
- the non-semantic `annotations` group;

without duplicating the string literals between independent collections.

For example, a core semantic group collection may be derived from a canonical required-group vocabulary rather than restating every member independently.

The exact representation is an implementation choice.

### SVG element names

Where the validator repeatedly uses canonical SVG element names as schema tokens, such as:

```text
svg
g
metadata
polygon
rect
circle
```

use centralized vocabulary when this reduces duplication and improves consistency.

Do not centralize arbitrary SVG presentation element names that occur only once unless they naturally belong to an already cohesive collection.

### Attribute names

Apartment SVG attribute names used by production schema validation SHOULD have a canonical internal representation rather than being repeatedly typed as independent literals.

Examples include common attributes such as:

```text
id
transform
x
y
width
height
cx
cy
r
points
data-kind
data-status
data-wall
data-height
data-opening-height
```

and element-specific Apartment SVG attributes.

A structured object is preferred over dozens of unrelated top-level constants when that improves discoverability, for example conceptually:

```ts
const APARTMENT_SVG_ATTRIBUTES = {
  id: "id",
  transform: "transform",
  dataKind: "data-kind",
  // ...
} as const;
```

The exact naming is an implementation choice.

The result MUST remain readable at call sites.

Do not sacrifice local clarity merely to avoid all literals.

### Enum values and TypeScript types

Where the same normative enum values currently appear both:

- in exported TypeScript union types; and
- in runtime validator `Set`/array definitions;

replace the duplicate authoritative definitions with a canonical readonly runtime collection and derive the TypeScript union from it where practical.

This applies to appropriate types such as:

- `ApartmentSvgStatus`;
- `ApartmentSvgSpaceFunction`;
- `ApartmentSvgSpaceEnclosure`;
- `ApartmentSvgWallAxis`;
- `ApartmentSvgWallClass`;
- `ApartmentSvgWindowOpeningType`;
- `ApartmentSvgWindowFrameMaterial`;
- `ApartmentSvgWindowGlassType`;
- `ApartmentSvgDoorType`;
- `ApartmentSvgFixedElementKind`;
- `ApartmentSvgUtilityKind`.

Conceptually:

```ts
export const VALUES = [
  "first",
  "second",
] as const;

export type Value = (typeof VALUES)[number];
```

The canonical runtime constants themselves SHOULD remain internal unless there is a deliberate reason they are part of the package API.

If the existing public type must remain exported while its backing value collection remains internal, structure modules accordingly.

Do not create two new lists that merely move the duplication to another location.

### Literal discriminators in schema-valid types

Literal discriminators such as:

```text
zone
wall
window
door
camera
radiator
fixed-object
ceiling-light
hinged
sliding
opening-only
```

SHOULD reuse canonical vocabulary in runtime construction and validation where appropriate.

Type-level literal occurrences needed to express discriminated unions MAY remain explicit when replacing them would make the TypeScript model less clear or materially more complex.

The goal is one authoritative runtime/schema definition, not removal of every useful literal type annotation.

### Allowed attribute sets

Element-specific validator `ALLOWED_ATTRIBUTES` collections SHOULD be built from canonical attribute-name constants.

This task does not require merging all element-specific allowed-attribute sets into one global table.

Keep element schema composition close to the element validator unless a small declarative mapping is clearly simpler.

### Runtime lookup collections

When runtime validation requires `Set` membership:

- define canonical values as readonly tuples/arrays or cohesive constant objects;
- derive `Set` objects from those values;
- do not maintain a tuple and a separately hand-written `Set` with duplicated members.

Mutable exported `Set` objects SHOULD be avoided.

### Appropriate literals that remain local

The refactor MUST intentionally leave some strings local.

Examples that generally should remain local include:

- human-readable error messages;
- `expected` prose;
- validation rule identifiers such as `window.data-wall` when they are diagnostic identifiers rather than Apartment SVG vocabulary;
- invariant/assertion messages;
- one-off implementation labels;
- test description strings;
- fixture contents;
- strings used only once when naming them would reduce readability.

A literal being a string is not sufficient reason to centralize it.

### Internal API boundary

The new schema-vocabulary definitions SHOULD be internal to `@planaxis/validator`.

Do not add public exports from:

```text
packages/validator/src/index.ts
```

solely to expose implementation constants.

Existing public type exports MUST remain available under their current names.

### No circular dependencies

Organize vocabulary and type derivation so the refactor does not introduce circular imports.

The vocabulary layer SHOULD be dependency-light.

Prefer:

```text
schema vocabulary
    ↓
schema-valid types / validation modules
```

rather than vocabulary importing validator implementations.

### No behavioral normalization

Do not change valid source values into different canonical strings as part of this task.

The constants define existing accepted vocabulary; they do not normalize input.

For example, do not accept case-insensitive enum values or aliases merely because values are now centralized.

## Technical and Architectural Constraints

The implementation MUST comply with repository architecture and coding rules.

Task-specific constraints:

- keep changes primarily inside `packages/validator`;
- preserve the parser → validator → later-stage separation;
- preserve exact decimal arithmetic;
- preserve public validator APIs;
- preserve existing package boundaries;
- use TypeScript `as const`, readonly tuples, literal inference, and derived union types where they simplify the source of truth;
- prefer domain-specific names over generic names such as `STRINGS`, `VALUES`, or `CONSTANTS`;
- keep canonical schema vocabulary easy to locate;
- do not create a class or service for static schema vocabulary;
- do not create a dependency-injection mechanism;
- do not create a generic schema registry framework;
- do not introduce a new package;
- do not add a new external dependency;
- do not weaken TypeScript settings;
- do not introduce `any`, `@ts-ignore`, or unsafe broad assertions;
- avoid circular imports;
- do not change validation logic as an incidental cleanup;
- do not move unrelated code merely to make the diff look more uniform;
- do not update generated or unrelated application code.

A small number of focused internal modules is preferable to one enormous catch-all constants file or many one-constant files.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/validator/src/
packages/validator/test/
```

A new internal source file such as the following is expected:

```text
packages/validator/src/schema-vocabulary.ts
```

or an equivalently cohesive name.

Existing validator files likely to require updates include:

```text
packages/validator/src/group-validation.ts
packages/validator/src/semantic-element-validation.ts
packages/validator/src/semantic-schema-validation.ts
packages/validator/src/schema-valid-apartment-svg.ts
packages/validator/src/space-schema-validation.ts
packages/validator/src/wall-schema-validation.ts
packages/validator/src/window-schema-validation.ts
packages/validator/src/door-schema-validation.ts
packages/validator/src/fixed-element-schema-validation.ts
packages/validator/src/utility-schema-validation.ts
packages/validator/src/camera-schema-validation.ts
packages/validator/src/semantic-value-validation.ts
```

Not every listed file must change if the final design keeps some literals appropriately local.

No repository documentation change is expected.

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

Task-specific dependency requirements or version constraints:

```text
No dependency changes are expected or required.
```

Do not add a dependency to implement constant organization or TypeScript literal derivation.

If an unexpected package or lockfile change appears necessary, report it as a deviation rather than proceeding with an unnecessary dependency addition.

## Testing Requirements

This task is primarily a structural refactor, so regression protection is more important than introducing new behavioral cases.

Tests MUST follow:

```text
docs/development/testing.md
```

### Existing validator coverage

All existing validator tests MUST continue to pass.

Do not weaken, skip, delete, or broadly rewrite tests merely because implementation constants moved.

Existing tests must continue protecting:

- document-level schema validation;
- semantic-element schema validation;
- enum validation;
- conditional attributes;
- exact-decimal handling;
- schema-valid representation construction;
- ID uniqueness;
- annotation opacity;
- stage separation from reference and geometric validation;
- structured validation errors.

### Behavioral equivalence

Where practical, retain or add focused regression assertions demonstrating that representative valid and invalid inputs produce unchanged public results after the refactor.

At minimum, existing coverage must exercise:

- one successful full-schema document;
- representative invalid semantic enum input;
- representative missing/invalid attribute input;
- representative duplicate-ID input;
- representative TASK-005 document-level error;
- schema-valid exact-decimal output.

### Type derivation

If exported union types are changed to derive from canonical value collections, `pnpm typecheck` MUST verify that existing validator code and tests continue to compile against the same public type names and accepted literals.

Do not add runtime tests that merely restate the contents of every constant collection unless they protect a meaningful contract.

### Internal constants

The task does not require direct tests for implementation-private constant objects solely because they exist.

Prefer testing validator behavior rather than the shape of internal implementation details.

### No fixture churn

Do not rewrite fixtures simply to use centralized constants.

Fixture files intentionally contain literal Apartment SVG source and should remain representative external documents.

## Documentation Requirements

None.

This refactor does not change the architecture, public processing stage, Apartment SVG specification, or repository development status.

Do not update architecture or README wording merely to mention internal constant organization.

Do not modify task artifacts under:

```text
docs/tasks/
```

## Verification

Run focused validator tests during implementation as useful.

Before completion, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

No dependency manifest or lockfile changes are expected.

If such files are changed despite the task expectation, also run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

and explain why the dependency-related change was necessary.

Do not report a verification step as successful unless it was actually executed successfully.

If a required command cannot be run, report exactly which command was not run and why.

## Acceptance Criteria

The task is complete only when all applicable criteria below are satisfied:

1. A cohesive internal source of truth exists for recurring normative Apartment SVG validator vocabulary.
2. The validator uses one authoritative SVG namespace URI definition.
3. Required/core group IDs are no longer independently duplicated across validator modules.
4. Repeated Apartment SVG attribute names are represented through cohesive canonical vocabulary where doing so improves consistency.
5. Runtime enum validation collections use canonical value definitions rather than independent duplicate literal lists.
6. Existing exported enum-like TypeScript union types are derived from canonical runtime value collections where practical.
7. Existing public type names remain available and compatible.
8. Existing public validator functions remain available and behaviorally compatible.
9. Element-specific allowed-attribute sets reuse canonical attribute vocabulary.
10. Semantic kind/discriminator literals are centralized where appropriate without damaging TypeScript model clarity.
11. No generic constants framework or new package is introduced.
12. Human-readable error messages, expected prose, and unrelated one-off strings are not indiscriminately centralized.
13. Validation error codes remain unchanged.
14. Validation categories and structured error semantics remain unchanged.
15. Existing valid inputs remain valid.
16. Existing invalid inputs remain invalid for the same schema reasons.
17. `SchemaValidApartmentSvgDocument` retains the TASK-006 trust boundary and data semantics.
18. Exact-decimal behavior remains unchanged.
19. References remain unresolved.
20. No reference, geometric, or topological validation is added.
21. No new external dependency is added.
22. Package manifests and `pnpm-lock.yaml` remain unchanged unless an explicitly documented deviation is unavoidable.
23. Existing tests pass without being weakened.
24. Required repository verification passes.
25. Architecture and package boundaries remain intact.
26. No unrelated changes are introduced.
27. No out-of-scope functionality is implemented.

## Final Response

When finished, provide a concise execution report containing:

1. a summary of the refactor;
2. the canonical schema-vocabulary module or modules introduced;
3. the main duplicate literal categories centralized;
4. the exported TypeScript union types changed to derive from canonical values;
5. the main validator files updated;
6. tests added or updated;
7. verification commands actually run and their results;
8. confirmation that public validation behavior and error codes remain unchanged;
9. dependency changes, or `None`;
10. deviations from this task description, or `None`;
11. follow-up work identified during execution, or `None`;
12. a suggested Conventional Commits message that includes:

```text
Task: TASK-007
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```
