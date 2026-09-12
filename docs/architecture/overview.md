# PlanAxis Architecture Overview

## 1. Purpose

This document describes the current high-level software architecture of **PlanAxis**.

It defines the major architectural layers, their responsibilities, the direction of data flow, and the boundaries that must remain stable as the project evolves.

This document describes **how the system is currently intended to be structured**. It does not record the historical reasoning behind every decision. Significant architectural decisions and their rationale belong in Architectural Decision Records under `docs/decisions/`.

The normative definitions of PlanAxis external formats are:

```text
docs/specifications/apartment-svg/2.2.md
docs/specifications/planaxis-project/1.0.md
```

The Apartment SVG specification takes precedence for apartment geometry and semantic interpretation. The PlanAxis Project Format specification takes precedence for filesystem-backed project-container, manifest, path, and project-root semantics.

---

## 2. Architectural Goals

PlanAxis is designed around the following goals:

- deterministic interpretation of Apartment SVG documents;
- strict validation before downstream processing;
- exact arithmetic for authoritative apartment geometry;
- a portable filesystem-backed project container for renovation work;
- clear separation between project organization, external apartment format, domain models, 3D architecture, and rendering;
- server-owned project filesystem access confined to an explicitly authorized project root;
- reuse of core TypeScript logic across server-side and browser environments where practical;
- renderer-independent architectural modeling;
- testable components with narrow responsibilities;
- incremental evolution toward interactive visualization and AI-assisted redesign without weakening the deterministic geometry pipeline.

The architecture favors explicit data transformations and explicit trust boundaries over implicit behavior.

---

## 3. High-Level System Flow

The accepted top-level application flow is:

```text
PlanAxis project root
    │
    ▼
project manifest + project-filesystem boundary
    │
    ▼
active Apartment SVG
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

The filesystem-backed project layer is adopted by ADR-004 and PlanAxis Project Format 1.0. Its server-side loading, read-only filesystem boundary, startup project selection, and controlled HTTP APIs are implemented, but the current user-facing implementation still loads one local Apartment SVG directly in the browser. Section 16 distinguishes implemented behavior from accepted-but-not-yet-implemented architecture.

Later design and AI-assisted workflows are built on top of this validated and deterministic foundation:

```text
validated apartment geometry
    +
project assets / references / design state
    ↓
design brief / redesign operations
    ↓
updated apartment model and design scenario
    ↓
3D architectural model + presentation state
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

### 4.1. PlanAxis project manifest

A PlanAxis project is a physical directory conforming to PlanAxis Project Format 1.0.

The required root manifest is:

```text
planaxis.project.json
```

The manifest is the source of truth for project organization defined by the Project Format, including the human-readable project name and the currently active Apartment SVG.

It is **not** a source of apartment geometry and must not duplicate or override architectural facts owned by Apartment SVG.

Project Format 1.0 uses durable project-relative paths and reserves top-level areas for:

```text
architecture/
assets/
references/
designs/
outputs/
.planaxis/
```

The project format is independently versioned from Apartment SVG and from future material, model-asset, and design descriptor formats.

### 4.2. Apartment SVG

The Apartment SVG document is the **canonical external and persistent representation** of apartment geometry and semantics.

It is the source of truth for facts defined by the Apartment SVG specification.

In Apartment SVG 2.2, the mandatory apartment footprint is canonical geometry. It defines the horizontal physical extent of the modeled level and must not be reconstructed from walls, zones, presentation, project metadata, or visual appearance.

The parser and validator must not infer missing required facts from:

- CSS;
- colors;
- strokes;
- visual appearance;
- annotations;
- labels;
- human-readable names;
- project-manifest fields;
- unsupported SVG constructs;
- natural-language assumptions.

If required information is missing or invalid, the correct outcome is a validation error.

A project may contain multiple architectural alternatives as independent Apartment SVG documents. The project manifest selects the active one; it does not merge or reinterpret them.

### 4.3. `ValidatedApartment2D`

`ValidatedApartment2D` is the typed, normalized, in-memory representation produced after successful Apartment SVG validation.

It is **not** a second persistence format and is **not** a competing source of truth.

Its purpose is to provide application code with a safe domain model that no longer exposes raw XML or SVG parsing concerns.

The 2.2 model retains the validated canonical `ApartmentFootprint` (ID, kind, and exact-decimal boundary), level-local architectural Z values, and metadata. The footprint is exposed directly and through the semantic ID index as the same domain instance; root `bounds` remain the separate viewBox extent.

It may contain derived values that are useful at runtime, for example:

- resolved references;
- effective wall height;
- wall length and thickness;
- wall centerlines;
- door leaf length;
- derived closed-door endpoints;
- other deterministic values defined by the specification.

Such values are derived from the canonical SVG and must not create redundant persistent geometry.

### 4.4. `ArchitecturalModel3D`

`ArchitecturalModel3D` is a renderer-independent 3D representation derived from `ValidatedApartment2D`.

It represents architectural geometry and spatial relationships, not rendering-engine objects.

It exposes:

- wall volumes;
- wall openings;
- floors and ceilings;
- windows;
- doors;
- fixed architectural elements;
- utility positions;
- camera definitions.

For Apartment SVG 2.2, the apartment footprint and level metadata provide deterministic source data for the implicit floor and default ceiling surfaces. Their XY geometry is the footprint; their model-space Z positions are `level.baseZ` and `level.baseZ + level.defaultCeilingHeight` respectively. This does not imply slab thickness, construction material, or other physical properties not present in the specification.

It must not contain Three.js-specific types.

### 4.5. Project-format conformance and Apartment SVG conformance

These are separate validation domains.

A project can be Project Format conformant while its active Apartment SVG is invalid. Such a project remains openable so the ordinary Apartment SVG diagnostic workflow can report the SVG failure.

Conversely, an individually valid Apartment SVG does not make an arbitrary directory a conforming PlanAxis project.

Project loading therefore establishes only the project-container guarantees required to locate the active candidate Apartment SVG. Apartment SVG parsing and validation remain downstream and independent.

---

## 5. Processing Stages

### 5.1. Project Root Establishment and Project-Format Validation

For filesystem-backed project operation, the server receives one explicit project-root path at process startup.

The backend establishes one canonical physical project root and treats that root as the filesystem authorization boundary for the server process.

Project-format processing is responsible for:

- locating `planaxis.project.json`;
- parsing untrusted manifest JSON;
- validating the supported Project Format schema identifier;
- validating the closed manifest structure;
- validating `architecture.active` using Project Format path semantics;
- verifying that the active path identifies an accessible regular `.svg` file under `architecture/`;
- enforcing root containment;
- enforcing the Project Format symbolic-link policy.

Successful project-format validation does **not** establish Apartment SVG validity.

Project filesystem access should be centralized behind a project-filesystem boundary rather than reproduced independently by routes, asset processors, AI integrations, or other services.

The project-root path itself is environment-specific server configuration and does not become persistent project data.

### 5.2. XML / SVG Parsing

The parsing layer converts the input Apartment SVG document into a structured representation suitable for validation.

Responsibilities include:

- parsing XML syntax;
- exposing root attributes;
- reading metadata;
- reading semantic SVG groups and elements;
- preserving lexical numeric values without first converting them through JavaScript `Number`.

The parser does not decide whether the document is geometrically valid.

It also does not construct 3D geometry.

### 5.3. Schema Validation

Schema validation verifies structural conformance to the Apartment SVG specification.

The schema-validation phase consumes the parser-owned `ParsedApartmentSvgDocument` representation and validates:

- Apartment SVG scalar lexical and value types needed at document level;
- the canonical root element, namespace, schema attributes, and `viewBox`;
- metadata multiplicity, CDATA/JSON form, required metadata structure, exact numeric values, optional location data, and extension keys;
- required top-level groups, including the mandatory `footprint` group, permitted root-level elements, extension groups, and core-group transform restrictions;
- the footprint group's required single `data-kind="footprint"` polygon and its permitted attributes;
- common semantic-element structure, attributes, IDs, presentation/extension boundaries, and prohibited transforms or redundant geometry;
- the complete schema tables, enum values, scalar values, and conditional attributes for spaces, walls, windows, doors, fixed elements, utilities, and cameras.

The public full-schema entry point returns structured `APSVG-*` validation errors for ordinary schema failures. On success it produces a validator-owned `SchemaValidApartmentSvgDocument` containing exact-decimal document and semantic values, raw unresolved reference IDs, and a unique core semantic ID index. This intermediate representation establishes schema conformance only: it is deliberately distinct from `ValidatedApartment2D` and does not imply reference, geometric, topological, footprint, or containment conformance. The earlier document-level validation entry point may remain available for callers that need only the root, metadata, and group-structure slice.

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

### 5.4. Reference Resolution and Referential Validation

References such as `data-wall` and `data-radiator-below` are resolved only after identifiers and element types have been validated sufficiently to make resolution safe.

The reference-validation phase consumes `SchemaValidApartmentSvgDocument` directly, without reparsing XML or repeating schema validation. It validates target existence and required semantic kind for every core reference. Ordinary failures are returned as structured `APSVG-REF-*` errors.

On success it produces a validator-owned `ReferenceValidApartmentSvgDocument`. Windows, doors, radiators, and wall-associated utilities expose typed resolved relationships, and the document's semantic ID index points to the reference-valid element representations. Exact-decimal schema values are preserved unchanged. The mandatory footprint is carried through as the same `SchemaValidFootprint` object (aliased as `ReferenceValidFootprint`) and indexed by its ID; it introduces no references and is not a valid wall or radiator target.

This intermediate type establishes referential conformance only. It remains deliberately distinct from `ValidatedApartment2D` and does not imply geometric, topological, footprint, or containment conformance.

Responsibilities include:

- resolving IDs;
- detecting broken references;
- validating referenced element types;
- producing domain-level reference relationships suitable for later validation.

Downstream layers do not need to resolve the same raw reference IDs again.

### 5.5. Geometric and Topological Validation

The complete Apartment SVG 2.2 geometric-validation stage enforces footprint geometry, stationary placement containment, and level-local Z collision semantics alongside the existing spatial checks.

The full geometric-validation stage consumes `ReferenceValidApartmentSvgDocument` and validates every remaining spatial invariant required by the Apartment SVG specification. Checks may be composed in narrower stages when later checks depend on earlier geometric guarantees.

The complete stage is responsible for validating:

- the apartment footprint polygon's topology, positive area, and exact orthogonal-edge requirement;
- containment of the footprint within the root `viewBox`;
- wall-axis consistency;
- window-to-wall relationships;
- door-to-wall relationships;
- hinged-door hinge position;
- hinged-door open-leaf geometry and its explicit exemption from footprint containment while remaining subject to `viewBox` containment;
- zone polygon validity;
- stationary semantic geometry containment within the closed apartment footprint;
- wall-associated utility placement;
- utility and camera point containment within the footprint, ignoring presentation-only marker radius;
- camera collisions with wall and fixed-element volumes using level-relative Z semantics;
- opening, zone, and wall overlap restrictions.

For concave footprints, containment applies to the complete rectangle or polygon geometry, not merely to selected vertices.

The normative geometric tolerance is defined by the Apartment SVG specification. Footprint edge orthogonality is an exact coordinate rule and must not be relaxed using `EPSILON`.

Validation must report errors rather than silently repair invalid input.

Successful validation produces a nominal `GeometryValidApartmentSvgDocument`. This type preserves the reference-valid document and its exact-decimal geometry unchanged while establishing the final trusted SVG boundary before domain-model construction. An ordinary `ReferenceValidApartmentSvgDocument` is not assignable to this boundary.

### 5.6. Construction of `ValidatedApartment2D`

Only a `GeometryValidApartmentSvgDocument` that has passed every required validation stage may produce a `ValidatedApartment2D`.

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

The `buildValidatedApartment2D` entry point is owned by `@planaxis/validator`, while the model contracts are owned by `@planaxis/model`. Construction creates a normalized, read-only domain object graph with domain-oriented bounds, element footprints, positions, and space boundaries. The canonical apartment footprint is exposed separately from root bounds. Relationships to walls and radiators point to the corresponding constructed domain instances, and a semantic-element ID index contains those same instances.

The model retains exact-decimal canonical metadata and semantic geometry while adding deterministic derived values required by downstream code, including wall length, thickness, centerline, and effective height; window and door opening widths; and hinged-door leaf length and closed free endpoint. All element-level architectural Z values remain level-local; `metadata.level.baseZ` is retained separately for the 3D builder. SVG marker radii and raw unresolved reference IDs are not part of this domain representation.

### 5.7. Construction of `ArchitecturalModel3D`

The 3D model builder transforms validated 2D architectural data and explicit level-local Z metadata into renderer-independent 3D geometry.

Model-space Z is derived deterministically as:

```text
modelZ = metadata.level.baseZ + localZ
```

`@planaxis/model-3d` owns the public `ArchitecturalModel3D` contracts and `buildArchitecturalModel3D(apartment: ValidatedApartment2D)` builder. It depends on `@planaxis/model` for trusted input and shared semantics and on `@planaxis/geometry` for exact geometry primitives.

The builder constructs a normalized read-only object graph with `metadata`, `floor`, `ceiling`, `walls`, `windows`, `doors`, `fixedElements`, `utilities`, `cameras`, and `sourceElementsById`. It preserves source X/Y unchanged. Floor and default ceiling are `HorizontalPolygonSurface3D` boundaries derived from the canonical footprint, independent of explicit wall heights. Walls and fixed elements expose `RectangularPrism3D` volumes; windows and doors expose separate opening prisms describing void extents within the wall envelope. No boolean subtraction or mesh splitting occurs.

Windows, doors, radiators, and wall-associated utilities reference constructed 3D walls; optional window-to-radiator relationships likewise reference constructed radiators. The read-only source-semantic ID index contains the same instances as the typed collections. Derived floor and ceiling surfaces have no invented source IDs; footprint and space elements are not added to the index or extruded into room volumes.

Source metadata and immutable plan geometry are shared with the trusted input. Window opening/frame/glass details, door types and status, fixed-element descriptions, and utility semantics remain available. Hinged-door hinge, open-leaf, leaf length, and closed endpoint remain exact plan-view reference geometry. Camera positions are `Point3D`, while heading, pitch, and horizontal FOV remain exact degree values without trigonometric conversion. Heights remain dimensions, and window sill height remains a level-local source measurement; prism ranges and point Z coordinates are model-space values.

The builder must not invent slab thickness, material, or other geometry not defined by the Apartment SVG specification.

The builder must not reinterpret invalid or missing source data and must not repeat domain validation as a substitute for the validation layer.

Defensive assertions may exist for internal programming errors, but source-document validation belongs upstream.

### 5.8. Renderer Adapter

A renderer adapter converts `ArchitecturalModel3D` and runtime simulation state into renderer-specific objects.

`@planaxis/renderer-three` implements direct Three.js adaptation with WebGPU-first rendering and supported WebGL2 fallback. Exact centimeters become meters at this boundary, with `(X, Y, Z)` mapped to `(X, Z, Y)`. Geometry, materials, controls, and GPU resources are renderer-owned. See [ADR-003](../decisions/ADR-003-three-renderer-architecture.md).

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

Not every value used during visualization belongs in the apartment document or project manifest.

The architecture distinguishes between:

```text
persistent apartment facts
persistent project/design facts
runtime simulation state
```

Examples of persistent apartment facts include:

- apartment footprint and other canonical geometry;
- level base Z and default ceiling height;
- level-relative architectural Z values;
- camera definitions stored by the Apartment SVG;
- geographic latitude and longitude;
- true-north orientation;
- optional elevation;
- optional civil time zone.

Examples of future persistent project/design facts may include material assignments, imported assets, design scenarios, and saved generated outputs, but those contracts must be defined by their own accepted formats rather than guessed into the current project manifest.

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

PlanAxis is a web application with browser and server components.

The exact implementation is evolving, but responsibilities must remain explicit.

### 8.1. Browser Application

The React application in `apps/web`, built with Vite, is the first official user-facing PlanAxis entry point. [ADR-002](../decisions/ADR-002-react-browser-ui.md) records the UI framework decision.

The **currently implemented workflow** starts with `pnpm dev:web` and loads one local SVG through a file picker or drag-and-drop. It calls `parseApartmentSvg`, `validateApartmentSvgSchema`, `validateApartmentSvgReferences`, `validateApartmentSvgGeometry`, and `buildValidatedApartment2D` through public shared APIs. It stops at the first failed stage, exposes complete diagnostics, and retains the trusted model only after all stages succeed. File and unexpected processing failures are separate application states. Replacements clear prior results; stale asynchronous reads are ignored.

The source is displayed independently of validation in a blob-backed SVG `<img>`. Uploaded markup is never inserted into the application DOM. Preview URLs are released on replacement and disposal. A preview decoding failure does not hide validation results. The viewer supports fit/reset, mouse and touch pan/zoom, and keyboard navigation. Image transforms use viewport pixels and never feed into authoritative geometry. React and 2D browser resources and interaction state remain in the application layer; 3D camera controls and their input lifecycle belong to the renderer adapter.

Successful validation also constructs `ArchitecturalModel3D` through its public builder. Valid documents start in 2D and expose a 3D switch without reparsing. The 3D view offers orbit inspection, embedded cameras, and Walk, with horizontal FOV adapted on resize. Walk is disabled with an explanatory message when no embedded camera exists. The browser owns the camera/view selector, independent focal-length and render-aspect controls, and concise navigation help. Focus view changes the layout without remounting the renderer or resetting its pose and projection selections. Unmount and replacement release renderer resources; failures remain explicit application states. Invalid documents retain only 2D preview and diagnostics.

Under ADR-004, the **accepted project-backed target workflow** changes input acquisition but does not require duplicating the deterministic validation pipeline. The browser will obtain project metadata and the active Apartment SVG through controlled server APIs rather than owning arbitrary local filesystem access. The shared parser/validator/model pipeline may continue to run in the browser where appropriate.

The browser must not send arbitrary absolute filesystem paths to the backend or bypass the project-filesystem boundary.

### 8.2. Server Application

The server application owns Node.js-only application and infrastructure concerns.

Under ADR-004, one server process owns exactly one project root supplied by `--project <path>` at startup. `runServer` parses the invocation and calls `loadProject` before constructing Fastify or listening. Invocation and project-loading failures return a non-zero process status; expected project errors retain their structured code and location in terminal diagnostics. `buildApplication(project)` receives the loaded context explicitly. `startServer` defaults to `127.0.0.1:3000` and retains meaningful port-conflict reporting. See the [startup command](../../README.md#adopted-project-based-workflow).

The implemented HTTP surface preserves `GET /health` and adds `GET /api/project`, which explicitly returns only the validated manifest's `schema`, `name`, and `architecture.active`. `GET /api/project/architecture` reads the selected file through the loaded `ProjectFilesystem` on each request and preserves its bytes, including invalid Apartment SVG contents. It uses `application/octet-stream` and `X-Content-Type-Options: nosniff`. Query parameters receive HTTP 400; post-start read or boundary failures receive a controlled HTTP 500 without physical paths or internal exceptions. The loaded manifest selection remains fixed until restart.

The project root is not statically mounted. Other project resources and `.planaxis/` are not exposed. The server does not yet serve the browser application or provide its proxy/CORS integration.

The server is responsible for:

- establishing the canonical project root;
- loading and validating the Project Format manifest;
- enforcing project-relative path and symbolic-link rules;
- confining all project filesystem access to the canonical root;
- exposing only deliberate project/resource APIs rather than a generic static view of the project directory;
- serving the web application where appropriate;
- project persistence and controlled writes;
- file storage and future asset processing;
- later versioning, authentication, and collaboration features if introduced;
- AI service integration;
- server-side or headless processing where required.

Filesystem-backed project serving binds to loopback by default. Wider network exposure requires an explicitly accepted security model and configuration.

The server should consume the same domain contracts as the browser rather than defining an incompatible parallel apartment model.

Project-format validation and Apartment SVG validation are separate concerns. The server may establish that the project and active SVG path are valid while the browser subsequently reports Apartment SVG validation errors.

### 8.3. Project Filesystem Boundary

Project resource access must pass through a centralized backend project-filesystem abstraction.

The implemented entry point is `loadProject(rootPath)` in `apps/server/src/project/load-project.ts`. It returns a `ProjectResult<ProjectContext>` with the canonical physical root, immutable validated manifest, active architecture project-relative path, and `ProjectFilesystem`. Pure manifest and path validators remain separate from filesystem inspection. Expected failures return a structured `PROJECT_*` code, message, and manifest-field/project-relative location; unexpected filesystem failures throw with their original cause.

Loading checks the required manifest and architecture structure, exact reserved-name spelling, optional reserved directory types when present, and the active file's readability. It does not read or validate the active SVG's contents. Unrelated entries are allowed, and `.planaxis/` is not required.

`ProjectFilesystem.resolve(path, kind)` inspects an existing file or directory. Its absolute path is transient backend metadata, not permission to bypass the boundary for later I/O. Consumers use `readFile(path)` for bytes or `checkReadableFile(path)` for an accessibility check. Each operation validates portable syntax, checks the established root, inspects path components without following symlinks, and verifies physical containment using native path relationships. Reads use a file handle with no-follow flags and recheck path/type/file identity before consuming bytes; handles are always closed. These portable Node.js checks do not provide an atomic directory-tree snapshot against a hostile local process concurrently replacing path components.

Startup and HTTP integration use this foundation as described in section 8.2. The filesystem boundary remains read-only; runtime project switching and writes are not implemented.

Conceptually:

```text
project-relative path
        ↓
ProjectFilesystem
        ↓
validate canonical syntax
resolve under canonical root
reject symlink traversal
verify root containment
        ↓
filesystem operation
```

HTTP routes, asset processors, AI workflows, thumbnail generators, and other server components should depend on this boundary instead of independently joining user-controlled strings with filesystem paths.

Persistent project descriptors use canonical project-relative paths. Native absolute paths may exist transiently inside the backend but must not become portable project data where the Project Format prohibits them.

`.planaxis/` is PlanAxis-owned disposable state. Deleting it must not remove authoritative or otherwise irreplaceable project information.

### 8.4. Developer Validation CLI

The repository also provides a Node.js developer CLI under `apps/cli` for validating one Apartment SVG file. The CLI owns command-line argument handling, UTF-8 filesystem access, console reporting, and process status. It composes the parser and validator public APIs in the same ordered stages described above and does not implement validation rules itself.

The standalone validation CLI is independent of the project-based web workflow unless a future task deliberately integrates Project Format support into it.

### 8.5. Shared Core

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
- renderer-independent model construction;
- deterministic format validation when it does not require environment-specific filesystem operations.

Environment-specific concerns such as actual filesystem traversal, HTTP transport, DOM APIs, and GPU lifecycle must remain outside shared core packages.

---

## 9. Package Boundaries

The application layer currently includes:

```text
apps/
    cli/
    server/
    web/
```

`apps/cli` is a Node.js-only adapter around the shared parser and validator packages. Filesystem, console, and process concerns remain there rather than entering the shared core.

`apps/server` owns backend HTTP and project-filesystem integration. The exact package/module placement of Project Format parsing and path-validation logic should be determined by concrete implementation pressure rather than by creating a speculative package solely because the format exists.

The monorepo defines these shared packages:

```text
packages/
    model/
    geometry/
    parser/
    validator/
    model-3d/
    renderer-three/
```

These names are not immutable, but the responsibilities they represent should remain distinct.

### `model`

Expected responsibilities:

- shared domain types;
- Apartment SVG semantic model types;
- `ValidatedApartment2D`;
- the validated apartment footprint and level-local architectural data;
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

- Apartment SVG schema validation;
- reference validation;
- geometric, topological, and footprint-containment validation;
- validation errors and error codes;
- production of the validated 2D domain model.

It must not produce renderer-specific objects.

PlanAxis Project Format validation must not be casually folded into the Apartment SVG validator merely because both concerns use the word "validation". They validate different external contracts.

### `model-3d`

Expected responsibilities:

- renderer-independent 3D architectural types;
- deterministic `ValidatedApartment2D` → `ArchitecturalModel3D` transformation.

It must not depend on Three.js.

### `renderer-three`

Owns Three.js scene construction, deterministic wall opening partitioning, PBR defaults, cameras, controls, and GPU resources. It depends on `model-3d` and exact geometry types, remains independent of React, and exposes explicit initialization, replacement, resize, camera selection, rendering, and disposal. The browser owns ResizeObserver and view state. Rendering is event-driven; no persistent application loop remains when inactive.

The renderer's `selectWalk()` activates a model-local `WalkControls` session. The first camera in document order supplies horizontal position, heading, and default horizontal FOV. The initial eye position uses `model.floor.z + 165 cm`, independent of source camera Z, with neutral pitch and zero roll. Exact coordinates cross the existing centimeters-to-meters boundary once. Walk pose, input, and speed are transient renderer state; neither the SVG nor the domain model changes. A session preserves its pose across inspection/embedded-camera selection and resets when the model is replaced.

The focused canvas handles WASD/arrows and left-mouse-drag look independently. Translation uses yaw only, normalized direction, and elapsed time at 1.5 m/s. Either Shift key doubles speed; either macOS Option key or Windows/Linux Space halves it. Fast and slow together cancel. The named settings live in `navigation-constants.ts`. Pitch is clamped to ±89°; movement has no collision, gravity, or footprint constraint. Input is cleared on pointer leave/cancel, canvas/window blur, hidden document visibility, mode exit, replacement, and disposal. Keyboard repeats cannot resurrect cleared input. A requestAnimationFrame loop exists only while resolved movement is nonzero; modifiers and opposing keys alone leave rendering idle. Mouse-only look renders from pointer events. Numeric lens overrides, aspect-ratio changes, resize, and Focus view preserve the Walk pose.

Avoid creating packages preemptively without implementation pressure.

---

## 10. Dependency Direction

Dependencies should flow toward stable domain concepts and explicit adapters.

A conceptual dependency direction is:

```text
                model
               ▲    ▲
              /      \
      geometry        parser
          ▲              │
           \             ▼
            └──── validator
                     ├──────────────► CLI application
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

Project-format contracts and project-filesystem adapters sit alongside this apartment-processing dependency chain rather than inside the architectural domain model. The server owns physical filesystem access; reusable pure path/manifest validation may be shared if a concrete implementation demonstrates that boundary.

This diagram is conceptual rather than a required literal package graph.

Important constraints are:

- domain packages do not depend on applications;
- core packages do not depend on Three.js;
- HTTP concerns do not leak into domain models;
- filesystem traversal does not leak into renderer-independent apartment models;
- project metadata does not redefine Apartment SVG geometry;
- parsing concerns do not leak into rendering;
- renderer-specific numeric compromises do not leak into authoritative geometry.

Circular dependencies between core packages should be avoided.

---

## 11. Validation Errors

Apartment SVG validation is expected to use structured errors rather than plain unstructured strings.

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

Project-format failures are a separate error domain and should remain distinguishable from `APSVG-*` failures. Project errors should identify the relevant manifest/path rule and useful context without exposing unnecessary machine-local filesystem information to untrusted clients.

Exact TypeScript error contracts belong in the relevant format/coding documentation once finalized.

---

## 12. Testing Architecture

Testing follows the same separation of concerns as production code.

Examples:

```text
project-format tests
    manifest / temporary project tree
        ↓
    project validation / safe path resolution

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

Project tests must protect manifest validation, canonical project-relative path rules, root containment, symbolic-link policy, `.planaxis/` disposability, and the separation between project-format and Apartment SVG validity.

Parser and validator behavior should be exercised with focused Apartment SVG fixtures, including footprint structure, orthogonal geometry, containment, and level-relative Z cases required by the current specification.

The repository distinguishes:

```text
fixtures/
```

for automated verification, including intentionally invalid cases, from:

```text
examples/
```

for valid user-facing demonstrations.

Filesystem tests should normally use isolated temporary directories rather than writing into repository fixtures or source directories unless a committed fixture is specifically justified.

Detailed testing rules belong in `docs/development/testing.md`.

---

## 13. Application State and Persistence

PlanAxis Project Format 1.0 is the accepted top-level persistence container for future project-based application operation.

The project manifest owns project organization. Apartment SVG owns apartment geometry and semantics.

The Project Format reserves durable areas for:

```text
architecture/    Apartment SVG architectural alternatives
assets/          normalized usable resources
references/      source and inspiration material
designs/         durable design-scenario data
outputs/         generated user-valued output
```

and one disposable internal area:

```text
.planaxis/
```

The complete `.planaxis/` directory may be deleted without losing authoritative or irreplaceable project information.

Persistent PlanAxis descriptors use project-relative paths according to the Project Format. Machine-local absolute paths must not become durable dependencies where the format requires portability.

Project-level persistence must not silently redefine Apartment SVG semantics. In particular:

```text
PlanAxis project/application state
```

is distinct from:

```text
Apartment SVG architecture
```

The two specifications remain independently versioned.

Project Format 1.0 intentionally does not define future material, model-asset, or design descriptor schemas. Those formats should be introduced only when concrete implementation requirements establish their correct boundaries.

---

## 14. AI-Assisted Features

AI-assisted redesign is a downstream capability.

AI systems may help with:

- layout ideas;
- furniture concepts;
- design briefs;
- material/style exploration;
- asset generation or preparation;
- photorealistic finishing;
- alternative proposals.

Project references, normalized assets, designs, and generated outputs provide natural persistence locations for those workflows as their contracts are introduced.

However:

- AI output must not override canonical geometry implicitly;
- geometric changes must be represented explicitly in the apartment model;
- image generation is not a source of architectural truth;
- generated visual output should be checked against the deterministic model when geometric fidelity matters;
- AI integrations must access project files through the same project-filesystem boundary as other backend consumers;
- AI output stored under `outputs/` is presentation output, not authoritative design or architectural input merely because it exists there.

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
- renderer abstractions without a second concrete renderer or another demonstrated need;
- global asset catalogs when project-local assets are sufficient;
- speculative material/model/design descriptor formats before their requirements are concrete.

When a significant new requirement changes an established architectural direction:

1. update the architecture documentation to describe the resulting system or accepted direction;
2. add or update an ADR to capture the decision and rationale;
3. update applicable normative specifications;
4. update tests and implementation consistently.

Architecture documentation describes the **current implemented system and accepted architectural direction**. Where accepted architecture is not implemented yet, the distinction must be explicit.

ADRs describe **why significant decisions were made**.

---

## 16. Current Implementation Phase

The initial React browser workflow is implemented: local SVG loading and validation, trusted 2D model retention, structured diagnostics, a safe read-only SVG pan/zoom viewer, interactive 3D inspection, embedded cameras, and free-walk navigation. `pnpm dev:web` starts this user-facing application.

The executable repository bootstrap, authoritative numeric and geometric foundations, Apartment SVG XML parsing boundary, schema-validation pipeline, reference validation, geometric/topological validation, developer validation CLI, and `ValidatedApartment2D` construction are implemented. The Node.js CLI reads one Apartment SVG file and composes the shared parse, schema, reference, and geometry stages while keeping filesystem and process behavior in the application layer. Schema validation produces a typed, exact-decimal `SchemaValidApartmentSvgDocument`; reference validation resolves its core relationships into `ReferenceValidApartmentSvgDocument`; and the geometry stage establishes the nominal `GeometryValidApartmentSvgDocument` boundary before `@planaxis/validator` constructs the normalized, exact-decimal `ValidatedApartment2D` owned by `@planaxis/model`.

Apartment SVG 2.2 is the normative apartment format, and the parser, validator, CLI, and trusted 2D domain pipeline are fully aligned with it. Schema and reference stages preserve the mandatory exact-decimal footprint while leaving geometry checks to the geometry stage. Successful geometric validation guarantees footprint topology, positive area, exact orthogonality, root viewBox containment, and complete stationary placement containment within the closed footprint. Hinged-door open-leaf geometry is exempt from footprint containment but remains inside the viewBox. Camera collisions compare level-local Z ranges consistently. `ValidatedApartment2D` retains the canonical footprint and unchanged level-local architectural Z values, with the level offset stored separately. Exact, renderer-independent 3D geometry foundations are implemented in `@planaxis/geometry`: `Point3D`, `VerticalRange`, `RectangularPrism3D`, and `HorizontalPolygonSurface3D`. Point comparisons reuse the centralized geometric tolerance, and range height is derived with exact decimal subtraction. These primitives carry no architectural or transformation semantics. `@planaxis/model-3d` implements deterministic `ArchitecturalModel3D` construction from trusted 2D input using these primitives, preserving architectural semantics and resolved relationships without renderer objects or unsupported physical assumptions. The Three.js adapter and browser 2D/3D workflow are implemented as described above.

The Project Format 1.0 loading and read-only project-filesystem foundation is implemented in `apps/server/src/project/`, as described in section 8.3. Server startup selects and loads one required project root before listening on loopback, and controlled project metadata and active-architecture HTTP APIs are implemented. Browser integration remains follow-up work. The browser still loads a local SVG directly.

The intended implementation order is now broadly:

```text
repository bootstrap
    ↓
numeric and geometric foundations
    ↓
Apartment SVG parsing and validation
    ↓
ValidatedApartment2D
    ↓
ArchitecturalModel3D
    ↓
Three.js visualization and navigation
    ↓
PlanAxis Project Format implementation
    ↓
project filesystem boundary + server-backed project workflow
    ↓
visual rendering / material foundation
    ↓
project-local asset and design scenario formats
    ↓
lighting and richer design workflows
    ↓
AI-assisted design and presentation workflows
```

This sequence may be refined as implementation progresses, but downstream features must not bypass the deterministic validation, project-root, or geometry foundations.
