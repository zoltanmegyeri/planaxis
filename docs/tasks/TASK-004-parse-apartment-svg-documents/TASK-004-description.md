# TASK-004: Parse Apartment SVG Documents

## Context

PlanAxis has completed its initial repository bootstrap and authoritative decimal geometry foundation.

The next architectural stage is Apartment SVG parsing:

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
```

The existing `@planaxis/parser` package is still a bootstrap skeleton.

This task must establish the parsing boundary without collapsing parsing and validation into one step.

The parser's responsibility is to answer:

```text
What XML/SVG structure and lexical values are present in this source?
```

It is not responsible for answering:

```text
Is this a schema-conformant or geometrically conformant Apartment SVG 2.1 document?
```

The resulting parsed representation must therefore preserve enough source structure and raw lexical information for later schema validation to detect invalid root structure, duplicate groups, unknown elements, prohibited attributes, invalid numeric lexemes, conditional attributes, and similar conformance problems.

Authoritative decimal arithmetic is already available elsewhere in the repository, but this task must not convert unvalidated numeric lexemes into authoritative decimal values. That conversion belongs after lexical/schema validation has established that a value is a valid Apartment SVG number.

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

Implement a reusable, environment-independent Apartment SVG XML parser in `@planaxis/parser`.

The completed parser must:

- accept Apartment SVG source text as a string;
- parse XML syntax safely;
- expose malformed XML as a typed parse failure;
- convert successfully parsed XML into project-owned immutable-by-contract parsing structures;
- preserve semantically relevant XML/SVG structure and lexical attribute values for later validation;
- preserve duplicate and unknown structures rather than normalizing them away;
- preserve metadata content with enough node information for later validation of the required CDATA form;
- keep numeric-looking values as strings;
- avoid interpreting CSS, presentation, annotations, names, or visual appearance as semantic truth;
- avoid resolving or fetching external resources;
- expose its intended API only through the public `@planaxis/parser` package entry point;
- include focused automated parser tests.

The parser must provide a stable foundation for later schema validation without implementing that validation itself.

## Scope

The task includes:

- selecting and adding a suitable XML parsing dependency when required;
- implementing a public `parseApartmentSvg(source: string)` entry point;
- defining project-owned parsed-document and parse-result types;
- parsing XML syntax from an in-memory string;
- exposing the root element, qualified/local naming information, namespace information, and namespace declarations needed by later validation;
- preserving root attributes as lexical strings;
- preserving relevant root-level processing instructions, including `xml-stylesheet`, without retrieving referenced resources;
- preserving root-level child elements in source order;
- preserving all `<metadata>` occurrences rather than silently selecting only one;
- preserving metadata child-node information sufficiently to distinguish CDATA content from ordinary text;
- preserving top-level `<g>` elements as separate occurrences rather than indexing them by ID in a way that would hide duplicates;
- preserving each non-annotation semantic/unknown group element tree sufficiently for later validation of direct-child and nesting rules;
- preserving element names and attribute values without applying Apartment SVG schema rules;
- preserving unknown root elements, unknown groups, unknown semantic elements, and unknown attributes for later classification by schema validation;
- treating the contents of the top-level `annotations` group as non-semantic so annotation descendants do not enter the semantic-element pipeline;
- allowing annotation contents to be omitted from the semantic parsed representation or retained only as opaque/non-semantic data;
- adding package-level parser tests and the minimal package test/build configuration required by the repository;
- updating dependency manifests and the lockfile when dependencies change.

Keep the parser representation focused on information required by downstream validation. Do not build a second general-purpose DOM abstraction merely for completeness.

## Out of Scope

The task explicitly does **not** include:

- validating that the root element is a conforming Apartment SVG 2.1 root;
- validating `data-schema`;
- validating `data-schema-version`;
- validating `data-unit`;
- validating `viewBox`;
- validating required or prohibited root attributes;
- parsing or validating metadata JSON semantics;
- validating metadata fields, defaults, enums, geographic information, or extension keys;
- validating that exactly one metadata block exists;
- validating that required top-level groups exist exactly once;
- rejecting unknown non-extension top-level groups;
- validating permitted semantic element types;
- validating required, optional, conditional, prohibited, presentation, or extension attributes;
- validating `Id`, `Ref`, `Number`, `PositiveNumber`, `NonNegativeNumber`, `Angle360`, `PitchAngle`, `Latitude`, `Longitude`, `ElevationMeters`, or `TimeZoneId`;
- converting numeric lexical strings to `Decimal`;
- imposing an Apartment SVG digit-count ceiling;
- building a document-wide ID index;
- detecting duplicate IDs;
- resolving `data-wall`, `data-radiator-below`, or any other references;
- defining Apartment SVG validation error codes;
- wall, window, door, zone, fixed-element, utility, or camera geometric validation;
- overlap, collision, segment, polygon, or topology algorithms;
- constructing `ValidatedApartment2D`;
- constructing `ArchitecturalModel3D`;
- Three.js or renderer integration;
- file-system loading, HTTP upload handling, persistence, or application-level file-size policy.

Do not implement schema rules merely because the parser has access to the relevant data.

## Functional Requirements

### Public parser API

The parser package MUST export one primary function with this signature shape:

```ts
parseApartmentSvg(source: string)
```

The exact exported result type names are implementation choices, but the public contract MUST use a discriminated success/failure result so ordinary malformed XML does not require callers to catch an exception.

Conceptually:

```text
success -> parsed Apartment SVG document
failure -> structured XML parse failure
```

Malformed user input is an expected parsing outcome.

The parse failure MUST contain a useful diagnostic message and SHOULD preserve location information such as line/column when the selected XML parser provides it reliably.

The public API MUST expose project-owned types rather than leaking a third-party XML parser's node types as PlanAxis's public contract.

Unexpected internal programming failures may still surface as exceptions when appropriate, but malformed XML itself MUST be represented through the normal parse-result contract.

### XML syntax parsing

When the input is syntactically valid XML:

- parsing MUST succeed even if the document later proves invalid under Apartment SVG schema rules;
- the parser MUST NOT reject a document merely because an Apartment SVG attribute value is invalid;
- the parser MUST NOT reject a document merely because a required Apartment SVG element or attribute is missing;
- the parser MUST NOT silently repair malformed Apartment SVG semantics.

When the input is malformed XML:

- parsing MUST fail;
- the parser MUST NOT return a partial document as a successful result;
- the failure MUST remain distinguishable from future schema-validation failures.

Do not assign `APSVG-*` validation codes in this task.

### Parsed representation

The successful result MUST use project-owned immutable-by-contract structures suitable for deterministic downstream validation.

The representation MUST preserve enough information to support later validation of:

- root element name and namespace form;
- root attributes;
- namespace declarations;
- root-level processing instructions;
- root-level elements;
- duplicate metadata elements;
- duplicate top-level groups;
- unknown root-level elements;
- unknown groups;
- extension groups;
- element tag names;
- attributes and their lexical values;
- nested element structure where schema rules need to detect prohibited nesting;
- metadata text/CDATA structure.

Do not normalize structures in a way that makes later validation impossible.

In particular, do not convert a collection of top-level groups directly into a unique map keyed by `id` if doing so would lose duplicate occurrences.

Source order SHOULD be preserved for root-level children and group children because it is useful for diagnostics, even though Apartment SVG semantics do not depend on group order.

### XML names and namespaces

The parser MUST preserve enough XML naming information for later validation to distinguish:

- qualified name;
- local name where applicable;
- namespace URI where applicable;
- namespace declarations, especially the default namespace declaration on the root.

This is required because later schema validation must be able to distinguish the canonical:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
```

from namespace-equivalent but structurally different XML forms when the Apartment SVG specification requires the exact root form.

Do not assume that a third-party parser's resolved namespace URI alone preserves every namespace fact required by later validation.

### Attributes and lexical values

Attribute values MUST remain strings in the parsed representation.

The parser MUST preserve numeric-looking lexemes exactly as XML-decoded lexical strings without converting them through:

```text
Number
parseFloat
Decimal
```

or another numeric representation.

For example, all of the following are parseable XML attribute strings and MUST remain available for later schema validation:

```text
0.1
12.01
1e3
NaN
12cm
```

The parser must not decide which of those values conforms to Apartment SVG `Number`.

Presentation attributes such as `class`, `style`, `fill`, `stroke`, and `opacity` MUST NOT be interpreted as geometric or semantic information.

Unknown `data-*`, `data-x-*`, and other attributes MUST be preserved for later schema validation rather than discarded.

### Metadata

The parser MUST preserve every direct root-level `<metadata>` occurrence.

It MUST preserve the direct content of each metadata block with enough node-kind information to allow a later validator to determine whether the specification's required CDATA structure is satisfied.

At minimum, later code must be able to distinguish CDATA content from ordinary text content.

This task MUST NOT parse the metadata JSON into trusted metadata domain types.

It MAY expose the CDATA/text lexical payload as source text for later JSON parsing and schema validation.

Malformed metadata JSON MUST NOT cause XML parsing itself to fail when the surrounding XML is syntactically valid.

### Top-level groups and semantic elements

The parser MUST preserve top-level `<g>` occurrences individually.

It MUST NOT assume that required groups:

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

exist exactly once. That is a later schema-validation rule.

Unknown top-level groups, including both `x-*` and non-extension group IDs, MUST remain observable to later validation.

For non-annotation groups, direct child elements and any nested element structure relevant to later schema validation MUST remain observable.

The parser MUST NOT decide whether a child element belongs to the correct group or whether its `data-kind` is valid.

### Annotations

The Apartment SVG `annotations` group is not part of geometric truth.

The parser MUST ensure that descendants of a top-level group identified lexically as:

```text
id="annotations"
```

are not exposed through any semantic-element collection used by downstream Apartment SVG processing.

The parser MAY:

- omit annotation descendants from the semantic parsed representation; or
- retain them separately as explicitly opaque/non-semantic data.

The parser MUST NOT infer apartment semantics from annotation text, paths, shapes, transforms, styles, labels, or visual geometry.

The top-level `annotations` group occurrence itself MUST remain observable so later schema validation can check group presence and multiplicity.

### Root-level non-semantic elements

Root-level elements such as:

```text
style
defs
title
desc
```

must remain observable at least by element identity so later schema validation can determine whether root-level structure is permitted.

Their internal presentation content does not need to be converted into semantic Apartment SVG structures.

Unknown root-level elements MUST not be silently discarded.

### Processing instructions and external resources

The Apartment SVG specification permits an `xml-stylesheet` processing instruction.

The parser MUST accept syntactically valid processing instructions and MUST NOT fetch the stylesheet or any other processing-instruction target.

Parsing an Apartment SVG source string MUST NOT perform network access or file-system access.

External entity and external DTD resolution MUST be disabled.

The implementation MUST either:

- reject DTD/DOCTYPE constructs safely at the parser/security boundary; or
- use a parser mode in which DTD/entity declarations cannot trigger external access or unsafe expansion.

Under no circumstance may untrusted XML cause the parser to retrieve:

```text
file://...
http://...
https://...
```

or other external resources.

If DTD-bearing input is rejected for security reasons, report that as an XML/parser security boundary, not as an Apartment SVG schema rule.

### Numeric length and resource-policy boundary

Apartment SVG 2.1 does not define a maximum digit count for numeric lexical values.

Therefore this task MUST NOT introduce an Apartment SVG schema rule such as:

```text
numeric values may contain at most N digits
```

The parser MUST preserve numeric lexemes as strings rather than passing them into decimal arithmetic.

Practical application/file-size limits, request-body limits, and broader resource-consumption policy remain outside this task unless an existing repository rule already defines them.

If the selected XML dependency imposes a concrete built-in input, attribute, text, depth, or token limit that can reject otherwise syntactically valid inputs, the final response MUST report that limit and whether it is configurable.

Do not silently describe an implementation resource limit as an Apartment SVG conformance rule.

## Technical and Architectural Constraints

The implementation MUST comply with the repository architecture and development rules.

Task-specific constraints:

- implement parsing in `@planaxis/parser`;
- keep parsed-but-unvalidated structures distinct from trusted domain models;
- do not add parser output types to `@planaxis/model` merely to make them appear more domain-like;
- do not introduce `ValidatedApartment2D` or other trusted-domain types in this task;
- do not introduce a dependency on Three.js;
- no application package may become a dependency of the parser package;
- the parser implementation must be usable in both Node.js and browser environments where practical;
- do not use Node.js file-system APIs in the parser core;
- do not use browser DOM APIs as the only parsing implementation if that prevents reuse under Node.js;
- do not require callers to provide a browser `Document` or Node-specific stream;
- keep the main parser input as a string;
- do not use `number` or `Decimal` to store unvalidated numeric-looking attribute values;
- do not introduce schema validation into parsing helpers;
- do not introduce `any`, `@ts-ignore`, unsafe blanket assertions, or weakened TypeScript settings;
- keep third-party XML parser types behind project-owned parsing types;
- avoid a large general-purpose XML abstraction beyond what downstream Apartment SVG validation requires;
- avoid circular dependencies between `parser`, `geometry`, `model`, and future `validator` code.

No dependency on `@planaxis/geometry` is expected for this task because numeric values remain lexical strings.

If a concrete implementation need appears to require geometry or trusted-domain dependencies, first determine whether that work actually belongs in a later validation task rather than expanding this parser scope.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/parser/package.json
packages/parser/src/
packages/parser/test/
pnpm-lock.yaml
```

The exact test directory may follow existing repository package conventions.

A parser-specific build configuration MAY be introduced if required to keep tests typechecked while emitting only production source, consistent with existing workspace patterns.

Workspace dependency catalog configuration MAY change only when required to keep repeated dependency versions consistent.

Focused parser fixtures MAY be added under:

```text
fixtures/
```

when they materially improve parser tests, but large conformance fixture sets belong to later validation tasks.

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
A focused XML parser dependency is expected unless existing repository
capabilities can satisfy the requirements cleanly.
```

Any selected XML parser MUST:

- support the repository's Node.js runtime baseline;
- be usable from browser-targeted TypeScript code where practical;
- parse from strings without requiring filesystem access;
- permit safe handling of untrusted XML without external entity/resource retrieval;
- preserve the XML information required by this task, including CDATA and namespace details;
- be actively maintained and non-deprecated.

Use the existing repository testing technology. Do not introduce a second test framework.

If Vitest is declared in the parser workspace, use the repository's established catalog/version policy rather than creating version drift.

## Testing Requirements

Add focused automated tests for all parser behavior introduced by this task.

Tests MUST follow:

```text
docs/development/testing.md
```

At minimum, cover the following.

### Syntactically valid XML

Verify that the parser successfully parses a minimal XML document containing:

- an SVG root;
- root attributes;
- metadata CDATA;
- top-level groups;
- at least one semantic element.

The test does not need the document to satisfy every Apartment SVG schema rule unless that makes the fixture clearer.

### Malformed XML

Verify that malformed XML produces the typed parse-failure result rather than a successful partial document.

Use at least one structurally malformed case such as mismatched or unclosed tags.

### Lexical preservation

Verify that attribute values remain strings and preserve XML-decoded lexical content.

Include numeric-looking values such as:

```text
0.1
12.01
1e3
NaN
12cm
```

The parser MUST accept these as XML strings when the XML is otherwise syntactically valid.

The parser test MUST demonstrate that parser behavior does not perform Apartment SVG numeric lexical validation.

Include at least one long decimal lexeme that is preserved exactly without numeric conversion.

### Root and namespace information

Verify that the parsed representation preserves the root naming and namespace information required for later validation.

Include a case demonstrating that different namespace declaration forms remain distinguishable when necessary.

### Duplicate and unknown structure preservation

Verify that the parser does not hide:

- duplicate top-level group occurrences;
- multiple metadata occurrences;
- unknown top-level groups;
- unknown root-level elements;
- unknown attributes.

The parser need not classify these as valid or invalid.

### Metadata CDATA structure

Verify that metadata CDATA content is observable as CDATA rather than flattened indistinguishably into ordinary text.

Verify that malformed JSON inside valid XML metadata does not itself cause XML parsing to fail.

### Semantic nesting visibility

Include a syntactically valid XML case with nested elements inside a non-annotation semantic group and verify that the nested structure remains observable for later schema validation.

Do not reject it as an Apartment SVG schema error in this task.

### Annotation separation

Verify that annotation descendants are not included in the semantic-element pipeline.

Include annotation content that would otherwise resemble semantic geometry and confirm it is not treated as apartment geometry.

### Processing instructions

Verify that a syntactically valid `xml-stylesheet` processing instruction can be parsed without attempting to fetch the referenced stylesheet.

Tests MUST NOT require network access.

### External resource safety

Add a deterministic test demonstrating that external entity/DTD input cannot cause filesystem or network resource resolution.

The exact expected result may be safe parser rejection or safe non-resolution, according to the selected library and implementation, but no external resource may be read.

Do not create tests that depend on an external server.

### Existing repository behavior

All existing tests MUST continue to pass.

Do not weaken, skip, or delete existing tests merely to make this task pass.

## Documentation Requirements

No broad repository documentation change is expected because the architecture already describes the parsing boundary.

If implementation makes an existing non-task document factually inaccurate, update the owning document narrowly.

If the selected XML parser introduces an important stable implementation constraint that future contributors must know and that is not adequately expressed by code/package metadata, update the appropriate development or architecture document narrowly.

Do not modify task artifacts under:

```text
docs/tasks/
```

## Verification

Run the focused parser package tests:

```bash
pnpm --filter @planaxis/parser test
```

Then run the standard repository verification:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If dependency manifests or `pnpm-lock.yaml` change, also run:

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

1. `@planaxis/parser` exports a public `parseApartmentSvg(source: string)` API;
2. ordinary malformed XML is represented through a typed discriminated parse-failure result;
3. syntactically valid XML produces a project-owned parsed-document representation;
4. third-party XML parser node types are not exposed as the public PlanAxis parser contract;
5. root naming, namespace information, namespace declarations, attributes, processing instructions, and relevant root children remain observable for later validation;
6. duplicate metadata and top-level group occurrences are preserved rather than normalized away;
7. unknown root elements, groups, semantic elements, and attributes remain observable;
8. metadata CDATA is distinguishable from ordinary text in the parsed representation;
9. malformed metadata JSON does not cause XML parsing itself to fail;
10. non-annotation nested element structure remains observable for later schema validation;
11. annotation descendants do not enter the semantic-element pipeline;
12. root-level non-semantic element identities remain observable;
13. numeric-looking attribute values remain lexical strings;
14. parser behavior does not validate Apartment SVG numeric grammar;
15. no parsed numeric lexeme is converted through JavaScript `number`, `parseFloat`, or `Decimal`;
16. no Apartment SVG digit-count ceiling is introduced;
17. parsing performs no filesystem or network access;
18. processing instructions such as `xml-stylesheet` do not trigger external retrieval;
19. external entity and external DTD resolution are disabled or DTD-bearing input is safely rejected;
20. the parser remains independent of Three.js and application packages;
21. no trusted `ValidatedApartment2D` or schema-validation behavior is introduced;
22. no unnecessary dependency on `@planaxis/geometry` is introduced;
23. focused tests cover malformed XML, lexical preservation, namespaces, duplicate/unknown structure, metadata CDATA, nesting visibility, annotations, processing instructions, and external-resource safety;
24. selected direct dependency versions were determined from current registry metadata;
25. no selected direct dependency is prerelease or deprecated unless explicitly required;
26. the newest mutually compatible stable dependency release was selected, or an evidence-backed exception is reported;
27. repeated dependency versions do not drift across workspaces;
28. package manifests and `pnpm-lock.yaml` represent the same reviewed dependency set;
29. any concrete built-in XML parser resource limit that can reject syntactically valid input is reported in the final response;
30. `pnpm --filter @planaxis/parser test` passes;
31. `pnpm lint` passes;
32. `pnpm typecheck` passes;
33. `pnpm test` passes;
34. `pnpm build` passes;
35. `pnpm install --frozen-lockfile` succeeds when dependency state changes;
36. architecture and package boundaries remain intact;
37. no unrelated changes are introduced;
38. no out-of-scope functionality is implemented.

## Final Response

When finished, provide a concise execution report containing:

1. a summary of the parser implementation;
2. the public API and project-owned parsed representation established in `@planaxis/parser`;
3. the malformed-XML result behavior;
4. the main files or areas changed;
5. tests added or updated;
6. verification commands actually run and their results;
7. dependency versions added or updated, including the selected XML parser and any intentionally unselected newer stable release with its evidence-backed compatibility reason;
8. any concrete XML parser input, depth, token, text, or related resource limits discovered during implementation, or `None identified`;
9. confirmation of how external entity/resource retrieval is prevented;
10. deviations from this task description, or `None`;
11. follow-up work identified during execution, or `None`;
12. a suggested Conventional Commits message that includes:

```text
Task: TASK-004
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```
