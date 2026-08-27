# PlanAxis Architecture Overview

## 1. Purpose

This document describes the current high-level software architecture of **PlanAxis**.

It defines the major architectural layers, their responsibilities, the direction of data flow, and the boundaries that must remain stable as the project evolves.

This document describes **how the system is currently intended to be structured**. It does not record the historical reasoning behind every decision. Significant architectural decisions and their rationale belong in Architectural Decision Records under `docs/decisions/`.

The normative definition of the external apartment file format is the Apartment SVG specification:

```text
docs/specifications/apartment-svg/2.1.md
```

That specification takes precedence for all Apartment SVG semantics.

---

## 2. Architectural Goals

PlanAxis is designed around the following goals:

- deterministic interpretation of Apartment SVG documents;
- strict validation before downstream processing;
- exact arithmetic for authoritative apartment geometry;
- clear separation between external file format, domain models, 3D architecture, and rendering;
- reuse of core TypeScript logic across server-side and browser environments where practical;
- renderer-independent architectural modeling;
- testable components with narrow responsibilities;
- incremental evolution toward interactive visualization and AI-assisted redesign without weakening the deterministic geometry pipeline.

The architecture favors explicit data transformations over implicit behavior.

---

## 3. High-Level System Flow

The core processing pipeline is:

```text
Apartment SVG
    │
    ▼
XML / SVG parsing
    │
    ▼
schema validation
    │
    ▼
reference resolution and referential validation
    │
    ▼
geometric / topological validation
    │
    ▼
ValidatedApartment2D
    │
    ▼
ArchitecturalModel3D
    │
    ├──────────────► server-side consumers
    │
    ▼
renderer adapter
    │
    ▼
Three.js scene
    │
    ▼
interactive browser visualization
```

Later design and AI-assisted workflows are built on top of this validated and deterministic foundation:

```text
Validated apartment geometry
    ↓
design brief / redesign operations
    ↓
updated apartment model
    ↓
3D architectural model
    ↓
technical render
    ↓
photorealistic render / AI-assisted finishing
    ↓
geometric verification
```

AI-generated output is never a replacement for canonical geometric data.

---

## 4. Sources of Truth

### 4.1. Apartment SVG

The Apartment SVG document is the **canonical external and persistent representation** of apartment geometry and semantics.

It is the source of truth for facts defined by the Apartment SVG specification.

The parser and validator must not infer missing required facts from:

- CSS;
- colors;
- strokes;
- visual appearance;
- annotations;
- labels;
- human-readable names;
- unsupported SVG constructs;
- natural-language assumptions.

If required information is missing or invalid, the correct outcome is a validation error.

### 4.2. `ValidatedApartment2D`

`ValidatedApartment2D` is the typed, normalized, in-memory representation produced after successful validation.

It is **not** a second persistence format and is **not** a competing source of truth.

Its purpose is to provide application code with a safe domain model that no longer exposes raw XML or SVG parsing concerns.

It may contain derived values that are useful at runtime, for example:

- resolved references;
- effective wall height;
- wall length and thickness;
- wall centerlines;
- door leaf length;
- derived closed-door endpoints;
- other deterministic values defined by the specification.

Such values are derived from the canonical SVG and must not create redundant persistent geometry.

### 4.3. `ArchitecturalModel3D`

`ArchitecturalModel3D` is a renderer-independent 3D representation derived from `ValidatedApartment2D`.

It represents architectural geometry and spatial relationships, not rendering-engine objects.

It may contain concepts such as:

- wall volumes;
- wall openings;
- floors and ceilings;
- windows;
- doors;
- fixed architectural elements;
- utility positions;
- camera definitions.

It must not contain Three.js-specific types.

---

## 5. Processing Stages

### 5.1. XML / SVG Parsing

The parsing layer converts the input document into a structured representation suitable for validation.

Responsibilities include:

- parsing XML syntax;
- exposing root attributes;
- reading metadata;
- reading semantic SVG groups and elements;
- preserving lexical numeric values without first converting them through JavaScript `Number`.

The parser does not decide whether the document is geometrically valid.

It also does not construct 3D geometry.

### 5.2. Schema Validation

Schema validation verifies structural conformance to the Apartment SVG specification.

Typical responsibilities include:

- required root attributes;
- permitted top-level elements and groups;
- required groups;
- required and prohibited attributes;
- lexical data types;
- enum values;
- conditional attributes;
- document-wide unique identifiers.

The implementation should preserve the specification's distinction between XML conformance, schema conformance, and full geometric conformance.

### 5.3. Reference Resolution and Referential Validation

References such as `data-wall` and `data-radiator-below` are resolved only after identifiers and element types have been validated sufficiently to make resolution safe.

Responsibilities include:

- resolving IDs;
- detecting broken references;
- validating referenced element types;
- producing domain-level reference relationships suitable for later validation.

Downstream layers should not repeatedly parse raw string references from SVG attributes.

### 5.4. Geometric and Topological Validation

This stage validates spatial invariants defined by the Apartment SVG specification.

Examples include:

- wall-axis consistency;
- window-to-wall relationships;
- door-to-wall relationships;
- hinged-door hinge position;
- hinged-door open-leaf geometry;
- zone polygon validity;
- overlap restrictions;
- utility placement;
- camera collisions.

The normative geometric tolerance is defined by the Apartment SVG specification.

Validation must report errors rather than silently repair invalid input.

### 5.5. Construction of `ValidatedApartment2D`

Only a document that has passed the required validation stages may produce a `ValidatedApartment2D`.

This boundary is important:

```text
untrusted external representation
              │
              ▼
        parsing + validation
              │
              ▼
trusted domain representation
```

Code receiving `ValidatedApartment2D` may rely on the invariants guaranteed by the validation pipeline.

### 5.6. Construction of `ArchitecturalModel3D`

The 3D model builder transforms validated 2D architectural data and explicit Z-related metadata into renderer-independent 3D geometry.

The builder may derive 3D structures such as wall volumes and openings, but it must not reinterpret invalid or missing source data.

The builder must not repeat domain validation as a substitute for the validation layer.

Defensive assertions may exist for internal programming errors, but source-document validation belongs upstream.

### 5.7. Renderer Adapter

A renderer adapter converts `ArchitecturalModel3D` and runtime simulation state into renderer-specific objects.

The first renderer is expected to use Three.js.

Responsibilities may include:

- `ArchitecturalModel3D` → `THREE.Scene`;
- mesh creation;
- materials;
- runtime light objects;
- camera objects;
- renderer-oriented optimization;
- conversion from exact domain numeric values to native JavaScript numbers where required.

Three.js-specific behavior belongs here or in higher-level application code, not in the domain or validation packages.

---

## 6. Numeric Architecture

### 6.1. Authoritative Geometry

Apartment geometry is authoritative data and must use exact decimal arithmetic.

The project uses a decimal abstraction based on `decimal.js` for authoritative geometric values and calculations.

SVG numeric values must be parsed directly from their lexical string representation.

Conceptually correct:

```ts
const value = new Decimal(attributeValue);
```

Conceptually incorrect:

```ts
const value = new Decimal(Number(attributeValue));
```

The second form introduces binary floating-point representation before the exact decimal value is created.

### 6.2. Geometric Tolerance

Geometric comparison follows the tolerance defined by the Apartment SVG specification.

Tolerance-aware operations should be centralized in the geometry layer rather than reimplemented ad hoc across validators.

### 6.3. Renderer Boundary

Three.js and GPU-oriented APIs use JavaScript numeric types.

Therefore the architecture allows a controlled conversion:

```text
authoritative Decimal geometry
        ↓
renderer boundary
        ↓
JavaScript number / GPU representation
```

Values converted for rendering must not flow back into the authoritative model as new geometric truth.

---

## 7. Runtime Simulation State

Not every value used during visualization belongs in the apartment document.

The architecture distinguishes between:

```text
persistent apartment facts
```

and:

```text
runtime simulation state
```

Examples of persistent facts include:

- geometry;
- camera definitions stored by the Apartment SVG;
- geographic latitude and longitude;
- true-north orientation;
- optional elevation;
- optional civil time zone.

Examples of runtime state include:

- selected date and time;
- current lamp on/off state;
- dimmer values;
- interactive camera/navigation state;
- renderer settings.

Runtime state must not be written into the canonical Apartment SVG unless the specification explicitly defines it as persistent apartment data.

### 7.1. Solar Simulation

When sufficient geographic metadata and an unambiguous runtime instant are available, the renderer or a dedicated simulation service may derive solar position.

The Apartment SVG specification defines the coordinate-system transformation from geographic solar azimuth/elevation into the PlanAxis 3D coordinate system.

The architectural model should expose the required persistent metadata without embedding a specific astronomical or atmospheric rendering library into the domain layer.

---

## 8. Frontend and Backend Responsibilities

PlanAxis is intended to be a web application with both browser and server components.

The exact split may evolve, but responsibilities should remain explicit.

### 8.1. Browser Application

The browser application is expected to handle interactive tasks such as:

- loading or selecting apartment projects;
- displaying validation results;
- rendering the 3D scene;
- free navigation through the apartment;
- selecting predefined cameras;
- changing runtime date and time;
- controlling artificial lights;
- adjusting dimmers;
- later design exploration workflows.

Core TypeScript packages should be reusable in the browser when practical.

This makes client-side parsing, validation, or model generation possible without requiring separate implementations.

### 8.2. Server Application

The server is expected to handle capabilities such as:

- serving the web application;
- HTTP APIs;
- project persistence;
- file storage;
- versioning;
- later authentication and collaboration features;
- AI service integration;
- server-side or headless processing where required.

The server should consume the same domain contracts as the browser rather than defining an incompatible parallel apartment model.

### 8.3. Shared Core

The architecture intentionally favors shared packages for deterministic logic.

Conceptually:

```text
                 shared TypeScript core
              ┌──────────┴──────────┐
              │                     │
        Node.js server        browser application
```

Shared code is appropriate for:

- domain types;
- exact numeric primitives;
- geometry utilities;
- parsing;
- validation;
- renderer-independent model construction.

Environment-specific concerns must remain outside shared core packages.

---

## 9. Package Boundaries

The initial target monorepo contains packages similar to:

```text
packages/
    model/
    geometry/
    parser/
    validator/
    model-3d/
```

These names are not immutable, but the responsibilities they represent should remain distinct.

### `model`

Expected responsibilities:

- shared domain types;
- Apartment SVG semantic model types;
- `ValidatedApartment2D`;
- identifiers and enums;
- metadata types;
- validation-result contracts where appropriate.

It must not depend on rendering code.

### `geometry`

Expected responsibilities:

- exact 2D/3D geometric primitives;
- decimal-aware geometric operations;
- tolerance-aware comparisons;
- reusable spatial calculations.

It must remain domain-oriented and renderer-independent.

### `parser`

Expected responsibilities:

- XML / SVG parsing;
- extraction of raw semantic values;
- conversion from lexical data into typed parsing structures.

It must not depend on Three.js.

### `validator`

Expected responsibilities:

- schema validation;
- reference validation;
- geometric and topological validation;
- validation errors and error codes;
- production of the validated 2D domain model.

It must not produce renderer-specific objects.

### `model-3d`

Expected responsibilities:

- renderer-independent 3D architectural types;
- deterministic `ValidatedApartment2D` → `ArchitecturalModel3D` transformation.

It must not depend on Three.js.

Renderer-specific code should live in the web application or in a dedicated renderer package if a concrete need for such a package emerges.

Avoid creating packages preemptively without implementation pressure.

---

## 10. Dependency Direction

Dependencies should flow toward stable domain concepts.

A conceptual dependency direction is:

```text
                model
               ▲    ▲
              /      \
      geometry        parser
          ▲              │
           \             ▼
            └──── validator
                     │
                     ▼
                 model-3d
                     │
                     ▼
             renderer adapter
                     │
              ┌──────┴──────┐
              ▼             ▼
           web app       server app
```

This diagram is conceptual rather than a required literal package graph.

Important constraints are:

- domain packages do not depend on applications;
- core packages do not depend on Three.js;
- HTTP concerns do not leak into domain models;
- parsing concerns do not leak into rendering;
- renderer-specific numeric compromises do not leak into authoritative geometry.

Circular dependencies between core packages should be avoided.

---

## 11. Validation Errors

Validation is expected to use structured errors rather than plain unstructured strings.

The Apartment SVG specification recommends codes in the form:

```text
APSVG-<CATEGORY>-<NUMBER>
```

A validation error should expose enough structured information to support:

- automated tests;
- browser UI presentation;
- developer diagnostics;
- future API responses.

At minimum, the implementation should preserve the information required by the specification, including:

- error code;
- affected element ID where applicable;
- attribute or geometric rule;
- actual value;
- expected condition.

Exact TypeScript error contracts belong in the domain/coding documentation once finalized.

---

## 12. Testing Architecture

Testing follows the same separation of concerns as production code.

Examples:

```text
parser tests
    XML / SVG input
        ↓
    parsed representation

validator tests
    parsed / domain input
        ↓
    validation result

3D model tests
    ValidatedApartment2D
        ↓
    ArchitecturalModel3D

renderer tests
    ArchitecturalModel3D
        ↓
    renderer-facing structures / behavior
```

Parser and validator behavior should be exercised with focused Apartment SVG fixtures.

The repository distinguishes:

```text
fixtures/
```

for automated verification, including intentionally invalid cases, from:

```text
examples/
```

for valid user-facing demonstrations.

Detailed testing rules belong in `docs/development/testing.md`.

---

## 13. Application State and Persistence

The Apartment SVG remains the canonical external apartment representation.

Application persistence may later include additional project-level information such as:

- project metadata;
- saved runtime/view preferences;
- design alternatives;
- generated assets;
- render outputs;
- collaboration metadata.

Such persistence must not silently redefine Apartment SVG semantics.

If PlanAxis introduces a broader project format in the future, it must clearly distinguish:

```text
Apartment SVG document
```

from:

```text
PlanAxis project/application state
```

The Apartment SVG specification remains independently versioned.

---

## 14. AI-Assisted Features

AI-assisted redesign is a downstream capability.

AI systems may help with:

- layout ideas;
- furniture concepts;
- design briefs;
- material/style exploration;
- photorealistic finishing;
- alternative proposals.

However:

- AI output must not override canonical geometry implicitly;
- geometric changes must be represented explicitly in the apartment model;
- image generation is not a source of architectural truth;
- generated visual output should be checked against the deterministic model when geometric fidelity matters.

The reliable pipeline remains model-first rather than image-first.

---

## 15. Architectural Evolution

The project is intentionally being implemented incrementally.

Do not introduce infrastructure merely because it may be useful later.

In particular, avoid premature introduction of:

- dependency-injection containers;
- event buses;
- plugin frameworks;
- multiple geometry engines;
- alternative decimal implementations;
- additional HTTP frameworks;
- renderer abstractions without a second concrete renderer or another demonstrated need.

When a significant new requirement changes an established architectural direction:

1. update the architecture documentation to describe the resulting system;
2. add or update an ADR to capture the decision and rationale;
3. update tests and implementation consistently.

Architecture documentation describes the **current state**.

ADRs describe **why significant decisions were made**.

---

## 16. Current Implementation Phase

PlanAxis is currently in the repository bootstrap and architecture-definition phase.

The intended implementation order is broadly:

```text
repository bootstrap
    ↓
numeric and geometric foundations
    ↓
Apartment SVG parsing
    ↓
schema validation
    ↓
reference resolution
    ↓
geometric / topological validation
    ↓
ValidatedApartment2D
    ↓
ArchitecturalModel3D
    ↓
Three.js visualization
    ↓
interactive simulation
    ↓
backend persistence / integrations
    ↓
AI-assisted design workflows
```

This sequence may be refined as implementation progresses, but downstream features must not bypass the deterministic validation and geometry foundation.
