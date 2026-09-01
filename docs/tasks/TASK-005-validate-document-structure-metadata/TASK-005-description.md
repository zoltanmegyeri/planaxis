# TASK-005: Validate Apartment SVG Document Structure and Metadata

## Context

PlanAxis has completed:

```text
TASK-001
repository bootstrap

TASK-002
server startup error handling

TASK-003
authoritative decimal geometry foundations

TASK-004
Apartment SVG XML/SVG parsing
```

The current processing pipeline is:

```text
Apartment SVG source
        ↓
XML / SVG parsing
        ↓
schema validation
        ↓
reference resolution
        ↓
geometric / topological validation
        ↓
ValidatedApartment2D
```

TASK-004 established the parsing boundary in `@planaxis/parser`.

The parser now converts syntactically valid XML into project-owned parsed structures while deliberately preserving schema-invalid information such as:

- missing or unknown attributes;
- duplicate metadata blocks;
- duplicate and unknown top-level groups;
- unknown root elements;
- raw lexical attribute values;
- XML namespace information;
- metadata CDATA/text node distinctions;
- semantic element nesting;
- unknown semantic structures.

The parser intentionally does not determine whether a successfully parsed document conforms to the Apartment SVG 2.1 schema.

The next architectural phase is therefore schema validation.

The complete Apartment SVG schema is too broad for one coherent delegated task. This task implements the first schema-validation slice:

```text
scalar lexical/value validation
        +
root <svg> validation
        +
metadata validation
        +
top-level document/group validation
```

Semantic-element schemas are intentionally deferred to a later task.

The validator package currently contains only its bootstrap skeleton, so this task also establishes the shared validation-result and structured-error foundation that later schema, reference, geometric, and topological validators can reuse.

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

Implement the document-level Apartment SVG 2.1 schema-validation foundation in `@planaxis/validator`.

The completed implementation must:

- consume the project-owned parsed representation produced by `@planaxis/parser`;
- establish reusable structured validation-result and validation-error contracts;
- establish reusable validation for the normative Apartment SVG scalar lexical/value types required by this and immediately following schema-validation work;
- validate the root `<svg>` document structure and root schema attributes;
- validate `viewBox` using exact decimal values after lexical validation;
- parse and validate the required metadata block without losing authoritative numeric precision;
- validate required and optional metadata fields, constants, ranges, conditional fields, and extension-key rules;
- validate the required top-level Apartment SVG groups and other permitted root-level structure;
- report schema failures as deterministic structured validation results rather than exceptions;
- collect independent validation errors where practical without producing misleading cascades;
- include focused automated tests and fixtures;
- remain strictly separated from semantic-element schema validation, reference resolution, geometric validation, and trusted-domain-model construction.

The completed task must establish a stable foundation on which later schema-validation tasks can build without implying that a document passing this stage is already a fully valid Apartment SVG.

## Scope

The task includes:

- implementing document-level schema validation in `@planaxis/validator`;
- adding a public, stage-specific validation entry point that accepts `ParsedApartmentSvgDocument`;
- establishing project-owned validation-result types;
- establishing project-owned structured validation-error types;
- defining stable `APSVG-*` validation codes for errors introduced by this task;
- validating applicable normative scalar lexical/value types;
- using the existing `@planaxis/geometry` decimal contract for authoritative numeric values;
- validating the Apartment SVG root element and namespace form;
- validating required root schema attributes and their values;
- validating `viewBox`;
- validating metadata element multiplicity and content form;
- parsing metadata JSON with preservation of authoritative numeric lexemes;
- validating metadata structure and values;
- validating metadata extension-key rules;
- validating optional geographic metadata;
- validating `TimeZoneId` values using a deterministic offline IANA-aware approach;
- validating required top-level groups and their multiplicity;
- validating permitted root-level non-semantic elements;
- validating extension-group handling;
- rejecting unknown non-extension top-level groups;
- validating document-level transform restrictions that apply to required core group containers;
- adding focused tests and fixtures for valid, invalid, and boundary cases;
- updating package manifests, test configuration, and the lockfile as required;
- updating current-state repository documentation when this task makes it inaccurate.

## Out of Scope

The task explicitly does **not** include:

- XML parsing;
- changing the `@planaxis/parser` parsing responsibility;
- accepting raw source text directly as the primary validator input;
- semantic-element schema validation for zones, walls, windows, doors, fixed elements, utilities, or cameras;
- validating whether semantic child elements use the correct SVG element type;
- validating semantic-element required, optional, conditional, or prohibited attributes;
- validating semantic-element enums such as wall axis, door type, status, utility kind, window material, or similar domain attributes;
- validating unknown or extension attributes on semantic elements;
- building the complete document-wide semantic-element ID index;
- detecting general duplicate semantic-element IDs;
- resolving references;
- validating `data-wall`;
- validating `data-radiator-below`;
- validating referenced element kinds;
- wall-axis geometric validation;
- checking whether semantic geometry lies inside the `viewBox`;
- window-to-wall geometric validation;
- door-to-wall geometric validation;
- door hinge or open-leaf validation;
- zone polygon validation;
- topology algorithms;
- overlap validation;
- collision validation;
- utility placement validation;
- camera collision validation;
- applying geometric tolerance to semantic geometry;
- constructing `ValidatedApartment2D`;
- constructing another partially trusted public apartment-domain model;
- constructing `ArchitecturalModel3D`;
- Three.js or renderer integration;
- HTTP, persistence, filesystem, or application-level validation behavior;
- changing the Apartment SVG 2.1 specification.

Do not implement semantic-element validation merely because the parsed representation already exposes the necessary elements and attributes.

Do not implement later reference or geometric validation merely because a document-level rule makes those future stages apparent.

## Functional Requirements

### Public validation entry point

`@planaxis/validator` MUST expose a deliberate document-schema validation entry point.

Its conceptual API is:

```ts
validateApartmentSvgDocumentSchema(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgValidationResult
```

The exact exported type names may be refined during implementation, but:

- the input MUST be the project-owned `ParsedApartmentSvgDocument` type or an equally deliberate parser-owned public type;
- the validator MUST NOT parse the XML source again;
- the function name and contract MUST make it clear that this is a schema-validation stage rather than complete Apartment SVG validation;
- passing this validation stage MUST NOT imply geometric conformance or production of `ValidatedApartment2D`.

Malformed XML remains the responsibility of `@planaxis/parser`.

### Validation result

Ordinary Apartment SVG schema failures are expected domain outcomes.

The validator MUST return a structured validation result rather than require callers to catch exceptions for schema-invalid documents.

Conceptually:

```text
valid document-level schema
    -> success result

invalid document-level schema
    -> result containing structured errors
```

The result MUST allow callers and tests to distinguish success from failure reliably.

Unexpected internal programming failures may still surface as exceptions where appropriate.

### Structured validation errors

TASK-005 MUST establish a reusable structured validation-error contract suitable for later schema, reference, geometric, topological, browser, and API use.

Each validation error MUST expose enough structured information to identify:

- a stable validation code;
- the affected element ID where applicable;
- an affected attribute where applicable;
- a metadata/property path where applicable;
- the violated rule or expected condition;
- the actual value when useful and representable;
- a useful human-readable diagnostic message.

The exact TypeScript shape may be chosen during implementation, but important diagnostic information MUST NOT exist only inside an opaque message string.

Validation codes MUST follow:

```text
APSVG-<CATEGORY>-<NUMBER>
```

Codes introduced by this task SHOULD use categories appropriate to the validated area, for example:

```text
APSVG-ROOT-...
APSVG-METADATA-...
APSVG-GROUP-...
```

Do not preallocate or invent codes for later semantic-element, reference, or geometric rules.

The codes introduced by this task form part of the observable validation contract and MUST be covered by tests.

### Validation error collection

The validator SHOULD collect independent errors during one validation pass where doing so is deterministic and meaningful.

For example, independent problems such as:

```text
wrong data-schema-version
missing required cameras group
unknown non-extension top-level group
```

should normally be reportable together.

The implementation MUST avoid misleading cascades.

For example:

- when metadata JSON cannot be parsed, do not additionally report every required metadata property as missing;
- when metadata multiplicity prevents choosing one authoritative metadata block, do not arbitrarily select one and produce misleading semantic errors from it;
- when a prerequisite value cannot be interpreted safely, dependent checks should not fabricate downstream failures.

Do not make incidental error ordering part of the public contract unless a deterministic ordering policy is deliberately introduced and documented.

### Scalar lexical/value validation

TASK-005 MUST establish reusable validators for these normative Apartment SVG scalar types:

```text
Id
Number
PositiveNumber
NonNegativeNumber
Boolean
Angle360
PitchAngle
Latitude
Longitude
ElevationMeters
TimeZoneId
```

Reference resolution for `Ref` is outside this task.

Scalar validation SHOULD separate:

```text
lexical conformance
```

from:

```text
exact value construction and range/value conformance
```

where that distinction is relevant.

### Apartment SVG `Number`

`Number` MUST conform to the Apartment SVG 2.1 lexical form:

```text
-?[0-9]+(\.[0-9]+)?
```

Values such as the following MUST be rejected as Apartment SVG `Number` values:

```text
1e3
1E3
NaN
Infinity
12cm
```

Do not introduce an arbitrary maximum number of digits as an Apartment SVG schema rule.

A lexically valid authoritative numeric value MUST be converted directly from its lexical representation through the project-owned decimal contract.

Do not route authoritative values through:

```text
Number
parseFloat
parseInt
```

or any equivalent JavaScript binary floating-point conversion.

Conceptually:

```ts
createDecimal(lexicalValue)
```

is valid after lexical conformance is established.

### Derived scalar types

The validator MUST enforce the specification-defined value constraints for:

```text
PositiveNumber
NonNegativeNumber
Angle360
PitchAngle
Latitude
Longitude
ElevationMeters
```

using authoritative decimal comparisons.

Boundary cases MUST follow the Apartment SVG 2.1 specification exactly.

In particular, tests must cover applicable inclusive and exclusive boundaries.

### `Id`

`Id` MUST conform to:

```text
[A-Za-z][A-Za-z0-9._-]*
```

TASK-005 validates `Id` lexical conformance where needed by document metadata.

General document-wide uniqueness of semantic-element IDs remains outside this task.

### `Boolean`

The only valid values are:

```text
true
false
```

Do not accept alternate spellings, capitalization, numeric substitutes, or truthy/falsy coercion.

### `TimeZoneId`

A `TimeZoneId` MUST be:

- a non-empty string;
- an IANA time-zone identifier as required by Apartment SVG 2.1.

Fixed-offset forms such as:

```text
+02:00
UTC+2
```

MUST NOT be accepted as substitutes for an IANA time-zone identifier.

Validation MUST use a deterministic, offline, IANA-aware mechanism appropriate for the supported Node.js and browser environments.

Do not validate time zones only using a superficial string-shape heuristic.

Do not perform network access during validation.

If an external dependency is required to provide reliable time-zone data or validation, follow the repository dependency-selection policy.

### Root `<svg>` validation

TASK-005 MUST validate the document-level root rules defined by Apartment SVG 2.1.

The validator MUST use the namespace and naming information preserved by `@planaxis/parser`.

It MUST distinguish the canonical Apartment SVG root structure required by the specification from namespace-equivalent XML forms that do not satisfy the required structure.

The required root must conform to the specification's `<svg>` naming and SVG namespace requirements.

Required root schema attributes include:

```text
viewBox
data-schema
data-schema-version
data-unit
```

The validator MUST enforce the exact specification values for:

```text
data-schema="apartment-svg"
data-schema-version="2.1"
data-unit="cm"
```

and every other root-level schema rule applicable to this task from Apartment SVG 2.1 sections 6 and 7.

Do not infer root validity from visual SVG behavior or general browser SVG permissiveness.

### `viewBox`

`viewBox` MUST contain exactly four Apartment SVG `Number` values as defined by the specification.

Conceptually:

```text
minX
minY
width
height
```

All four values MUST be lexically validated before authoritative decimal construction.

Required:

```text
width > 0
height > 0
```

The values MUST remain in the exact-decimal domain for authoritative validation.

TASK-005 MUST NOT validate whether all semantic geometry lies inside the `viewBox`.

That check requires semantic-element geometry and belongs to later validation work.

### Metadata multiplicity

The Apartment SVG root MUST contain exactly one required direct `<metadata>` element as defined by the specification.

The validator MUST detect:

```text
missing metadata
duplicate metadata
```

without silently choosing one occurrence.

### Metadata XML content form

The metadata block is required to contain its JSON object in CDATA according to Apartment SVG 2.1.

The validator MUST distinguish CDATA from ordinary XML text using the node-kind information preserved by `@planaxis/parser`.

The implementation MAY tolerate surrounding whitespace-only text nodes that result from normal XML formatting.

Meaningful ordinary text, child elements, multiple independent metadata payloads, or another structure inconsistent with the normative metadata form MUST be rejected.

Comments or other XML node types MUST be handled according to the normative metadata requirement rather than silently treated as metadata JSON.

### Lossless metadata JSON parsing

Metadata contains authoritative numeric facts, including values such as:

```text
level.baseZ
level.defaultCeilingHeight
location.latitude
location.longitude
location.elevationMeters
location.northHeading
```

The authoritative numeric path MUST preserve the original JSON numeric lexeme until the corresponding Apartment SVG numeric type has been validated and converted directly into the exact-decimal representation.

The implementation MUST NOT use ordinary JavaScript number parsing as an intermediate authoritative representation.

In particular, this pattern is prohibited for authoritative metadata values:

```text
metadata CDATA
    ↓
JSON.parse
    ↓
JavaScript number
    ↓
String(...)
    ↓
Decimal
```

because precision may already have been lost before `Decimal` construction.

The implementation MUST use a parsing approach that preserves JSON numeric tokens losslessly.

A focused external dependency MAY be introduced when necessary.

Third-party JSON parser types MUST remain behind project-owned validator internals and MUST NOT become the PlanAxis public validation contract merely for implementation convenience.

Malformed JSON MUST produce a structured metadata-validation error.

It MUST NOT be treated as malformed XML.

### Metadata root

The metadata CDATA payload MUST contain exactly one JSON object.

The following MUST NOT be accepted as the metadata root merely because they are valid JSON:

```text
array
string
number
boolean
null
```

### Required metadata structure

Validate the metadata structure and exact constants defined by Apartment SVG 2.1.

Required core data includes:

```text
schema

project.name
project.units

coordinateSystem.x
coordinateSystem.y
coordinateSystem.z

coordinateSystem.headingDegrees.0
coordinateSystem.headingDegrees.90
coordinateSystem.headingDegrees.180
coordinateSystem.headingDegrees.270

level.id
level.baseZ
level.defaultCeilingHeight
```

Required exact values include:

```text
schema = apartment-svg/2.1

project.units = cm

coordinateSystem.x = right
coordinateSystem.y = down
coordinateSystem.z = up

coordinateSystem.headingDegrees.0   = +x
coordinateSystem.headingDegrees.90  = +y
coordinateSystem.headingDegrees.180 = -x
coordinateSystem.headingDegrees.270 = -y
```

`project.name` MUST be a non-empty string.

`level.id` MUST conform to `Id`.

`level.baseZ` MUST conform to `Number`.

`level.defaultCeilingHeight` MUST conform to `PositiveNumber`.

The relationship between metadata `project.units` and root `data-unit` MUST satisfy the specification.

### Optional `location`

The complete `location` object is optional.

If no `location` object is present:

- the document MUST NOT fail merely because location is absent;
- the validator MUST NOT invent a geographic location;
- the validator MUST NOT invent a north heading;
- the validator MUST NOT infer a time zone or elevation.

If `location` is present, these fields are jointly required:

```text
latitude
longitude
northHeading
```

The optional fields are:

```text
elevationMeters
timeZone
```

Validate them according to:

```text
latitude        -> Latitude
longitude       -> Longitude
northHeading    -> Angle360
elevationMeters -> ElevationMeters
timeZone        -> TimeZoneId
```

Do not infer omitted `elevationMeters` or `timeZone`.

### Metadata JSON value types

Metadata fields MUST have the JSON value type required by the specification.

For example, a numeric field represented as a JSON string is not valid merely because its string contents look numeric.

Conceptually, this is invalid where a numeric value is required:

```json
{
  "baseZ": "0"
}
```

The validator MUST preserve the distinction between:

```text
JSON string
JSON number
JSON boolean
JSON null
JSON object
JSON array
```

while validating metadata.

### Metadata extension keys

Unknown keys in the metadata objects defined by Apartment SVG 2.1 are prohibited unless the key begins with:

```text
x-
```

The validator MUST enforce this rule at the applicable metadata object levels.

Core validation MUST ignore the semantic contents of accepted `x-*` extension keys.

Extension values MUST NOT become core PlanAxis geometric or semantic facts.

### Required top-level groups

Each of these direct root-level groups is required exactly once:

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

The validator MUST detect missing required groups.

The validator MUST detect multiple occurrences of a required group.

Group order MUST NOT affect validity.

An empty required group MUST be accepted.

### Required group form

A required top-level group MUST be represented by the correct direct `<g>` structure and identifier required by Apartment SVG 2.1.

A differently typed SVG element carrying a required group ID MUST NOT silently satisfy the required-group rule.

### Permitted root-level non-semantic elements

The following root-level non-semantic SVG elements are permitted as defined by Apartment SVG 2.1:

```text
style
defs
title
desc
```

Their visual or presentation contents MUST NOT influence apartment semantics.

Unknown root-level elements not permitted by Apartment SVG 2.1 MUST remain observable as validation errors rather than being silently discarded.

### Extension groups

An unknown direct top-level `<g>` may be accepted only when its identifier satisfies the Apartment SVG 2.1 extension-group form:

```text
x-*
```

The validator MUST reject unknown non-extension top-level groups.

The contents of accepted extension groups MUST NOT be interpreted as core Apartment SVG semantics by this task.

General document-wide duplicate-ID validation remains deferred.

### Core group transforms

Apply the Apartment SVG 2.1 transform prohibition to the required core semantic group containers covered by this task.

Do not reject transforms inside or on the `annotations` group when the specification permits them there.

Do not infer semantics from transformed annotation content.

### Root-level processing instructions

Use processing-instruction information preserved by the parser when required to enforce an explicit Apartment SVG 2.1 document-structure rule.

The permitted `xml-stylesheet` mechanism MUST NOT trigger network or filesystem access.

TASK-005 does not validate stylesheet contents and does not use CSS as apartment semantics.

Do not introduce broader processing-instruction restrictions that are not defined by the specification.

### Scope boundary for semantic contents

A document whose root, metadata, and top-level groups satisfy TASK-005 MUST NOT fail this validation stage merely because the contents of semantic groups are invalid under later semantic-element schema rules.

For example, TASK-005 MUST remain neutral to problems such as:

```text
wrong SVG child type inside walls
invalid data-kind
missing wall attributes
invalid wall data-axis
invalid door attributes
invalid utility kind
duplicate semantic IDs
broken data-wall reference
```

provided those problems do not independently violate a document-level rule owned by TASK-005.

This boundary MUST be protected by automated tests.

## Technical and Architectural Constraints

The implementation MUST comply with the repository architecture and development rules.

Task-specific constraints:

- implement this validation slice in `@planaxis/validator`;
- consume `@planaxis/parser` public parsed-document types rather than parsing XML again;
- use the `@planaxis/geometry` public decimal contract for authoritative numeric values;
- do not import `decimal.js` directly into validator code as a competing PlanAxis decimal boundary;
- do not convert authoritative numeric values through JavaScript `number`;
- keep parsed-but-unvalidated structures distinct from trusted domain models;
- do not introduce `ValidatedApartment2D`;
- do not introduce another public partially trusted apartment model merely to represent completion of this stage;
- do not move parser types into `@planaxis/model`;
- do not add final apartment-domain types to `@planaxis/model` speculatively;
- keep validation code reusable in both Node.js and browser environments where practical;
- do not use Node.js filesystem APIs in core validation;
- do not perform network access;
- do not depend on Three.js;
- do not depend on application packages;
- do not introduce HTTP concerns;
- do not use CSS, presentation, annotations, human-readable names, or visual appearance as semantic truth;
- do not silently repair invalid input;
- do not infer missing required data;
- use structured validation failures rather than exceptions for ordinary schema-invalid input;
- avoid circular dependencies;
- avoid speculative validation frameworks, rule engines, dependency-injection systems, plugin systems, or other infrastructure not required by the task;
- prefer focused modules and plain deterministic functions;
- do not introduce `any`, `@ts-ignore`, unsafe blanket assertions, or weaker TypeScript settings.

A direct dependency direction from:

```text
validator -> parser
validator -> geometry
```

is consistent with the intended architecture.

A dependency from parser or geometry back to validator is prohibited.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/validator/package.json
packages/validator/src/
packages/validator/test/
packages/validator/tsconfig.json
pnpm-lock.yaml
```

The task MAY add validator-specific build or test configuration when needed, for example:

```text
packages/validator/tsconfig.build.json
packages/validator/vitest.config.ts
```

Focused valid and invalid fixtures are expected where they materially improve schema-validation coverage:

```text
fixtures/valid/
fixtures/invalid/
```

Current-state documentation expected to change includes:

```text
docs/architecture/overview.md
```

Update `README.md` only if the completed implementation makes an existing current-state statement materially inaccurate.

Do not modify unrelated applications or shared packages merely for convenience.

Do not modify the Apartment SVG specification.

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
@planaxis/validator is expected to depend on the existing public APIs of:

@planaxis/parser
@planaxis/geometry
```

A focused lossless JSON dependency MAY be added if required to preserve metadata numeric lexemes correctly.

A focused time-zone-data or validation dependency MAY be added if required for deterministic offline IANA `TimeZoneId` validation across supported environments.

Do not add a general schema-validation framework merely to avoid implementing the explicitly defined Apartment SVG 2.1 rules.

Do not add another XML parser, another decimal implementation, or a general-purpose geometry engine.

## Testing Requirements

Add automated tests for all behavior introduced by this task.

Tests MUST follow:

```text
docs/development/testing.md
```

### Scalar validation tests

Cover the normative scalar validators introduced by the task.

For `Number`, include examples such as:

```text
valid:
0
-0
0.1
12.01
-42.75

invalid:
1e3
1E3
NaN
Infinity
12cm
```

Include applicable boundary tests for:

```text
PositiveNumber
NonNegativeNumber
Angle360
PitchAngle
Latitude
Longitude
```

Use authoritative exact-decimal values rather than JavaScript floating-point approximations.

### Exact metadata-number preservation

Add a test proving that authoritative metadata numeric values are not routed through JavaScript `number`.

Use at least one valid metadata numeric value whose exact decimal representation would be unsafe to treat as an IEEE-754 authoritative intermediate.

The test should protect the actual lossless parsing/conversion contract rather than merely checking that a small ordinary number happens to survive.

### Root validation tests

Cover at least:

- a valid canonical root;
- incorrect root element form;
- incorrect namespace form;
- missing required root attributes;
- invalid `data-schema`;
- invalid `data-schema-version`;
- invalid `data-unit`;
- valid `viewBox`;
- wrong `viewBox` arity;
- invalid `Number` lexeme in `viewBox`;
- zero `viewBox` width;
- negative `viewBox` width;
- zero `viewBox` height;
- negative `viewBox` height.

### Metadata XML-form tests

Cover at least:

- exactly one valid metadata block;
- missing metadata;
- duplicate metadata;
- valid CDATA metadata;
- malformed metadata JSON;
- ordinary meaningful text instead of required CDATA;
- prohibited child element or otherwise invalid metadata content form;
- normal formatting whitespace around the CDATA where allowed by the task requirements.

### Metadata schema tests

Cover at least:

- valid minimum metadata;
- missing required fields;
- incorrect JSON value types;
- invalid `schema`;
- empty `project.name`;
- invalid `project.units`;
- invalid coordinate-system constants;
- missing heading entries;
- incorrect heading values;
- invalid `level.id`;
- invalid `level.baseZ`;
- non-positive `level.defaultCeilingHeight`;
- mismatch between metadata units and root units where applicable.

### Location tests

Cover at least:

- metadata without `location`;
- complete valid `location`;
- missing `latitude` when `location` exists;
- missing `longitude` when `location` exists;
- missing `northHeading` when `location` exists;
- valid latitude boundary values;
- invalid latitude outside the allowed range;
- valid longitude boundary values;
- invalid longitude outside the allowed range;
- valid `northHeading` boundary behavior;
- invalid `northHeading`;
- optional `elevationMeters`;
- valid IANA time-zone identifiers;
- fixed-offset time-zone substitutes being rejected;
- clearly invalid/unknown time-zone identifier being rejected.

### Metadata extension tests

Cover at least:

- permitted `x-*` metadata extension key;
- prohibited unknown non-extension metadata key;
- an `x-*` value not altering core validation semantics.

### Top-level structure tests

Cover at least:

- all eight required groups exactly once;
- one missing required group;
- one duplicated required group;
- required groups in a different order;
- empty required groups;
- permitted root-level `style`, `defs`, `title`, and `desc`;
- unknown non-permitted root element;
- valid `x-*` extension group;
- unknown non-extension top-level group;
- applicable transform prohibition on a core semantic group;
- permitted annotation transform behavior.

### Scope-boundary tests

Add tests proving that TASK-005 does not accidentally implement TASK-006 or later validation stages.

At minimum, a document with otherwise valid root, metadata, and top-level structure MUST be able to pass TASK-005 despite containing semantic-group content that will later be rejected for reasons such as:

```text
wrong semantic SVG element type
invalid data-kind
missing semantic attributes
broken reference
```

provided the test content does not independently violate a document-level rule owned by TASK-005.

### Validation-result tests

Test structured error data rather than depending only on human-readable messages.

Assert stable error codes and relevant structured context.

Where multiple independent document-level failures are present, include coverage that demonstrates meaningful error aggregation.

Do not make incidental error ordering part of tests unless ordering is deliberately defined as a contract.

### Fixtures

Prefer small, focused fixtures under:

```text
fixtures/valid/
fixtures/invalid/
```

where full-document input improves confidence.

An invalid fixture SHOULD violate one primary rule where practical.

Do not use large user-facing examples as substitutes for focused validation fixtures.

Do not weaken, skip, or delete existing tests merely to make the task pass.

## Documentation Requirements

Update:

```text
docs/architecture/overview.md
```

to reflect the implementation state after TASK-005.

The updated current implementation phase should make clear that:

- Apartment SVG parsing remains complete;
- document/root/metadata/top-level schema validation is implemented;
- semantic-element schema validation remains the next schema-validation slice.

Do not rewrite the architecture as though the complete schema-validation phase, reference validation, geometric validation, or `ValidatedApartment2D` were already implemented.

Update:

```text
README.md
```

only if a current-state statement becomes materially inaccurate as a direct result of TASK-005.

Do not modify:

```text
docs/specifications/apartment-svg/2.1.md
```

as an implementation convenience.

Do not modify task artifacts under:

```text
docs/tasks/
```

## Verification

Run focused validator tests during implementation as useful.

Before completion, run the repository checks required by `AGENTS.md`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Because this task is expected to update package manifests and the lockfile, also run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

If an external dependency is added or updated, inspect current registry metadata and verify that the selected version satisfies the repository dependency policy.

`pnpm outdated --recursive` does not need to produce empty output when a newer stable release is incompatible. Every intentionally unselected newer stable release must instead have an explicit, evidence-backed compatibility justification.

Do not report a verification step as successful unless it was actually executed successfully.

If a required command cannot be run, report exactly which command was not run and why.

## Acceptance Criteria

The task is complete only when all applicable criteria below are satisfied:

1. `@planaxis/validator` exposes a stage-specific document-schema validation API consuming the project-owned parsed Apartment SVG representation.
2. The validator does not reparse XML.
3. Structured validation-result and validation-error contracts are established and exposed through the validator package's deliberate public API.
4. Stable `APSVG-*` codes are defined and tested for the validation errors introduced by this task.
5. The scalar lexical/value validators required by this task are implemented according to Apartment SVG 2.1.
6. Valid authoritative numeric values are converted directly from preserved lexical forms using the project-owned exact-decimal contract.
7. No authoritative numeric value introduced by this task is routed through JavaScript `number`.
8. Metadata JSON numeric lexemes remain lossless until Apartment SVG numeric validation and exact-decimal construction.
9. The canonical root `<svg>` form and required document-level schema attributes are validated.
10. `viewBox` is validated with exactly four Apartment SVG numeric values and positive width and height.
11. Exactly one conforming metadata block is required.
12. Metadata JSON structure, required fields, constants, JSON value types, numeric constraints, extension rules, and optional location data are validated according to Apartment SVG 2.1.
13. `TimeZoneId` validation is deterministic, offline, and IANA-aware rather than a syntax-only heuristic.
14. All eight required top-level groups are required exactly once.
15. Permitted non-semantic root elements and `x-*` extension groups are handled according to Apartment SVG 2.1.
16. Unknown non-extension root groups and prohibited root-level structures are reported through structured validation errors.
17. Applicable core-group transform restrictions are enforced without treating annotation transforms as core geometry.
18. Independent validation failures can be aggregated where meaningful without producing misleading cascades.
19. Semantic-element schema validation remains outside this task.
20. General semantic-element ID uniqueness remains outside this task.
21. Reference resolution remains outside this task.
22. Geometric and topological validation remain outside this task.
23. No `ValidatedApartment2D` or alternative partially trusted public apartment model is introduced.
24. Scope-boundary tests prove that semantic-element invalidity alone does not cause this document-level validation stage to fail.
25. Focused positive, negative, boundary, exact-decimal, metadata, group, and error-contract tests pass.
26. Repository documentation accurately describes the resulting implementation phase.
27. Required repository verification passes.
28. Architecture and package boundaries remain intact.
29. No unrelated changes are introduced.
30. No out-of-scope functionality is implemented.

If dependencies are added or updated:

- current registry metadata must be inspected for every changed external direct dependency;
- no selected direct dependency may be prerelease or deprecated unless explicitly required;
- the newest mutually compatible stable release must be selected, or an evidence-backed compatibility exception must be documented;
- repeated dependency versions must not drift across workspaces;
- package manifests and `pnpm-lock.yaml` must represent the same reviewed dependency set;
- `pnpm install --frozen-lockfile` must succeed.

## Final Response

When finished, provide a concise execution report containing:

1. a summary of the implementation;
2. the main files or areas changed;
3. tests and fixtures added or updated;
4. verification commands actually run and their results;
5. dependency versions added or updated, including any intentionally unselected newer stable release and its evidence-backed compatibility reason;
6. the validation API and structured error contract established by the task;
7. deviations from this task description, or `None`;
8. follow-up work identified during execution, or `None`;
9. a suggested Conventional Commits message that includes:

```text
Task: TASK-005
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```