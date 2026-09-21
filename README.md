# PlanAxis

**Structured apartment modeling, deterministic validation, interactive 3D visualization, and AI-assisted redesign.**

**PlanAxis** is a TypeScript-based toolkit and web application for validating, interpreting, visualizing, and eventually redesigning apartments described by a structured SVG floor-plan format.

The project is built around the versioned, normative [Apartment SVG 2.2 specification](docs/specifications/apartment-svg/2.2.md), where an SVG document is not merely a drawing: it is the canonical, machine-readable representation of an apartment's geometry and semantics.

PlanAxis has also adopted the versioned [PlanAxis Project Format 1.0 specification](docs/specifications/planaxis-project/1.0.md) as the top-level container for filesystem-backed renovation projects. The project manifest organizes architecture and project resources without replacing Apartment SVG as the source of architectural truth.

The versioned [PlanAxis Design Format 1.0 specification](docs/specifications/planaxis-design/1.0.md) defines durable renderer-independent design scenarios bound to one Apartment SVG architecture. The shared `@planaxis/design` package implements JSON and descriptor-path validation, exact architecture binding, and finish-target resolution. The server supports controlled design discovery, reads, creation, updates, and reads of design-bound architectures. Browser scenario selection and editing remain pending Phase 2 integration.

> [!NOTE]
> The React browser application is the first official user-facing entry point. It automatically loads the server-selected project’s active SVG for validation and read-only 2D/3D viewing. The executable TypeScript monorepo foundation, exact-decimal geometry primitives, Apartment SVG 2.2 parser and complete validation pipeline, developer validation CLI, and normalized `ValidatedApartment2D` domain model are in place. Validation enforces canonical footprint geometry, complete stationary placement containment, and level-local camera collisions. The trusted model retains the exact-decimal footprint and level-local architectural Z values. Exact, renderer-independent `ArchitecturalModel3D` construction is implemented in `@planaxis/model-3d`. Interactive 3D viewing is implemented in `@planaxis/renderer-three`; see the browser workflow below. The Project Format 1.0 loader and project-filesystem boundary, including explicit design persistence, are implemented in the server. The server now requires one project at startup, binds to loopback, and exposes controlled metadata and active-architecture HTTP APIs. The browser validates the API metadata and feeds the fetched SVG into the existing browser-side pipeline, completing Phase 0.

## Project Goals

The long-term workflow is:

```text
PlanAxis project
    ↓
active Apartment SVG
    ↓
validation
    ↓
validated 2D domain model
    ↓
renderer-independent 3D architectural model
    ↓
interactive Three.js visualization
    ↓
design exploration and redesign
    ↓
updated floor plan and interior design
    ↓
technical and AI-assisted photorealistic renders
```

The initial implementation focuses on establishing a deterministic and testable foundation for:

- parsing Apartment SVG documents;
- validating schema, references, geometry, and topology;
- producing a strongly typed in-memory 2D domain model;
- deriving a renderer-independent 3D architectural model;
- rendering and exploring the apartment interactively in the browser;
- establishing a portable filesystem-backed project container for later assets and designs;
- simulating runtime conditions such as date, time, sunlight, and artificial lighting.

AI-assisted redesign and photorealistic rendering are later stages built on top of this deterministic geometry pipeline.

## Core Principles

### The SVG is the source of architectural truth

The Apartment SVG document is the canonical external model for apartment geometry and semantics.

Geometry must not be inferred from CSS, visual appearance, annotations, natural-language labels, project metadata, or other non-normative information. Missing required information must result in validation errors rather than guesses.

Apartment SVG 2.2 makes the mandatory apartment-level footprint canonical geometry. The footprint is not inferred from walls or zones; it defines the horizontal physical extent of the modeled level and the XY extent of its implicit floor and default ceiling surfaces.

### The project manifest organizes the project, not its geometry

`planaxis.project.json` is the authoritative project-organization manifest defined by PlanAxis Project Format 1.0. It identifies the project and selects the active Apartment SVG, while architecture remains in Apartment SVG files.

Durable project references are project-relative and portable. The filesystem-backed project root is intended to contain architecture, assets, references, designs, generated output, and disposable PlanAxis internal state without becoming a second apartment model.

### Validation precedes 3D generation

A 3D model may only be created from a fully validated Apartment SVG document.

The intended processing pipeline is:

```text
SVG
  → parse
  → schema validation
  → reference validation
  → geometric validation
  → ValidatedApartment2D
  → ArchitecturalModel3D
  → renderer adapter
```

`ValidatedApartment2D` is an in-memory domain representation of the validated SVG. It is not a second source of truth and is not a separate persistence format.

### Authoritative geometry uses exact decimal arithmetic

Apartment geometry is expressed in centimeters and must not rely on JavaScript binary floating-point arithmetic for authoritative calculations.

Exact decimal arithmetic is used throughout the domain and validation layers. Conversion to native JavaScript `number` values is allowed only at explicitly defined boundaries where required by external systems such as Three.js.

Architectural element Z values are level-relative. `metadata.level.baseZ` positions the level-local floor plane in model space, while geographic `elevationMeters` remains independent MSL metadata.

### Rendering is separate from domain logic

The architectural model must remain independent of Three.js or any other renderer.

Renderer-specific objects such as `THREE.Scene`, `THREE.Mesh`, materials, lights, and cameras belong exclusively to renderer adapter layers.

## Planned Technology Stack

The project is intended to use:

- **TypeScript** for all application code;
- **Node.js** for server-side execution;
- **pnpm workspaces** for the monorepo;
- **Fastify** for the backend HTTP layer;
- **React and Vite** for the browser application;
- **Three.js** for interactive 3D rendering;
- **decimal.js** for authoritative decimal arithmetic;
- **Vitest** for automated testing.

The exact dependency set may evolve through documented architectural decisions.

## Repository Structure

PlanAxis is a pnpm workspace monorepo organized around the following areas:

```text
.
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
│
├── apps/
│   ├── cli/
│   ├── server/
│   └── web/
│
├── packages/
│   ├── model/
│   ├── geometry/
│   ├── parser/
│   ├── validator/
│   ├── model-3d/
│   ├── design/
│   └── renderer-three/
│
├── examples/
│
├── fixtures/
│   ├── valid/
│   └── invalid/
│
├── docs/
│   ├── specifications/
│   │   ├── apartment-svg/
│   │   ├── planaxis-project/
│   │   └── planaxis-design/
│   ├── architecture/
│   ├── development/
│   ├── decisions/
│   └── tasks/
│
├── AGENTS.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── .editorconfig
├── .gitattributes
└── .gitignore
```

The exact package structure may be refined during implementation. Architectural boundaries are more important than preserving a particular directory layout.

`fixtures/` is intended for automated verification and may contain intentionally invalid or synthetic Apartment SVG documents. `examples/` is intended for valid, user-facing samples suitable for learning and demonstration.

## Open a Floor Plan in the Browser

The React browser application is the first official user-facing PlanAxis entry point.
Start the backend with an existing conforming [PlanAxis project](#adopted-project-based-workflow),
from the repository root in one terminal:

```bash
pnpm --filter @planaxis/server... build
node apps/server/dist/index.js --project "/path/to/my-apartment"
```

In a second terminal, also from the repository root:

```bash
pnpm dev:web
```

This builds the shared browser dependencies and starts Vite. Open the local Vite URL printed
in the terminal. Vite proxies only the project metadata and active-architecture API paths to
`http://127.0.0.1:3000`; browser requests use relative URLs with no CORS configuration.
The browser automatically loads `/api/project`, validates its supported schema and metadata
shape, then fetches `/api/project/architecture`. The project name and project-relative active
architecture path identify the workspace; the physical root stays on the server.

The fetched SVG is parsed, validated, and converted to `ValidatedApartment2D` in the browser.
The status and collapsible validation panel expose parser and structured validation diagnostics.
Project/API/network failures appear separately from invalid Apartment SVG content. A valid
project container may contain an invalid SVG, which still reaches the diagnostic workflow.
There is no file picker, drop-loading fallback, polling, or automatic file watching. Reload the
page to fetch the active SVG again; restart the server and reload the page to switch projects
or update the manifest selection.

The read-only 2D viewer displays the original SVG in a restricted image context, including
renderable drawings that fail Apartment SVG validation. Drag to pan, scroll or pinch to
zoom, and use **Fit / Reset** to frame the drawing. With the viewport focused, use the
arrow keys, `+` / `-`, and `0`. Use **Focus view**
to expand the active 2D or 3D viewport across the browser client area without resetting its
navigation state; close it with the corner control or `Escape`. This layout mode does not use
the browser Fullscreen API, so browser and operating-system chrome remain unchanged.

For a valid document, choose **3D** to inspect walls with door/window openings, fixed
elements, and utility markers. Drag to orbit, right-drag to pan, and scroll to zoom;
touch supports one-finger orbit and two-finger pan/zoom. Use the **Camera** selector for
embedded SVG cameras, **Walk**, or **Inspection / orbit**. The independent **Focal length**
selector keeps each camera's default projection or applies a 16–85 mm full-frame preset.
The **Aspect ratio** selector either fills the viewport or centers the largest fitting
16:9, 3:2, 1:1, 2:3, or 9:16 render surface. Framing choices survive camera changes,
resizing, and Focus view transitions. Each page load starts in 2D; switching views does
not refetch or reparse the SVG. A browser needs WebGPU or WebGL2 for 3D.

**Walk** requires at least one embedded camera. It starts at the first camera's horizontal
position and heading, with a fixed eye height of 165 cm above the floor and a level gaze.
With the 3D canvas focused (click it to refocus), hold **WASD** or the **arrow keys** to move
and **left-drag** to look; both controls work together. Base speed is 1.5 m/s. Hold **Shift**
for twice the speed, or **Option** on macOS / **Space** on Windows and Linux for half speed.
Fast and slow together use normal speed. Movement stays horizontal and has no collisions:
you can pass through walls and move outside the apartment. Leaving the canvas or losing
focus clears held controls. Returning to Walk from another 3D camera mode restores the
Walk pose; reloading the page starts a new session. **Camera default** uses the first
embedded camera's horizontal FOV in Walk; lens and aspect-ratio choices remain independent.

See [ADR-003](docs/decisions/ADR-003-three-renderer-architecture.md).

React is confined to `apps/web`; see [ADR-002](docs/decisions/ADR-002-react-browser-ui.md).

The Phase 1 surface foundation is implemented in `@planaxis/model-3d`. `ArchitecturalModel3D` retains validated spaces, and `deriveArchitecturalSurfaces` produces exact physical surface patches and stable finish addresses: `floor`, `ceiling`, both `wall:<id>:side-negative` / `side-positive` targets, and physically existing `wall:<wall-id>:opening:<opening-id>:reveal-start` / `reveal-end` / `reveal-top` / `reveal-bottom` targets. Wall union and opening boundaries are derived before renderer conversion. Space targets prefix the applicable floor, ceiling, or adjacent wall-side address with `space:<space-id>:` and explicitly fall back to the base target. They describe coverage without creating duplicate render surfaces. See [architectural surface derivation](docs/architecture/overview.md#58-architectural-surface-derivation).

The surface foundation also exposes exact physical mapping frames shared by base and space targets. The renderer generates UVs from centimeter distances divided by declared texture width/height, preserving scale and phase across patches and openings. Transient `RuntimePbrMaterial` assignments support base color, roughness, metalness, color/data/normal maps, and ordinary opaque/masked/blended alpha. Space assignments fall back to their base target and then to the existing neutral appearance. Coverage is tessellated into non-overlapping material draw groups; source selection is preserved.

Call `buildApartmentScene(model, finishes)` or `renderer.setModel(model, finishes)` with `RuntimeFinishOptions`. Texture references are in-process symbols resolved to already loaded, borrowed Three.js textures. The adapter creates and disposes its own configured clones; callers retain ownership of source textures and decoded images. Finish assignment has no browser selection UI or persistence semantics. See the [runtime finish contract](docs/architecture/overview.md#59-renderer-adapter) for map conventions and an API example.

Window planes use physically based transmission with zero thickness and qualitative clear/frosted/tinted defaults. A built-in neutral room environment supplies image-based lighting (IBL) and reflections without network downloads or project assets. It replaces hemisphere ambient illumination; the deterministic directional key/shadow light remains. The neutral background stays separate from the lighting environment.

The 3D toolbar offers **Tone mapping** (AgX by default, ACES Filmic, or Neutral), **Exposure** (−4 to +4 EV in 0.1-stop increments), **Environment intensity** (0–4 in 0.1 increments), and **Environment rotation** (0–360° in 1° increments). Defaults are 0 EV, intensity 1, and rotation 0°. Exposure converts to the renderer multiplier as `2 ** EV`; positive environment yaw turns architectural +X toward +Y. Controls update the next frame immediately and remain disabled until initialization completes. Camera, Walk, lens, resize, and Focus view changes preserve presentation selections for the viewport lifetime. Focus view hides the toolbar.

Presentation settings are currently transient React/renderer state. PlanAxis Design Format 1.0 now defines durable scenario-level tone-mapping and exposure overrides, with server persistence APIs available; browser editing and applying those overrides remain unimplemented. Persistent material/environment assets, material interpretation, lighting design, and post-processing remain future work.

The dedicated `@planaxis/renderer-three` adapter provides WebGPU-first Three.js rendering with its supported WebGL2 fallback. It converts exact centimeters to meters only at the renderer boundary, mapping PlanAxis `(X, Y, Z)` to Three.js `(X, Z, Y)`. Valid documents support 2D/3D switching, orbit inspection, embedded-camera viewing, and free-walk navigation; invalid documents retain the 2D diagnostic workflow. Persistent material assets, advanced lighting, and AI-assisted features remain future stages.

## Adopted Project-Based Workflow

[ADR-004](docs/decisions/ADR-004-filesystem-backed-projects.md) adopts one filesystem-backed PlanAxis project per server process. A project is a physical directory conforming to [PlanAxis Project Format 1.0](docs/specifications/planaxis-project/1.0.md), with a required `planaxis.project.json` manifest and an active Apartment SVG under `architecture/`.

The implemented Phase 0 project-based application flow is:

```text
project root supplied at server startup
    ↓
server establishes canonical project-filesystem boundary
    ↓
project manifest selects active Apartment SVG
    ↓
browser validates project metadata, then fetches active Apartment SVG
    ↓
existing parse / validation / 2D / 3D pipeline
```

The backend loading foundation now validates Project Format 1.0 manifests and required structure, establishes a canonical physical root, and provides centralized resource access and explicit design writes with project-relative path, containment, and symlink checks. It verifies that the active architecture is an accessible regular `.svg` file without parsing its contents. Optional directories, including disposable `.planaxis/`, may be absent. See the [project-filesystem boundary](docs/architecture/overview.md#83-project-filesystem-boundary).

The server operates on one explicitly selected project for its lifetime. From the repository root, build and start it with an existing conforming project:

```bash
pnpm --filter @planaxis/server... build
node apps/server/dist/index.js --project "/path/to/my-apartment"
```

The required `--project <path>` accepts an absolute path or a path relative to the current working directory. Quote paths containing spaces; prefix a relative name beginning with `-` with `./`. Missing, duplicate, or unsupported arguments and invalid projects fail before listening with a non-zero process status. The server listens on `127.0.0.1:3000` and reports an occupied port clearly. Restart with another root to switch projects or reload the manifest selection.

The implemented endpoints are:

- `GET /health`: the existing `{ "status": "ok" }` response.
- `GET /api/project`: only `schema`, `name`, and `architecture.active` from the validated startup manifest; no physical root or filesystem internals.
- `GET /api/project/architecture`: the current bytes of the selected file, read through the project boundary on each request, with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`. Query parameters are rejected with HTTP 400. A resource that becomes unavailable or violates the filesystem boundary produces a controlled HTTP 500 error.

- `GET /api/project/designs`: `{ "designs": [...] }` with recursively discovered, lexicographically sorted lowercase `.json` regular files under `designs/`. Missing `designs/` returns an empty list; inaccessible files and symlinks are skipped. Discovery does not parse contents.
- `GET /api/project/design?path=designs/example.json`: unchanged descriptor bytes, including malformed or unsupported content, with the same octet-stream/nosniff headers.
- `POST /api/project/design?path=designs/example.json`: validate the JSON body as a [Design 1.0 document](docs/specifications/planaxis-design/1.0.md), create ordinary missing parent directories, and return HTTP 201 with `{ "path": "designs/example.json" }`. Existing targets produce HTTP 409.
- `PUT /api/project/design?path=designs/example.json`: validate and replace an existing accessible regular descriptor, returning HTTP 204; missing targets produce HTTP 404.
- `GET /api/project/architecture-resource?path=architecture/variant.svg`: unchanged bytes of a specific lowercase `.svg` resource under `architecture/`, with octet-stream/nosniff headers, independently of the active selection.

Resource selectors require exactly one `path` query parameter and reject unknown parameters. Design discovery accepts no query parameters. Writes serialize only the validated document as UTF-8 JSON with two-space indentation and one trailing newline. A complete synced staging file is published without overwriting on create, or atomically renamed on update; directory entries are synced where supported. Design errors return HTTP 400 with `{ "error": { "stage", "code", "location", "message" } }`. Selected-resource failures return 400 for invalid paths/types, 403 for inaccessible or prohibited resources, 404 for missing resources, or 409 for conflicts/changed resources. Unexpected infrastructure errors are logged server-side and return a generic safe HTTP 500. These APIs do not resolve architecture, finish targets, or material resources during writes.

Apartment SVG contents are served unchanged even when invalid; parsing and validation remain downstream. The server exposes only these controlled resources, never the complete project root or `.planaxis/`, and does not serve the React application or add CORS integration.

The browser uses the two project APIs through the development-only Vite proxy described above. Fastify does not serve the React build; the two-process development flow is the supported browser startup workflow. Server design persistence is implemented. Browser design selection/editing, persistent assets, material management, and redesign remain unimplemented.

## Validate an Apartment SVG

Use the developer CLI from the repository root with exactly one Apartment SVG file path:

```bash
pnpm validate:svg fixtures/valid/minimal-document-schema.svg
```

A fully valid document prints:

```text
Apartment SVG is valid.
```

The command runs the shared parser, schema validator, reference validator, and geometric/topological validator in order. Parser and validation diagnostics are written to standard error, and invalid invocation, file-read failure, or invalid Apartment SVG input produces a non-zero process status.

## Documentation

Project documentation lives under [`docs/`](docs/).

### Specifications

[`docs/specifications/`](docs/specifications/) contains normative format and domain specifications.

The [Apartment SVG 2.2 specification](docs/specifications/apartment-svg/2.2.md) defines the external apartment format, validation rules, geometric invariants, reference semantics, footprint and containment semantics, architectural Z semantics, and canonical interpretation rules.

The [PlanAxis Project Format 1.0 specification](docs/specifications/planaxis-project/1.0.md) defines the portable filesystem-backed project container, root manifest, reserved directory roles, project-relative path semantics, and project-root filesystem boundary. It does not redefine Apartment SVG geometry.

The [PlanAxis Design Format 1.0 specification](docs/specifications/planaxis-design/1.0.md) defines durable design-scenario descriptors under `designs/`, strict binding to one Apartment SVG architecture, persistent finish assignments through project-local material-resource references, and optional presentation overrides. Material-resource semantics remain outside Design Format 1.0.

### Architecture

[`docs/architecture/`](docs/architecture/) describes the current software architecture and the responsibilities and boundaries of the major components.

The primary entry point is:

```text
docs/architecture/overview.md
```

### Development

[`docs/development/`](docs/development/) contains implementation and contribution guidance, including:

```text
docs/development/coding-guidelines.md
docs/development/testing.md
docs/development/agent-task-workflow.md
```

### Architectural Decision Records

[`docs/decisions/`](docs/decisions/) contains Architectural Decision Records (ADRs).

ADRs document significant technical decisions, their context, considered alternatives, and consequences. They preserve the reasoning behind the architecture without turning the current architecture documentation into a historical log.

The filesystem-backed project operating model is recorded in [ADR-004](docs/decisions/ADR-004-filesystem-backed-projects.md).

### Formal Agent Tasks

[`docs/tasks/`](docs/tasks/) contains the repository artifacts used for formally delegated coding-agent tasks.

A formal task consists of a task record and an authoritative task description. Shared task-process documents define the record format and provide task-description guidance.

The human-facing workflow for creating, executing, reviewing, and finalizing delegated tasks is documented in:

```text
docs/development/agent-task-workflow.md
```

## Repository Language

**English is the mandatory language of the repository.**

This applies to:

- documentation;
- source code;
- identifiers;
- type, class, function, method, and variable names;
- comments;
- commit-facing technical terminology;
- validation messages intended for developers;
- tests and fixture descriptions.

Natural-language discussion outside the repository may use any language, but repository artifacts must remain in English unless a future requirement explicitly defines a localized user-facing resource.

## Development Status

The executable pipeline through `ValidatedApartment2D` is implemented: Apartment SVG parsing, schema validation, reference validation, geometric/topological validation, the developer validation CLI, and trusted 2D domain-model construction all exist. `GeometryValidApartmentSvgDocument` marks the final trusted SVG boundary before normalized domain construction.

The parser, validator, CLI, and `ValidatedApartment2D` pipeline are aligned with Apartment SVG 2.2. Successful validation guarantees a simple, positive-area orthogonal footprint within the root `viewBox`, complete stationary geometry containment within its closed region, and level-local camera collision checks. Hinged-door open-leaf points may extend beyond the footprint but must remain within the `viewBox`. The trusted domain model exposes the canonical footprint separately from root bounds and includes the same footprint instance in its semantic ID index. Architectural Z values remain level-local, with `metadata.level.baseZ` retained separately for 3D construction. The geometry package now exposes `Point3D`, `VerticalRange`, `RectangularPrism3D`, and `HorizontalPolygonSurface3D`, with exact and tolerance-aware point equality and exact range-height derivation. `@planaxis/model-3d` now exports `buildArchitecturalModel3D(ValidatedApartment2D)`: it constructs floor and default ceiling surfaces, wall envelopes, window/door opening prisms, fixed-element volumes, utility positions, and exact camera definitions. It preserves architectural semantics and resolved relationships through constructed 3D instances and a source-semantic ID index. Model-space Z applies the level offset exactly once; X/Y remain unchanged. No slab thickness, physical door-leaf geometry, renderer tessellation, or renderer objects are inferred. The renderer adapter, browser inspection workflow, and free-walk navigation are implemented. Persistent material assets, advanced lighting, and AI-assisted features remain future stages.

PlanAxis Project Format 1.0 and ADR-004 define the implemented Phase 0 application foundation: a portable project directory, server-owned project filesystem boundary, one active project per server process, and controlled browser access to project resources. The loader, filesystem boundary, project-root startup selection, loopback binding, controlled resource APIs, and explicit design persistence are implemented. The browser automatically loads validated project metadata and the active SVG through those APIs while retaining browser-side Apartment SVG validation and the 2D/3D workflow.

PlanAxis Design Format 1.0 is the accepted normative persistence contract for Phase 2 design scenarios. `@planaxis/design` provides `parseDesignDescriptor(text, descriptorPath)` and `validateDesignDescriptor(value, descriptorPath)`, returning an immutable, format-conformant descriptor with external `path` identity and a separate `document` containing only serialized fields. JSON syntax and format failures have structured codes and field locations. `resolveDesignArchitecture(design, { path, finishTargets })` checks exact binding and reports all unresolved targets against caller-supplied targets derived from a fully validated architecture. The package performs no filesystem access, SVG loading, material interpretation, or rendering. Server design APIs use this structural boundary for persistence; browser scenario selection and editing remain Phase 2 integration work.

Each implementation phase should have explicit acceptance criteria and automated tests.

## Development Workflow

PlanAxis distinguishes between two development modes:

```text
Mode A — Human-Owned Development
Mode B — Agent-Delegated Task Execution
```

In **Mode A**, a human developer owns the implementation. AI may be used for assistance, review, explanations, code suggestions, debugging, or similar support without requiring formal task artifacts.

In **Mode B**, a complete unit of implementation work is formally delegated to a coding agent. The task is defined and tracked in committed artifacts under `docs/tasks/`, execution begins only from a clean human-prepared repository state, the resulting changes receive human review, and Git history remains human-controlled.

The complete Mode B process is defined in:

```text
docs/development/agent-task-workflow.md
```

Formal task record structure is defined in:

```text
docs/tasks/TASK-RECORD-SPECIFICATION.md
```

Task descriptions should be prepared using:

```text
docs/tasks/TASK-DESCRIPTION-TEMPLATE.md
```

The project exposes these standard workspace commands:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm validate:svg <path-to-svg>
pnpm dev:web
```

These commands must remain reliable because they are part of both human development and formal coding-agent verification.

Detailed development rules belong under `docs/development/` rather than in this README.

## Coding Agents

Coding agents working directly in this repository must read and follow [`AGENTS.md`](AGENTS.md).

`AGENTS.md` defines repository-level agent behavior, including architectural constraints, mandatory Git preflight, Git write restrictions, verification expectations, and the access rules for formal task artifacts.

For a formal Mode B task, the coding agent receives one authoritative `TASK-NNN-description.md` under `docs/tasks/`. The short invocation prompt points to that committed description rather than redefining the task in chat.

Task records, task lifecycle changes, Git operations, implementation acceptance, and task finalization remain human responsibilities.

## License

PlanAxis is licensed under the **Apache License 2.0**.

See [`LICENSE`](LICENSE) for the full license text.
