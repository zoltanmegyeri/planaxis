# TASK-006: Validate Apartment SVG Semantic Element Schemas

## Context

PlanAxis currently implements the following deterministic processing stages:

```text
Apartment SVG source
        ↓
XML / SVG parsing
        ↓
document-level schema validation
        ↓
semantic-element schema validation
        ↓
reference resolution
        ↓
geometric / topological validation
        ↓
ValidatedApartment2D
```

TASK-004 established the parser-owned `ParsedApartmentSvgDocument` representation.

TASK-005 established the first Apartment SVG schema-validation slice in `@planaxis/validator`. That implementation validates:

- the canonical root element and namespace;
- required root schema attributes;
- `viewBox`;
- metadata multiplicity, CDATA/JSON form, required structure, exact numeric values, optional location data, and extension keys;
- required top-level groups and permitted root-level structures;
- reusable Apartment SVG scalar lexical/value types;
- structured `APSVG-*` validation errors.

TASK-005 also established the public stage-specific entry point:

```ts
validateApartmentSvgDocumentSchema(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgValidationResult
```

and the shared `ApartmentSvgValidationError` / `ApartmentSvgValidationResult` foundation.

The architecture identifies semantic-element schema validation as the next schema-validation slice.

This task completes Apartment SVG 2.1 schema validation by validating the contents of the seven core semantic groups:

```text
spaces
walls
windows
doors
fixed-elements
utilities
cameras
```

The `annotations` group remains non-semantic and opaque to core apartment validation.

Successful complete schema validation must additionally produce a project-owned intermediate representation containing validated typed semantic values. Authoritative numeric values must be represented with the existing exact-decimal contract. Attributes of type `Ref` must remain unresolved reference ID strings.

This intermediate representation is a schema-stage boundary only. It must be clearly distinguishable from `ValidatedApartment2D`, because reference integrity and geometric/topological conformance have not yet been established.

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

Complete the Apartment SVG 2.1 schema-validation phase in `@planaxis/validator`.

The completed implementation must:

- validate the common schema rules for core semantic elements;
- validate the element type, attributes, lexical/value types, enums, conditionals, and prohibitions defined for every core semantic group;
- enforce uniqueness of core semantic element IDs;
- continue using TASK-005 scalar validators and structured validation errors rather than creating parallel validation infrastructure;
- preserve exact numeric values directly in the authoritative decimal domain;
- preserve reference attributes as unresolved raw reference ID strings;
- produce a typed, project-owned schema-valid intermediate representation only after the complete document-level and semantic-element schema stages succeed;
- expose a deliberate public full-schema validation API;
- preserve the existing TASK-005 document-level validation API and behavior;
- provide a schema-valid semantic ID index suitable for later reference resolution;
- remain strictly separated from reference target validation, geometric/topological validation, and `ValidatedApartment2D`;
- include focused automated tests and fixtures protecting both positive behavior and the stage boundary.

After this task, the next architectural stage should be able to consume the schema-valid representation without reparsing XML attributes, revalidating scalar lexemes, or reconstructing authoritative decimals.

## Scope

The task includes:

- implementing semantic-element schema validation in `@planaxis/validator`;
- establishing a public full Apartment SVG schema-validation entry point;
- extending the existing structured validation-code/category contract for errors introduced by this task;
- validating the common semantic-element rules from Apartment SVG 2.1 section 9;
- validating the `Status` type from section 10;
- validating the `spaces` schema from section 11;
- validating the `walls` schema from section 12, excluding geometric axis consistency and other geometry rules;
- validating the `windows` schema from section 13, excluding reference and geometric rules;
- validating the `doors` schema from section 14, excluding reference and geometric rules;
- validating the `fixed-elements` schema from section 15, excluding reference and geometric rules;
- validating the `utilities` schema from section 16, excluding reference and geometric rules;
- validating the `cameras` schema from section 17, excluding collision rules;
- leaving `annotations` contents opaque and non-semantic;
- validating prohibited redundant geometric attribute names defined by Apartment SVG 2.1;
- enforcing document-wide uniqueness for core semantic element IDs as required for schema conformance;
- creating a unique core semantic ID index on successful schema validation;
- creating project-owned typed schema-valid element representations;
- representing all authoritative numeric semantic values with `@planaxis/geometry` `Decimal`;
- converting valid numeric attribute lexemes directly to `Decimal` without a JavaScript `number` round trip;
- parsing valid space `points` coordinates into exact-decimal point values while deferring polygon geometry/topology rules;
- preserving valid reference attributes as unresolved strings;
- refactoring TASK-005 validator internals where necessary to expose already-validated typed document-level values to the full-schema success representation without changing the existing TASK-005 public behavior;
- adding or updating automated tests and fixtures;
- updating current-state documentation when this task makes it inaccurate.

## Out of Scope

The task explicitly does **not** include:

- XML parsing;
- reparsing XML source inside the validator;
- changing the semantic responsibility of `@planaxis/parser`;
- reference target existence validation;
- validating whether `data-wall` points to an existing wall;
- validating whether `data-radiator-below` points to an existing radiator;
- resolving reference strings to object relationships;
- producing a reference-valid intermediate model;
- wall `data-axis` versus width/height geometric consistency;
- wall length, thickness, or centerline derivation as validation requirements;
- checking semantic geometry against the document `viewBox`;
- zone minimum-distinct-vertex validation;
- zone positive-area validation;
- zone self-intersection validation;
- zone/wall overlap validation;
- zone/zone overlap validation;
- window-to-wall footprint validation;
- window vertical opening versus wall-height validation;
- door-to-wall footprint validation;
- door opening-height versus wall-height validation;
- hinged-door hinge-position validation;
- hinged-door open-leaf geometry;
- door opening-direction derivation;
- utility placement on a wall;
- camera collision validation;
- window/window, door/door, or door/window overlap validation;
- geometric tolerance checks;
- silently repairing or normalizing invalid source geometry;
- applying inferred default wall height to replace an absent optional `data-height` field in the schema-stage representation;
- interpreting presentation attributes as semantic facts;
- interpreting extension attributes as core semantic facts;
- interpreting `annotations` contents as apartment semantics;
- constructing `ValidatedApartment2D`;
- constructing `ArchitecturalModel3D`;
- Three.js integration;
- renderer behavior;
- HTTP or application-level validation;
- persistence;
- changing Apartment SVG 2.1.

Do not implement reference or geometric validation merely because the schema-valid representation makes those later checks convenient.

## Functional Requirements

### Full schema validation API

`@planaxis/validator` MUST expose a deliberate full-schema validation entry point.

Its conceptual API is:

```ts
validateApartmentSvgSchema(
  document: ParsedApartmentSvgDocument,
): ApartmentSvgSchemaValidationResult
```

The exact exported type names may be refined during implementation, but the public contract MUST clearly communicate that:

- the input is the parser-owned parsed document;
- the operation validates complete Apartment SVG **schema conformance**;
- success returns a schema-valid intermediate representation;
- success does not imply reference integrity;
- success does not imply geometric or topological conformance;
- success does not produce `ValidatedApartment2D`.

The existing public function:

```ts
validateApartmentSvgDocumentSchema(...)
```

MUST remain available and retain its TASK-005 meaning and behavior.

Do not rename the TASK-005 function to make it appear that it already performs complete schema validation.

### Full-schema result

The full-schema result MUST distinguish success and failure explicitly.

Conceptually:

```ts
type ApartmentSvgSchemaValidationResult =
  | {
      readonly valid: true;
      readonly errors: readonly [];
      readonly document: SchemaValidApartmentSvgDocument;
    }
  | {
      readonly valid: false;
      readonly errors: readonly ApartmentSvgValidationError[];
    };
```

Equivalent project-owned naming is acceptable.

A schema-valid document MUST NOT be returned when any document-level or semantic-element schema error remains.

Ordinary schema-invalid input MUST remain a structured domain outcome rather than requiring callers to catch exceptions.

### Relationship to TASK-005 validation

The full-schema validator MUST reuse the TASK-005 document-level rules rather than duplicate or independently reimplement them.

It is acceptable and expected to refactor TASK-005 internals so the complete schema path can retain typed document-level values such as:

- exact `viewBox` values;
- validated metadata;
- exact metadata numeric values.

Any such refactor MUST preserve the observable behavior and public contract of:

```ts
validateApartmentSvgDocumentSchema(...)
```

Do not parse metadata a second time merely to construct the schema-valid representation if a clean internal refactor can retain the already-validated data.

### Error aggregation across schema stages

The full-schema validator SHOULD aggregate independent document-level and semantic-element errors where doing so is deterministic and useful.

It MUST avoid misleading dependent cascades.

For example:

- if a required group is missing, do not fabricate child-element errors for that group;
- if a required group occurs more than once and its authoritative contents are ambiguous, do not arbitrarily choose one group for schema-valid model construction;
- if an element attribute is missing, do not additionally report a lexical error for a value that does not exist;
- if an enum discriminator is invalid, conditional rules depending on that discriminator should not fabricate contradictory required/prohibited-attribute errors unless the result is unambiguous.

No schema-valid intermediate representation may be produced unless all required schema stages succeed.

### Structured validation codes

Continue using the existing `ApartmentSvgValidationError` foundation.

Extend `APARTMENT_SVG_VALIDATION_CODES` and the validation category type only as required by TASK-006.

Codes MUST continue to follow:

```text
APSVG-<CATEGORY>-<NUMBER>
```

Use stable categories that communicate the rule domain clearly.

Appropriate categories may include common semantic-element or ID errors and element-specific categories such as zone, wall, window, door, fixed-element, utility, and camera.

Do not introduce `REF` error codes for target existence or target-kind failures in this task.

Do not introduce geometric error codes for rules deliberately deferred from this task.

New error codes form part of the observable validator contract and MUST be tested.

### Schema-valid intermediate representation

TASK-006 MUST define and publicly export a project-owned schema-valid intermediate representation from `@planaxis/validator`.

The representation SHOULD use a name that explicitly communicates the trust level, such as:

```text
SchemaValidApartmentSvgDocument
```

or an equivalently explicit name.

Do not call this type:

```text
ValidatedApartment2D
ValidatedApartment
ApartmentModel
```

or another name that implies reference-valid or geometrically validated domain truth.

The representation belongs to the validation-stage contract and SHOULD remain in `@planaxis/validator` for this task rather than introducing partially trusted apartment types into `@planaxis/model`.

### Intermediate representation contents

The schema-valid representation MUST preserve the core Apartment SVG information needed by later reference and geometric validation without requiring downstream code to return to raw XML attributes.

It MUST include, in project-owned typed form:

- validated exact `viewBox` values;
- validated core metadata needed downstream;
- exact metadata numeric values;
- optional validated location data when present;
- all core `spaces`;
- all core `walls`;
- all core `windows`;
- all core `doors`;
- all core `fixed-elements`;
- all core `utilities`;
- all core `cameras`;
- a unique index of core semantic elements by ID.

The representation MUST preserve all core semantic attributes defined by the specification that are meaningful to downstream PlanAxis behavior.

Attributes that are specification constants after successful validation MAY use literal TypeScript types or otherwise be normalized without information loss.

Presentation-only SVG attributes and `data-x-*` extension attributes MUST NOT become core semantic facts in this representation.

The internal contents of `annotations` MUST NOT become semantic entities in this representation.

### Exact numeric representation

Every authoritative numeric value in the schema-valid representation MUST use the project-owned `Decimal` type from `@planaxis/geometry`.

This includes, where applicable:

- `viewBox` values;
- metadata numeric values;
- space point coordinates;
- wall coordinates and dimensions;
- optional wall `data-height`;
- window coordinates, dimensions, sill height, and opening height;
- door coordinates, dimensions, opening height, hinge coordinates, and open-leaf coordinates;
- fixed-element coordinates, dimensions, base Z, and height;
- utility coordinates, marker radius, and Z;
- camera coordinates, marker radius, Z, heading, pitch, and horizontal FOV.

Numeric XML attribute values MUST be validated with the existing TASK-005 scalar-validation foundation.

Authoritative values MUST be constructed directly from their validated lexical strings.

The implementation MUST NOT use:

```ts
Number(...)
parseFloat(...)
parseInt(...)
```

or an equivalent JavaScript binary floating-point round trip as an authoritative numeric intermediate.

### Raw references

Attributes whose Apartment SVG type is `Ref` MUST remain unresolved strings in the schema-valid representation.

Examples include:

```text
window.data-wall
window.data-radiator-below
door.data-wall
radiator.data-wall
wall-associated utility.data-wall
```

The string value MUST be preserved as the reference ID to be resolved by the later reference-validation stage.

TASK-006 MUST validate the presence/absence rules of reference attributes and reject an empty reference value where a `Ref` value is required or present.

TASK-006 MUST NOT:

- check whether the target exists;
- check whether the target has the required `data-kind`;
- replace the raw reference ID with an object;
- silently remove a broken reference.

A non-empty unresolved reference may therefore be schema-valid even when TASK-007 will later reject it.

### Semantic ID index

Every core semantic element MUST have an `id` conforming to the existing Apartment SVG `Id` validator.

Core semantic IDs MUST be unique across the core semantic document.

The task MUST build a unique semantic-element ID index as part of successful schema validation.

The index MUST allow later reference-resolution code to identify the schema-valid semantic element associated with an ID without reparsing the document.

The index MUST NOT make annotation elements referenceable core entities.

If a core semantic element ID conflicts with an ID already used by another core semantic element or a required/extension root group participating in the core document structure, report a structured ID/schema error rather than silently choosing one.

### Common semantic-element rules

For every core semantic element in:

```text
spaces
walls
windows
doors
fixed-elements
utilities
cameras
```

validate the common rules from Apartment SVG 2.1.

A core semantic element MUST:

- be a direct child of its corresponding required top-level group;
- use the permitted SVG element type for that group;
- be in the SVG namespace;
- have a valid unique `id`;
- have the required `data-kind`;
- not have a `transform` attribute;
- not contain nested semantic elements.

Semantic elements MUST NOT be discovered or interpreted from arbitrary descendants outside their corresponding direct top-level group.

### Permitted SVG presentation attributes

Standard SVG presentation attributes permitted by Apartment SVG 2.1, such as:

```text
class
style
fill
stroke
opacity
```

MUST be accepted and ignored for core semantics.

The implementation MUST distinguish permitted presentation attributes from geometry-modifying or semantic attributes that are not permitted by the Apartment SVG schema.

Do not use browser rendering behavior or CSS to infer apartment facts.

The validation implementation SHOULD use a deterministic project-owned allowlist or another environment-independent mechanism rather than relying on browser DOM behavior.

### Extension attributes

An unknown `data-*` attribute on a core semantic element is prohibited unless its name begins with:

```text
data-x-
```

Accepted `data-x-*` attributes MUST be ignored by core semantics and MUST NOT alter the schema-valid typed representation.

### Prohibited and unknown attributes

Attributes defined by the applicable semantic-element schema table are permitted according to their required/optional/conditional rules.

Permitted SVG presentation attributes are also allowed.

A non-presentation SVG attribute that changes geometry or behavior but is not permitted by Apartment SVG 2.1 MUST be rejected rather than silently ignored.

The following redundant geometric attribute names are prohibited on core semantic elements as defined by Apartment SVG 2.1:

```text
data-length
data-width
data-depth
data-opening-width
```

Do not treat an unknown non-extension `data-*` attribute as harmless metadata.

### `Status`

Where `data-status` is required or permitted, validate exactly:

```text
fixed
modifiable
proposal
```

Do not accept alternate capitalization or aliases.

Represent a validated status with an explicit project-owned literal/enum-like TypeScript type rather than generic `string`.

### `spaces`

The `spaces` group permits only direct SVG:

```xml
<polygon>
```

Each space MUST validate:

```text
id                         Id, required
points                     coordinate list, required
data-kind                  "zone", required
data-name                  non-empty string, required
data-function              required enum
data-function-description  conditional non-empty string
data-enclosure             required enum
```

Permitted `data-function` values are:

```text
living-room
dining
kitchen
bedroom
bathroom
toilet
hall
corridor
entrance
home-office
storage
utility
balcony
other
```

When:

```text
data-function="other"
```

`data-function-description` is required and non-empty.

For every other valid `data-function`, `data-function-description` is prohibited.

Permitted `data-enclosure` values are:

```text
closed
partial
open
```

#### Space `points`

The `points` attribute MUST be parsed as an SVG polygon coordinate list whose coordinate components conform to the Apartment SVG `Number` lexical rules.

Every accepted coordinate component MUST be converted directly to exact `Decimal`.

The schema-valid representation SHOULD expose the parsed coordinates through project-owned exact-decimal point values, reusing `@planaxis/geometry` `Point2D` where appropriate.

TASK-006 validates coordinate-list syntax and coordinate numeric lexemes.

TASK-006 MUST NOT validate:

- at least three distinct vertices;
- positive polygon area;
- polygon self-intersection;
- zone/wall relationships;
- zone/zone overlap.

Those are geometric/topological rules for later tasks.

### `walls`

The `walls` group permits only direct SVG:

```xml
<rect>
```

Each wall MUST validate:

```text
id           Id, required
x            Number, required
y            Number, required
width        PositiveNumber, required
height       PositiveNumber, required
data-kind    "wall", required
data-axis    "x" | "y", required
data-height  PositiveNumber, optional
data-class   "interior" | "exterior", required
data-status  Status, required
```

The schema-valid representation MUST preserve optional `data-height` as optional.

Do not synthesize `metadata.level.defaultCeilingHeight` into the wall representation when `data-height` is absent.

TASK-006 MUST NOT validate:

```text
data-axis="x" -> width > height
data-axis="y" -> height > width
```

or square-wall rejection.

Those rules require geometric interpretation and remain deferred.

### `windows`

The `windows` group permits only direct SVG:

```xml
<rect>
```

Each window MUST validate:

```text
id                               Id, required
x                                Number, required
y                                Number, required
width                            PositiveNumber, required
height                           PositiveNumber, required
data-kind                        "window", required
data-wall                        Ref, required
data-sill-height                 NonNegativeNumber, required
data-opening-height              PositiveNumber, required
data-opening-type                optional enum
data-frame-material              optional enum
data-frame-material-description  conditional non-empty string
data-frame-color                 optional string
data-glass-type                  optional enum
data-glass-type-description      conditional non-empty string
data-radiator-below              optional Ref
data-status                      Status, required
```

Permitted `data-opening-type` values are:

```text
fixed
casement
tilt
tilt-turn
sliding
```

Permitted `data-frame-material` values are:

```text
wood
plastic
aluminium
steel
other
```

When `data-frame-material="other"`, `data-frame-material-description` is required and non-empty.

For every other valid frame material, `data-frame-material-description` is prohibited.

Permitted `data-glass-type` values are:

```text
clear
frosted
tinted
other
```

When `data-glass-type="other"`, `data-glass-type-description` is required and non-empty.

For every other valid glass type, `data-glass-type-description` is prohibited.

TASK-006 MUST NOT:

- resolve `data-wall`;
- resolve `data-radiator-below`;
- validate window footprint against a wall;
- validate opening width from wall axis;
- validate sill height plus opening height against effective wall height.

### `doors`

The `doors` group permits only direct SVG:

```xml
<rect>
```

Each door MUST validate:

```text
id                Id, required
x                 Number, required
y                 Number, required
width             PositiveNumber, required
height            PositiveNumber, required
data-kind         "door", required
data-wall         Ref, required
data-door-type    required enum
data-opening-height PositiveNumber, required
data-hinge-x      Number, conditional
data-hinge-y      Number, conditional
data-open-leaf-x  Number, conditional
data-open-leaf-y  Number, conditional
data-status       Status, required
```

Permitted `data-door-type` values are:

```text
hinged
sliding
opening-only
```

For:

```text
data-door-type="hinged"
```

all four hinge/open-leaf attributes are required:

```text
data-hinge-x
data-hinge-y
data-open-leaf-x
data-open-leaf-y
```

For:

```text
data-door-type="sliding"
data-door-type="opening-only"
```

all four hinge/open-leaf attributes are prohibited.

TASK-006 validates only the conditional presence and numeric schema of those fields.

It MUST NOT validate:

- the supporting wall reference target;
- door footprint against a wall;
- door opening height against effective wall height;
- hinge position;
- open-leaf distance;
- open-leaf perpendicularity;
- opening direction.

### `fixed-elements`

The `fixed-elements` group permits only direct SVG:

```xml
<rect>
```

Each fixed element MUST validate:

```text
id                     Id, required
x                      Number, required
y                      Number, required
width                  PositiveNumber, required
height                 PositiveNumber, required
data-kind              required enum
data-base-z            NonNegativeNumber, required
data-height            PositiveNumber, required
data-wall              conditional Ref
data-type-description  conditional non-empty string
data-status            Status, required
```

Permitted `data-kind` values are:

```text
radiator
column
shaft
chimney
boiler
built-in
air-conditioner
stair
mechanical-box
fixed-object
```

For `radiator`, `data-wall` is optional.

For every other fixed-element kind, `data-wall` is prohibited.

For:

```text
data-kind="fixed-object"
```

`data-type-description` is required and non-empty.

For every other valid fixed-element kind, `data-type-description` is prohibited.

The specification recommendation that a column typically uses `data-base-z="0"` and the default ceiling height is not a mandatory schema error and MUST NOT be converted into one.

TASK-006 MUST NOT resolve an optional radiator `data-wall`.

### `utilities`

The `utilities` group permits only direct SVG:

```xml
<circle>
```

Each utility MUST validate:

```text
id           Id, required
cx           Number, required
cy           Number, required
r            PositiveNumber, required
data-kind    required enum
data-z       NonNegativeNumber, required
data-wall    conditional Ref
data-status  optional Status
```

Permitted `data-kind` values are:

```text
socket
ethernet
tv-coax
light-switch
ceiling-light
wall-light
```

For:

```text
socket
ethernet
tv-coax
light-switch
wall-light
```

`data-wall` is required.

For:

```text
ceiling-light
```

`data-wall` is prohibited.

The `r` value is a visual marker radius but still must satisfy its schema type.

TASK-006 MUST NOT resolve `data-wall` or validate whether `(cx, cy)` lies on the referenced wall.

### `cameras`

The `cameras` group permits only direct SVG:

```xml
<circle>
```

Each camera MUST validate:

```text
id                   Id, required
cx                   Number, required
cy                   Number, required
r                    PositiveNumber, required
data-kind            "camera", required
data-z               NonNegativeNumber, required
data-heading         Angle360, required
data-pitch           PitchAngle, required
data-horizontal-fov  Number with 0 < value < 180, required
```

`data-horizontal-fov` MUST first satisfy the Apartment SVG `Number` lexical rule and then the exact-decimal range:

```text
0 < FOV < 180
```

TASK-006 MUST NOT perform camera collision validation against walls or fixed elements.

### `annotations`

The `annotations` group is non-semantic.

TASK-006 MUST NOT interpret annotation child elements as core apartment entities.

Annotation contents may include drawing elements and nested groups permitted by Apartment SVG 2.1, including transforms.

Do not:

- apply core semantic-element schema rules to annotation children;
- include annotation elements in the core semantic ID index;
- create typed apartment semantic entities from annotation contents.

Root/group-level validation already established by TASK-005 remains authoritative for the annotations group container itself.

### Schema-stage trust boundary

A document that succeeds in TASK-006 is trusted for:

- XML parsing having succeeded;
- document-level schema conformance;
- semantic-element schema conformance;
- exact parsing of authoritative numeric values;
- validated core enum/string/conditional attribute rules;
- uniqueness of core semantic IDs;
- availability of unresolved reference ID strings.

It is **not** trusted for:

- reference existence;
- reference target kinds;
- reference relationships;
- geometric conformance;
- topology;
- overlap/collision rules.

The schema-valid type and API documentation MUST make this boundary apparent.

## Technical and Architectural Constraints

The implementation MUST comply with the repository architecture and development rules.

Task-specific constraints:

- implement this task primarily in `@planaxis/validator`;
- consume only public parser-owned parsed-document types from `@planaxis/parser`;
- reuse `@planaxis/geometry` for `Decimal` and exact point values;
- reuse TASK-005 scalar-validation functions;
- reuse the TASK-005 structured error/result foundation;
- preserve the public behavior of `validateApartmentSvgDocumentSchema`;
- do not create a second schema-validation framework parallel to TASK-005;
- do not parse XML source again;
- do not convert authoritative numeric values through JavaScript `number`;
- do not import `decimal.js` directly as a competing validator numeric boundary;
- keep the schema-valid intermediate representation in `@planaxis/validator` for this task;
- do not introduce partially trusted semantic models into `@planaxis/model`;
- do not introduce `ValidatedApartment2D`;
- do not resolve references;
- do not introduce geometric validation;
- keep core validation reusable in Node.js and browser environments;
- do not use Node.js filesystem APIs in core validation;
- do not perform network access;
- do not depend on Three.js;
- do not depend on application packages;
- do not infer semantic facts from CSS or presentation;
- do not infer semantic facts from annotations;
- do not infer semantic facts from `data-x-*` extensions;
- do not silently repair invalid input;
- avoid circular dependencies;
- prefer explicit project-owned types, literal unions, small validators, and deterministic functions;
- keep domain-specific semantic schema logic in focused modules rather than a catch-all helper;
- do not introduce a general schema library or rule engine without demonstrated necessity;
- do not introduce `any`, `@ts-ignore`, unsafe blanket assertions, or weakened TypeScript settings.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/validator/src/
packages/validator/test/
fixtures/valid/
fixtures/invalid/
docs/architecture/overview.md
```

The following may change if required by implementation:

```text
packages/validator/package.json
packages/validator/tsconfig*.json
packages/validator/vitest.config.ts
pnpm-lock.yaml
README.md
```

No change to `@planaxis/model` is expected for this task.

Do not modify:

```text
docs/specifications/apartment-svg/2.1.md
```

unless an actual specification defect is discovered and the task cannot be completed faithfully without escalating it. Do not silently redefine the specification inside implementation code.

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
No new external dependency is expected.

Reuse the existing validator dependencies on:
- @planaxis/parser
- @planaxis/geometry

Reuse TASK-005 external dependencies only where their existing responsibilities remain relevant.
```

Do not add a second XML parser, decimal implementation, general schema-validation framework, geometry engine, or reference-resolution library.

## Testing Requirements

Add or update automated tests for all behavior introduced or changed by this task.

Tests MUST follow:

```text
docs/development/testing.md
```

### Full-schema API tests

Cover at least:

- a fully schema-conformant document returning success;
- success returning a typed schema-valid intermediate document;
- a document-level TASK-005 failure remaining a full-schema failure;
- a semantic-element schema failure returning structured errors;
- no schema-valid document being returned on failure;
- existing `validateApartmentSvgDocumentSchema` behavior remaining intact.

### Intermediate representation tests

Verify that a successful schema-valid representation contains:

- exact `Decimal` `viewBox` values;
- exact `Decimal` metadata values;
- typed exact semantic numeric values;
- typed enum values;
- optional values only when present;
- raw unresolved reference strings;
- a unique semantic ID index;
- no annotation-derived semantic entities.

Use at least one long/high-precision numeric attribute value that would be unsafe to treat as an authoritative IEEE-754 intermediate.

Tests MUST demonstrate that the original valid lexical numeric value reaches the exact-decimal representation without precision loss.

### Common semantic-rule tests

Cover at least:

- valid direct child in the corresponding group;
- wrong SVG element type for a group;
- wrong SVG namespace;
- missing `id`;
- invalid `id`;
- duplicate semantic IDs across different groups;
- semantic ID collision with a core/root group ID where applicable;
- missing `data-kind`;
- incorrect `data-kind`;
- prohibited `transform`;
- nested semantic element;
- permitted presentation attributes;
- permitted `data-x-*` attribute;
- prohibited unknown non-extension `data-*` attribute;
- prohibited unrecognized geometry-modifying attribute;
- prohibited redundant geometric attributes.

### `spaces` tests

Cover at least:

- valid zone;
- wrong element type;
- valid exact-decimal coordinate list;
- invalid coordinate numeric lexeme;
- malformed coordinate list;
- empty `data-name`;
- every accepted `data-function` through representative/table-driven coverage;
- invalid `data-function`;
- `other` requiring non-empty description;
- non-`other` prohibiting description;
- valid and invalid `data-enclosure`.

Include a scope-boundary case showing that syntactically valid polygon coordinates may pass schema validation even when the polygon will later fail a geometric/topological rule.

### `walls` tests

Cover at least:

- valid wall;
- required numeric attributes;
- positive width/height;
- valid and invalid axis;
- optional positive `data-height`;
- valid and invalid class;
- required status.

Include a scope-boundary case where a wall has schema-valid attributes but geometrically inconsistent `data-axis` versus dimensions and still passes TASK-006.

### `windows` tests

Cover at least:

- valid window;
- required unresolved `data-wall`;
- empty required Ref rejected;
- `NonNegativeNumber` sill height;
- positive opening height;
- every opening-type enum through representative/table-driven coverage;
- frame material conditional description;
- glass type conditional description;
- optional frame color;
- optional unresolved `data-radiator-below`;
- status.

Include a scope-boundary case with a non-existent `data-wall` ID that still passes schema validation.

### `doors` tests

Cover at least:

- valid hinged door;
- valid sliding door;
- valid opening-only door;
- invalid door type;
- hinged door requiring all four hinge/open-leaf numeric attributes;
- sliding/opening-only door prohibiting all four hinge/open-leaf attributes;
- required unresolved `data-wall`;
- positive opening height;
- status.

Include a scope-boundary case with schema-valid but geometrically incorrect hinge/open-leaf coordinates that still passes TASK-006.

### `fixed-elements` tests

Cover at least:

- every permitted `data-kind` through representative/table-driven coverage;
- valid exact dimensions/base Z/height;
- radiator permitting optional unresolved `data-wall`;
- non-radiator prohibiting `data-wall`;
- fixed-object requiring non-empty `data-type-description`;
- all other kinds prohibiting `data-type-description`;
- status.

Do not turn the recommendation for column base Z/default height into a failing test.

### `utilities` tests

Cover at least:

- every utility `data-kind`;
- valid exact `cx`, `cy`, `r`, and `data-z`;
- positive marker radius;
- wall-associated types requiring unresolved `data-wall`;
- ceiling-light prohibiting `data-wall`;
- optional valid status;
- invalid status.

Include a scope-boundary case where a wall-associated utility references a non-existent wall and still passes schema validation.

### `cameras` tests

Cover at least:

- valid camera;
- exact coordinates and Z;
- positive marker radius;
- Angle360 boundaries;
- PitchAngle boundaries;
- horizontal FOV just above 0;
- horizontal FOV just below 180;
- horizontal FOV equal to 0 rejected;
- horizontal FOV equal to 180 rejected;
- invalid Number lexeme for FOV.

Include a scope-boundary case where a schema-valid camera would later geometrically collide with another element but still passes TASK-006.

### Annotations tests

Cover at least:

- annotation children not being interpreted as core semantic elements;
- nested annotation groups being tolerated according to the specification;
- annotation transforms not causing semantic-element transform errors;
- annotation IDs not becoming referenceable entries in the core semantic ID index.

### Stage-boundary tests

Add explicit regression tests proving TASK-006 does not perform TASK-007 or geometric validation.

At minimum, schema validation MUST be able to succeed for otherwise schema-conformant documents containing:

- a broken non-empty `data-wall` reference;
- a broken non-empty `data-radiator-below` reference;
- a wall whose axis is geometrically inconsistent with its dimensions;
- a window not geometrically positioned on its referenced wall;
- a door with geometrically invalid hinge/open-leaf coordinates;
- a utility not geometrically located on its referenced wall;
- a camera positioned inside a wall/fixed-element volume;
- a syntactically valid but geometrically invalid zone polygon.

These cases protect the architectural separation between schema validation, reference validation, and geometry.

### Error-contract tests

Assert stable `APSVG-*` codes and structured context.

Prefer assertions against:

- code;
- category;
- element ID;
- attribute;
- rule;
- actual value;
- expected condition.

Do not depend solely on human-readable message text.

Where several independent semantic schema failures exist, include coverage for meaningful deterministic aggregation without requiring incidental array order unless ordering is deliberately documented.

### Fixtures

Use small focused fixtures where full-document behavior is important.

Prefer:

```text
fixtures/valid/
fixtures/invalid/
```

Invalid fixtures SHOULD violate one primary rule where practical.

Do not replace focused unit-level semantic schema tests with a large fixture matrix when smaller project-owned parsed structures are clearer.

Do not weaken, skip, or delete existing TASK-005 tests merely to make TASK-006 pass.

## Documentation Requirements

Update:

```text
docs/architecture/overview.md
```

to describe the resulting implementation state after TASK-006.

The updated current implementation phase should make clear that:

- Apartment SVG parsing is complete;
- document-level schema validation is complete;
- semantic-element schema validation is complete;
- the validator now produces a schema-valid typed intermediate representation;
- references remain unresolved in that representation;
- reference resolution/referential validation is the next implementation stage;
- geometric/topological validation and `ValidatedApartment2D` remain unimplemented.

Update:

```text
README.md
```

only if a current-state statement becomes materially inaccurate after TASK-006.

Do not describe complete schema conformance as complete Apartment SVG validation.

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

Before completion, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If package manifests or the lockfile are changed, also run:

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

1. `@planaxis/validator` exposes a deliberate full Apartment SVG schema-validation API.
2. The existing `validateApartmentSvgDocumentSchema` public API remains available with its TASK-005 behavior intact.
3. Full-schema success returns a project-owned schema-valid intermediate representation.
4. The schema-valid representation is clearly distinguished from `ValidatedApartment2D`.
5. The schema-valid representation remains in the validator-stage boundary rather than introducing partially trusted apartment types into `@planaxis/model`.
6. Document-level validation rules are reused rather than duplicated.
7. All core semantic element groups are validated according to their Apartment SVG 2.1 schema tables.
8. Common semantic-element direct-child, element-type, namespace, `id`, `data-kind`, transform, and nesting rules are enforced.
9. Core semantic element IDs are validated and unique.
10. A unique core semantic ID index is produced on success.
11. Standard permitted SVG presentation attributes do not affect semantic validation.
12. Unknown non-extension `data-*` attributes are rejected.
13. `data-x-*` extension attributes are accepted but excluded from core semantic meaning.
14. Prohibited redundant geometric attributes are rejected.
15. `Status` is validated and represented as a typed value.
16. `spaces` schema, enums, conditionals, and exact-decimal point coordinate syntax are validated.
17. `walls` required/optional attributes and enums are validated without enforcing geometric axis consistency.
18. `windows` attributes, enums, conditionals, exact numeric values, and raw references are validated without resolving targets or checking wall geometry.
19. `doors` attributes, door-type conditionals, exact numeric values, and raw wall reference are validated without geometric hinge/open-leaf checks.
20. `fixed-elements` attributes, kinds, conditional `data-wall`, conditional type description, exact numeric values, and status are validated.
21. `utilities` attributes, kinds, conditional raw wall reference, exact numeric values, and optional status are validated.
22. `cameras` attributes and exact numeric constraints, including `0 < data-horizontal-fov < 180`, are validated without collision checks.
23. Annotation contents remain non-semantic and are excluded from the core semantic ID index.
24. All authoritative numeric values in the schema-valid representation use the project-owned exact-decimal contract.
25. No authoritative semantic numeric value is routed through JavaScript `number`.
26. Valid reference attributes are preserved as unresolved strings.
27. Broken but non-empty reference targets do not fail schema validation merely because the target does not exist.
28. No reference target-kind validation is implemented.
29. No geometric or topological validation is implemented.
30. Scope-boundary tests explicitly protect the separation from reference and geometric validation.
31. No `ValidatedApartment2D` is constructed.
32. Structured `APSVG-*` errors introduced by TASK-006 are stable and covered by tests.
33. Positive, negative, conditional, boundary, exact-decimal, and regression tests pass.
34. Current-state documentation accurately identifies reference resolution as the next stage.
35. Required repository verification passes.
36. Architecture and package boundaries remain intact.
37. No unrelated changes are introduced.
38. No out-of-scope functionality is implemented.

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
6. the full-schema validation API established by the task;
7. the schema-valid intermediate representation and ID-index contract established by the task;
8. confirmation that reference target validation and geometry remain out of scope;
9. deviations from this task description, or `None`;
10. follow-up work identified during execution, or `None`;
11. a suggested Conventional Commits message that includes:

```text
Task: TASK-006
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```
