# PlanAxis

**Structured apartment modeling, deterministic validation, interactive 3D visualization, and AI-assisted redesign.**

**PlanAxis** is a TypeScript-based toolkit and web application for validating, interpreting, visualizing, and eventually redesigning apartments described by a structured SVG floor-plan format.

The project is built around the versioned, normative [Apartment SVG 2.2 specification](docs/specifications/apartment-svg/2.2.md), where an SVG document is not merely a drawing: it is the canonical, machine-readable representation of an apartment's geometry and semantics.

PlanAxis has also adopted the versioned [PlanAxis Project Format 1.0 specification](docs/specifications/planaxis-project/1.0.md) as the future top-level container for filesystem-backed renovation projects. The project manifest organizes architecture and project resources without replacing Apartment SVG as the source of architectural truth.

> [!NOTE]
> The React browser application currently provides local SVG loading, validation, and a read-only pan/zoom 2D viewer as the first official user-facing entry point. The executable TypeScript monorepo foundation, exact-decimal geometry primitives, Apartment SVG 2.2 parser and complete validation pipeline, developer validation CLI, and normalized `ValidatedApartment2D` domain model are in place. Validation enforces canonical footprint geometry, complete stationary placement containment, and level-local camera collisions. The trusted model retains the exact-decimal footprint and level-local architectural Z values. Exact, renderer-independent `ArchitecturalModel3D` construction is implemented in `@planaxis/model-3d`. Interactive 3D viewing is implemented in `@planaxis/renderer-three`; see the browser workflow below. The Project Format 1.0 loader and read-only project-filesystem foundation are implemented in the server. The server now requires one project at startup, binds to loopback, and exposes controlled metadata and active-architecture HTTP APIs. Browser migration remains future work; the current browser workflow remains local drag-and-drop.

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
│   │   └── planaxis-project/
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
Start it from the repository root:

```bash
pnpm dev:web
```

This builds the shared packages and starts Vite. Open the local URL printed in the terminal.
Browse for one SVG or drop it anywhere in the application. The file is read, parsed,
validated, and converted to `ValidatedApartment2D` locally, without a server or upload.
The status and collapsible validation panel expose parser and structured validation diagnostics.

The read-only 2D viewer displays the original SVG in a restricted image context, including
renderable drawings that fail Apartment SVG validation. Drag to pan, scroll or pinch to
zoom, and use **Fit / Reset** to frame the drawing. With the viewport focused, use the
arrow keys, `+` / `-`, and `0`. Open another file to replace the document. Use **Focus view**
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
resizing, and Focus view transitions. Every replacement starts in 2D; switching views does
not reparse the file. A browser needs WebGPU or WebGL2 for 3D.

**Walk** requires at least one embedded camera. It starts at the first camera's horizontal
position and heading, with a fixed eye height of 165 cm above the floor and a level gaze.
With the 3D canvas focused (click it to refocus), hold **WASD** or the **arrow keys** to move
and **left-drag** to look; both controls work together. Base speed is 1.5 m/s. Hold **Shift**
for twice the speed, or **Option** on macOS / **Space** on Windows and Linux for half speed.
Fast and slow together use normal speed. Movement stays horizontal and has no collisions:
you can pass through walls and move outside the apartment. Leaving the canvas or losing
focus clears held controls. Returning to Walk from another 3D camera mode restores the
Walk pose; replacing the document starts a new session. **Camera default** uses the first
embedded camera's horizontal FOV in Walk; lens and aspect-ratio choices remain independent.

See [ADR-003](docs/decisions/ADR-003-three-renderer-architecture.md).

React is confined to `apps/web`; see [ADR-002](docs/decisions/ADR-002-react-browser-ui.md).
The dedicated `@planaxis/renderer-three` adapter provides WebGPU-first Three.js rendering with its supported WebGL2 fallback. It converts exact centimeters to meters only at the renderer boundary, mapping PlanAxis `(X, Y, Z)` to Three.js `(X, Z, Y)`. Valid documents support 2D/3D switching, orbit inspection, embedded-camera viewing, and free-walk navigation; invalid documents retain the 2D diagnostic workflow. Advanced lighting/materials and AI-assisted features remain future stages.

## Adopted Project-Based Workflow

[ADR-004](docs/decisions/ADR-004-filesystem-backed-projects.md) adopts one filesystem-backed PlanAxis project per server process. A project is a physical directory conforming to [PlanAxis Project Format 1.0](docs/specifications/planaxis-project/1.0.md), with a required `planaxis.project.json` manifest and an active Apartment SVG under `architecture/`.

The intended project-based application flow is:

```text
project root supplied at server startup
    ↓
server establishes canonical project-filesystem boundary
    ↓
project manifest selects active Apartment SVG
    ↓
browser obtains project resources through controlled APIs
    ↓
existing parse / validation / 2D / 3D pipeline
```

The backend loading foundation now validates Project Format 1.0 manifests and required structure, establishes a canonical physical root, and provides centralized read-only access with project-relative path, containment, and symlink checks. It verifies that the active architecture is an accessible regular `.svg` file without parsing its contents. Optional directories, including disposable `.planaxis/`, may be absent. See the [project-filesystem boundary](docs/architecture/overview.md#83-project-filesystem-boundary).

The server operates on one explicitly selected project for its lifetime. From the repository root, build and start it with an existing conforming project:

```bash
pnpm --filter @planaxis/server build
node apps/server/dist/index.js --project "/path/to/my-apartment"
```

The required `--project <path>` accepts an absolute path or a path relative to the current working directory. Quote paths containing spaces; prefix a relative name beginning with `-` with `./`. Missing, duplicate, or unsupported arguments and invalid projects fail before listening with a non-zero process status. The server listens on `127.0.0.1:3000` and reports an occupied port clearly. Restart with another root to switch projects or reload the manifest selection.

The implemented endpoints are:

- `GET /health`: the existing `{ "status": "ok" }` response.
- `GET /api/project`: only `schema`, `name`, and `architecture.active` from the validated startup manifest; no physical root or filesystem internals.
- `GET /api/project/architecture`: the current bytes of the selected file, read through the project boundary on each request, with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`. Query parameters are rejected with HTTP 400. A resource that becomes unavailable or violates the filesystem boundary produces a controlled HTTP 500 error.

Apartment SVG contents are served unchanged even when invalid; parsing and validation remain downstream. The server does not expose the complete project root, other resources, or `.planaxis/`, and does not serve the React application or add CORS integration.

Browser integration remains future work. Continue to use the local file picker or drag-and-drop browser workflow described above.

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

The parser, validator, CLI, and `ValidatedApartment2D` pipeline are aligned with Apartment SVG 2.2. Successful validation guarantees a simple, positive-area orthogonal footprint within the root `viewBox`, complete stationary geometry containment within its closed region, and level-local camera collision checks. Hinged-door open-leaf points may extend beyond the footprint but must remain within the `viewBox`. The trusted domain model exposes the canonical footprint separately from root bounds and includes the same footprint instance in its semantic ID index. Architectural Z values remain level-local, with `metadata.level.baseZ` retained separately for 3D construction. The geometry package now exposes `Point3D`, `VerticalRange`, `RectangularPrism3D`, and `HorizontalPolygonSurface3D`, with exact and tolerance-aware point equality and exact range-height derivation. `@planaxis/model-3d` now exports `buildArchitecturalModel3D(ValidatedApartment2D)`: it constructs floor and default ceiling surfaces, wall envelopes, window/door opening prisms, fixed-element volumes, utility positions, and exact camera definitions. It preserves architectural semantics and resolved relationships through constructed 3D instances and a source-semantic ID index. Model-space Z applies the level offset exactly once; X/Y remain unchanged. No slab thickness, physical door-leaf geometry, mesh processing, or renderer objects are inferred. The renderer adapter, browser inspection workflow, and free-walk navigation are implemented. Advanced lighting/materials and AI-assisted features remain future stages.

PlanAxis Project Format 1.0 and ADR-004 now define the accepted next application foundation: a portable project directory, server-owned project filesystem boundary, one active project per server process, and controlled browser access to project resources. The loader, read-only filesystem boundary, project-root startup selection, loopback binding, and controlled project APIs are implemented. Browser migration remains future work. The current browser continues to load Apartment SVG files locally.

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
