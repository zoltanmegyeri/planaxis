# PlanAxis

**Structured apartment modeling, deterministic validation, interactive 3D visualization, and AI-assisted redesign.**

**PlanAxis** is a TypeScript-based toolkit and web application for validating, interpreting, visualizing, and eventually redesigning apartments described by a structured SVG floor-plan format.

The project is built around the versioned, normative [Apartment SVG 2.2 specification](docs/specifications/apartment-svg/2.2.md), where an SVG document is not merely a drawing: it is the canonical, machine-readable representation of an apartment's geometry and semantics.

PlanAxis has also adopted the versioned [PlanAxis Project Format 1.0 specification](docs/specifications/planaxis-project/1.0.md) as the top-level container for filesystem-backed renovation projects. The project manifest organizes architecture and project resources without replacing Apartment SVG as the source of architectural truth.

The versioned [PlanAxis Design Format 1.1 specification](docs/specifications/planaxis-design/1.1.md) is the latest accepted persistence contract for durable renderer-independent design scenarios bound to one Apartment SVG architecture. It preserves the Design 1.0 finish/presentation model and adds persistent idealized luminaires with renderer-independent placement, orientation, luminous output, white-light color temperature, dimming/state, and type-specific beam/dimension semantics. Design 1.0 remains a valid earlier schema. The `@planaxis/design`, server, and browser workflow support both versions. New scenarios use Design 1.1; edits preserve the existing schema and complete luminaire data without implicit migration.

The versioned [PlanAxis Material Format 1.1 specification](docs/specifications/planaxis-material/1.1.md) is the latest accepted persistent contract for project-local reusable PBR materials under `assets/materials/`. It preserves the Material 1.0 metallic/roughness model and adds an optional ambient-occlusion map plus `ambientOcclusionStrength`. The `@planaxis/material` package, browser material resolution, and Three.js renderer integration support both Material 1.0 and 1.1. Material 1.1 ambient occlusion uses the red channel as non-color data, an effective strength default of 1 when its map exists, and the existing physical texture mapping. Material 1.0 retains its earlier semantics and rejects the 1.1-only AO fields.

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
│   ├── material/
│   ├── simulation/
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
│   │   ├── planaxis-design/
│   │   └── planaxis-material/
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
From an installed workspace, start an existing conforming [PlanAxis project](#adopted-project-based-workflow)
with one command from the repository root:

```bash
pnpm start -- --project "/path/to/my-apartment"
```

This builds the server, browser application, and their workspace dependencies, then starts
one Fastify process. After it successfully listens, it prints:

```text
PlanAxis is running at http://127.0.0.1:3000/
```

Open that URL. Fastify serves the production browser build and the existing APIs from the
same origin; no Vite process is needed. Browser requests remain relative, with no CORS
configuration. Normal startup fails with a non-zero status if the browser entry document
or its referenced build assets are missing, empty, or inaccessible. Running `pnpm start`
rebuilds those artifacts before launch.

For optional frontend development with Vite HMR, start an API-only backend in one terminal:

```bash
pnpm --filter @planaxis/server... build
node apps/server/dist/index.js --project "/path/to/my-apartment" --api-only
```

Then run `pnpm dev:web` in another terminal and open the printed Vite URL. This builds the
shared browser dependencies and starts Vite, whose narrow proxy forwards the supported
project, architecture, design, and material API paths to `http://127.0.0.1:3000`.
API-only mode does not require or serve a production browser build.

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

The viewport-first workspace uses one compact, non-wrapping toolbar for **Design**, **2D / 3D**,
**Camera**, **Rendering**, **Full screen**, diagnostics status, and information/help. Lower-priority
status and information controls move into **More workspace controls** on narrower windows.
Project/document metadata is available through **Project information**. The viewport fills the
remaining space; secondary controls and diagnostics overlay it without changing its size.

The read-only 2D viewer displays the original SVG in a restricted image context, including
renderable drawings that fail validation. Drag to pan, scroll or pinch to zoom, and use the
compact **Fit / Reset** and zoom overlay. With the viewport focused, use arrows, `+` / `-`, and `0`.

For valid documents, choose **3D** to inspect walls, openings, fixed elements, and utility markers.
The **Camera** selector offers **Inspection**, **Walk**, and embedded SVG cameras. Inspection
starts at a 50 mm full-frame focal length, Walk at 16 mm, and embedded cameras use their defined
horizontal FOV. **Camera settings** exposes the supported 16/24/35/50/70/85 mm manual lenses and
Fill, 16:9, 3:2, 1:1, 2:3, and 9:16 aspect ratios. Selecting a camera/navigation mode restores its
default lens; manual lens changes and aspect changes preserve the current Walk pose.
Each page load starts in 2D; view switching does not refetch or reparse the SVG.
A browser needs WebGPU or WebGL2 for 3D.

**Full screen** uses the browser Fullscreen API for the 3D render area. Only the rendering and
one exit **×** remain visible. The button or native `Escape` exits, and browser-initiated changes
are tracked without rebuilding the renderer or resetting camera, Walk pose, framing, presentation,
or quality. Unavailable or rejected fullscreen requests leave the normal viewport usable.

Successful validation shows a compact **Ready** status. Actionable SVG, design, material,
resource/API, and renderer problems show a non-blocking notification with **View details** and
retain a warning/error status after dismissal. Details open in a temporary overlay drawer,
preserving structured error codes and their domains. Failures without usable source retain an
empty-state presentation. **Information and help** provides contextual navigation instructions.

Keyboard shortcuts are **2** (2D), **3** (3D), **W** (Walk in 3D), **I** (Inspection in 3D), and
**Escape** (close a panel, or native fullscreen exit). They ignore text-entry controls and
Ctrl/Meta/Alt combinations; active Walk retains its normal W movement handling.

**Walk** requires at least one embedded camera. It starts at the first camera's horizontal
position and heading, with a fixed eye height of 165 cm above the floor and a level gaze.
With the 3D canvas focused (click it to refocus), hold **WASD** or the **arrow keys** to move
and **left-drag** to look; both controls work together. Base speed is 1.5 m/s. Hold **Shift**
for twice the speed, or **Option** on macOS / **Space** on Windows and Linux for half speed.
Fast and slow together use normal speed. Movement stays horizontal and has no collisions:
you can pass through walls and move outside the apartment. Leaving the canvas or losing
focus clears held controls. Returning to Walk from another 3D camera mode restores the
Walk pose; reloading the page starts a new session. **Camera default** restores Walk's 16 mm lens; its pose survives camera-mode changes.

See [ADR-003](docs/decisions/ADR-003-three-renderer-architecture.md).

React is confined to `apps/web`; see [ADR-002](docs/decisions/ADR-002-react-browser-ui.md).

The Phase 1 surface foundation is implemented in `@planaxis/model-3d`. `ArchitecturalModel3D` retains validated spaces, and `deriveArchitecturalSurfaces` produces exact physical surface patches and stable finish addresses: `floor`, `ceiling`, both `wall:<id>:side-negative` / `side-positive` targets, and physically existing `wall:<wall-id>:opening:<opening-id>:reveal-start` / `reveal-end` / `reveal-top` / `reveal-bottom` targets. Wall union and opening boundaries are derived before renderer conversion. Space targets prefix the applicable floor, ceiling, or adjacent wall-side address with `space:<space-id>:` and explicitly fall back to the base target. They describe coverage without creating duplicate render surfaces. See [architectural surface derivation](docs/architecture/overview.md#58-architectural-surface-derivation).

The surface foundation also exposes exact physical mapping frames shared by base and space targets. The renderer generates UVs from centimeter distances divided by declared texture width/height, preserving scale and phase across patches and openings. Transient `RuntimePbrMaterial` assignments support base color, roughness, metalness, color/data/normal maps, ambient occlusion with effective strength, and ordinary opaque/masked/blended alpha. Space assignments fall back to their base target and then to the existing neutral appearance. Coverage is tessellated into non-overlapping material draw groups; source selection is preserved.

Call `buildApartmentScene(model, finishes)` or `renderer.setModel(model, finishes)` with `RuntimeFinishOptions`. Texture references are in-process symbols resolved to already loaded, borrowed Three.js textures. The adapter creates and disposes its own configured clones; callers retain ownership of source textures and decoded images. Finish assignment has no browser selection UI or persistence semantics. See the [runtime finish contract](docs/architecture/overview.md#59-renderer-adapter) for map conventions and an API example.

Window planes use physically based transmission with zero thickness and qualitative clear/frosted/tinted defaults. In the default **Studio** lighting mode, a built-in neutral room environment supplies image-based lighting (IBL) and reflections without network downloads or project assets. It replaces hemisphere ambient illumination; the deterministic directional key/shadow light remains. The neutral background stays separate from the lighting environment.

The **Rendering → Lighting** selector starts in **Studio**, preserving the neutral room
environment and fixed key light. **Physical** requires validated Apartment SVG
`metadata.location` with latitude, longitude, and `northHeading`; it is unavailable without
those fields. Physical uses a geographically oriented directional Sun and no room environment
or ambient fill. Its **Date** and **Time** sliders cover every day of the current session year
(including leap day) and every minute from 00:00 through 23:59. The full date and 24-hour time
are displayed. Edits use the SVG's declared time zone, or explicitly labeled UTC when absent.
Skipped DST times leave the simulation unchanged with an explanation; repeated times select
the earlier occurrence.

**Sunny** is the initial weather: clear blue sky, warm low Sun, neutral high Sun, and crisp
shadows. **Overcast** shows a cooler, low-contrast sky with very weak direct Sun and softer,
faint shadows. The procedural exterior transitions through sunset and twilight to near-black
night; direct Sun is zero at/below the geometric horizon. Visible sky is scenery, not realtime
GI. Four shadow-aware Physical sky sources now approximate diffuse daylight; interiors can
still remain dark. The native-WebGPU GI integration and its known limitations are
documented in the [GI evaluation](docs/architecture/realtime-global-illumination.md).

Selected Design 1.1 luminaires now illuminate the apartment in both Studio and Physical modes,
independently of date/time/weather. Author lights directly in the design JSON, then reload or
reselect the scenario. No design and Design 1.0 scenarios contribute no artificial lights.

| Design type | Rendering |
| --- | --- |
| `point` | Point light with architectural shadows |
| `spot` | Spot light with architectural shadows; full beam angle becomes half-angle |
| `linear` | One-sided rectangular area light, `lengthCm × 1 cm`, no shadows |
| `area` | One-sided rectangular area light, declared width/height, no shadows |

Enabled state and dimming scale luminous power; Kelvin controls approximate warm/cool white.
Point/spot shadows use existing quality resolution (minimum Low when Off), without a finite
light-range cutoff. Linear/area illumination can pass through walls because these emitters
intentionally have no shadows. There are no fixture meshes or luminaire markers. Placement,
editing and IES remain deferred. Native-WebGPU VXGI injects point/spot lighting; linear/area
lights retain direct rendering only. Nighttime Physical mode isolates artificial lighting.

The shared `@planaxis/simulation` package owns approximate solar position, daylight/weather
weights, and civil-time conversion independently of React and Three.js. The browser captures
one transient instant from `Date.now()` per loaded session, without advancing it automatically.
Date/time/weather and lighting mode stay in memory only. Physical → Studio → Physical restores
the previous simulation, including across 2D/3D switching; simulation edits preserve the scene,
camera, Walk pose, materials, tone mapping, and exposure. Studio keeps its neutral lighting.

Ceilings remain visually culled from above for Inspection but cast shadows from both sides;
walls continue to block sunlight except at actual openings. Window glass remains transmissive
and does not cast an opaque shadow. Physical always enables architectural shadowing (Low when
the retained Studio preference is Off), disables environment/fill controls, and restores those
Studio preferences on return.

The **Rendering** panel offers **Tone mapping** (AgX by default, ACES Filmic, or Neutral), **Exposure** (−4 to +4 EV in 0.1-stop increments), **Environment intensity** (0–4 in 0.1 increments), and **Environment rotation** (0–360° in 1° increments). Defaults are 0 EV, intensity 1, and rotation 0°. Exposure converts to the renderer multiplier as `2 ** EV`; positive environment yaw turns architectural +X toward +Y. Controls update the next frame immediately and remain disabled until initialization completes. Camera, Walk, lens, resize, and fullscreen changes preserve presentation selections for the viewport lifetime. Fullscreen hides every control except its exit button.

Final 3D output uses one Three.js **RenderPipeline** on both WebGPU and its automatic
WebGL2 fallback. Full-scene HDR bloom is added before the existing tone mapping and color
conversion. **Rendering** exposes **Bloom enabled**, **Bloom strength**, **Bloom radius**, and
**Bloom threshold**. Defaults are enabled, strength **0.05**, radius **0.1**, threshold **5**:
a high luminance threshold and low strength keep ordinary diffuse surfaces clear while intense
highlights soften. Bloom has no fixture geometry and supplies no illumination or GI.
Disabling it bypasses the bloom passes completely.

Explicit **Performance** selection recommends bloom Off; **Balanced** and **High** recommend On.
You can then override bloom without changing the quality preset, and individual quality edits
or display/DPR changes leave bloom alone. At startup, restored Performance starts Off and
Balanced/High/Custom start On. Bloom values are session-only, survive design, lighting, camera,
and 2D/3D switches, and never enter local storage or project/design files.

**Global illumination → On / Off** is a separate session control. Explicit Performance and
Balanced selection recommend Off; High recommends On on native WebGPU. Startup restores
High as On when supported and Performance/Balanced/Custom as Off. Manual GI changes leave
quality and bloom unchanged; later DPR edits retain GI. WebGL2 disables this control with an
explanation while keeping the existing rendering features. GI draws an immediate frame and
32 finite refinement frames, then returns idle. The renderer applies an indirect-only gain
of 8 for a clearly visible bounce contribution. TASK-043 is completed by human acceptance
with unresolved thin-partition leakage and hardware limits recorded in the linked evaluation.
Further VXGI work is set aside in favor of a separate path-tracing evaluation; the existing
integration is retained.

With **No design** selected, presentation controls remain transient. A resolved Design 1.0 or 1.1 scenario applies its saved tone mapping and exposure; edit these in the design editor rather than the Rendering panel. Environment intensity and rotation always remain transient. Resolved designs also apply Material 1.0 and 1.1 persistent finishes, including packed ORM textures shared across ambient-occlusion, roughness, and metalness roles. Design 1.1 luminaire validation and persistence are implemented. Luminaires survive name/presentation edits unchanged, and illuminate the scene in both lighting modes. Luminaire placement/editing UI, material-management UI, environment assets, IES, and path tracing remain deferred.

The same **Rendering** panel also offers **Quality**, **Pixel ratio**, **Shadows**, **Environment lighting**, and **Fill light**. Quality changes apply immediately without rebuilding the apartment or resetting navigation. Walk redraws are coalesced to display frames, and unchanged architectural shadows are reused during navigation. In Studio, all individual settings stay editable; changing a preset's settings selects **Custom**. Selecting a named preset reapplies every setting below:

| Preset | Pixel ratio | Shadows | Environment lighting | Fill light |
| --- | --- | --- | --- | --- |
| Performance | 1 | Off | Off | Medium |
| Balanced (default) | min(2, native DPR) | Medium | On | Off |
| High | native DPR | High | On | Off |

Pixel ratio choices include positive integers below the native display ratio, followed by the exact native ratio without duplication: native 2.5 offers 1, 2, and 2.5. Invalid native ratios fall back to 1. Buffer resolution changes independently of the CSS viewport size. Shadows use Off or Low/Medium/High PCF maps of 1024/2048/4096 pixels per side. Fill light uses neutral non-directional ambient illumination at Off/Low/Medium/High intensities of 0/0.5/1/2, preserving PBR materials and textures. Disabling environment lighting removes both IBL and environment reflections while preserving intensity/rotation and the neutral background.

Only these quality preferences are saved in browser-local storage; they never write to project, design, material, or Apartment SVG data. On later loads, named presets adapt to the current display; Custom DPR rounds down to an available option (or the smallest option if needed). Missing, malformed, or unsupported preferences use Balanced. Storage failure leaves rendering and session controls available. Display-ratio changes detected on browser resize also adapt the controls. Camera, design selection, aspect ratio, fullscreen, and transient presentation settings are not saved by this mechanism.

### Design scenarios

The **Design scenario** selector discovers descriptor paths under `designs/` without automatically selecting one. Every page load starts with **No design** and the manifest's active architecture. Selecting a descriptor loads its exact bound architecture, which may be a different alternative. Clearing the selection restores the active architecture. Selection is session state only and never writes the manifest or a descriptor.

Open **Create or edit a design** to create a scenario with a path such as `designs/warm.json` and a required name. It binds to the currently displayed architecture and initially saves only the required fields. Successful creation refreshes discovery and selects the new scenario. Existing scenarios support editing the name and optional tone-mapping/exposure overrides. Choose **PlanAxis default (no override)** or clear exposure to remove either override independently; removing both omits `presentation`. **Save design** preserves path identity, architecture binding, and all finish assignments. Failed writes retain the previously loaded durable state and report a controlled error.

Saved tone mapping maps `agx`, `aces-filmic`, and `neutral` to AgX, ACES Filmic, and Neutral. Omitted values use current PlanAxis defaults. Finite exposures outside the transient slider range are retained exactly; a value the renderer cannot represent produces a renderer failure rather than a format rejection.

Design Format problems, resource/API failures, Apartment SVG diagnostics, stale finish targets, and renderer failures remain distinct. An unresolved design is not applied; its readable architecture remains inspectable with default appearance. After successful design/architecture resolution, the browser loads each distinct material descriptor and texture through the controlled APIs. Material JSON validation, resource failures, unsupported/mismatched image content, decode failures, and renderer failures have separate safe diagnostics. Any material failure leaves all finishes neutral while preserving valid architecture and design presentation.

The dedicated `@planaxis/renderer-three` adapter provides WebGPU-first Three.js rendering with its supported WebGL2 fallback. It converts exact centimeters to meters only at the renderer boundary, mapping PlanAxis `(X, Y, Z)` to Three.js `(X, Z, Y)`. Valid documents support 2D/3D switching, orbit inspection, embedded-camera viewing, and free-walk navigation; invalid documents retain the 2D diagnostic workflow. Material Format 1.0 and 1.1 are integrated into project resource loading and rendering. Physical daylight, Design 1.1 luminaire persistence, and the native-WebGPU VXGI integration are implemented; luminaire placement/editing, and later AI-assisted features remain future work.

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
pnpm start -- --project "/path/to/my-apartment"
```

The required `--project <path>` accepts an absolute path or a path relative to the current working directory. Quote paths containing spaces; prefix a relative name beginning with `-` with `./`. Missing, duplicate, or unsupported arguments and invalid projects fail before listening with a non-zero process status. The server listens on `127.0.0.1:3000` and reports an occupied port clearly. Restart with another root to switch projects or reload the manifest selection.

The implemented endpoints are:

- `GET /health`: the existing `{ "status": "ok" }` response.
- `GET /api/project`: only `schema`, `name`, and `architecture.active` from the validated startup manifest; no physical root or filesystem internals.
- `GET /api/project/architecture`: the current bytes of the selected file, read through the project boundary on each request, with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`. Query parameters are rejected with HTTP 400. A resource that becomes unavailable or violates the filesystem boundary produces a controlled HTTP 500 error.

- `GET /api/project/designs`: `{ "designs": [...] }` with recursively discovered, lexicographically sorted lowercase `.json` regular files under `designs/`. Missing `designs/` returns an empty list; inaccessible files and symlinks are skipped. Discovery does not parse contents.
- `GET /api/project/design?path=designs/example.json`: unchanged descriptor bytes, including malformed or unsupported content, with the same octet-stream/nosniff headers.
- `POST /api/project/design?path=designs/example.json`: validate the JSON body as a [Design 1.0](docs/specifications/planaxis-design/1.0.md) or [Design 1.1](docs/specifications/planaxis-design/1.1.md) document, create ordinary missing parent directories, and return HTTP 201 with `{ "path": "designs/example.json" }`. Existing targets produce HTTP 409.
- `PUT /api/project/design?path=designs/example.json`: validate and replace an existing accessible regular descriptor, returning HTTP 204; missing targets produce HTTP 404.
- `GET /api/project/architecture-resource?path=architecture/variant.svg`: unchanged bytes of a specific lowercase `.svg` resource under `architecture/`, with octet-stream/nosniff headers, independently of the active selection.
- `GET /api/project/material?path=assets/materials/paint/material.json`: unchanged bytes of one explicitly requested lowercase `.json` file below `assets/materials/`, including malformed or unsupported descriptor contents, with octet-stream/nosniff headers.
- `GET /api/project/material-texture?path=assets/materials/shared/base-color.webp`: unchanged bytes of one explicitly requested lowercase `.png`, `.jpg`, `.jpeg`, or `.webp` file below that directory, including malformed or unsupported descriptor contents, with octet-stream/nosniff headers.

Resource selectors require exactly one `path` query parameter and reject unknown parameters. Design discovery accepts no query parameters. Writes serialize only the validated document as UTF-8 JSON with two-space indentation and one trailing newline. A complete synced staging file is published without overwriting on create, or atomically renamed on update; directory entries are synced where supported. Design errors return HTTP 400 with `{ "error": { "stage", "code", "location", "message" } }`. Selected-resource failures return 400 for invalid paths/types, 403 for inaccessible or prohibited resources, 404 for missing resources, or 409 for conflicts/changed resources. Unexpected infrastructure errors are logged server-side and return a generic safe HTTP 500. These APIs do not resolve architecture, finish targets, or material resources during writes.

Every material read re-enters the project-filesystem boundary for containment, regular-file, and symbolic-link checks. The server does not parse Material JSON or decode or inspect texture contents. Material Format parsing/validation belongs to `@planaxis/material`; the browser resolves descriptors and fetched texture bytes, and `@planaxis/renderer-three` owns image decoding, texture configuration, and GPU resources. No material discovery or write API is provided.

Apartment SVG contents are served unchanged even when invalid; parsing and validation remain downstream. The server exposes only these controlled resources, never the complete project root or `.planaxis/`, and adds no CORS integration. Static serving is limited to the built browser application under `apps/web/dist`, resolved relative to the server module rather than the project root or current working directory. Unknown paths return 404; there is no SPA fallback.

The browser uses the project, design, and both material APIs on the Fastify origin during normal operation. The optional two-process Vite HMR workflow uses the narrow development-only proxy described above. Server design persistence and browser scenario selection/editing are implemented. Phase 3 material loading and persistent rendering are implemented; richer redesign is deferred.

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

The [PlanAxis Design Format 1.1 specification](docs/specifications/planaxis-design/1.1.md) is the latest design contract. It preserves strict architecture binding, persistent finish assignments, material references, and optional presentation overrides from Design 1.0, and adds persistent renderer-independent `point`, `spot`, `linear`, and `area` luminaires. Design 1.0 remains a valid earlier schema. Fixture models, IES profiles, RGB lighting, and runtime daylight simulation state remain outside Design 1.1.

The [PlanAxis Material Format 1.1 specification](docs/specifications/planaxis-material/1.1.md) is the latest material contract and independently defines reusable project-local PBR material descriptors under `assets/materials/`. It standardizes base color, roughness, metalness, optional ambient occlusion and its strength, supported texture maps, physical repeat dimensions, PNG/JPEG/WebP texture resources, and alpha behavior without adding surface-assignment or renderer-specific state. Material Format 1.0 remains a valid earlier schema.

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

The parser, validator, CLI, and `ValidatedApartment2D` pipeline are aligned with Apartment SVG 2.2. Successful validation guarantees a simple, positive-area orthogonal footprint within the root `viewBox`, complete stationary geometry containment within its closed region, and level-local camera collision checks. Hinged-door open-leaf points may extend beyond the footprint but must remain within the `viewBox`. The trusted domain model exposes the canonical footprint separately from root bounds and includes the same footprint instance in its semantic ID index. Architectural Z values remain level-local, with `metadata.level.baseZ` retained separately for 3D construction. The geometry package now exposes `Point3D`, `VerticalRange`, `RectangularPrism3D`, and `HorizontalPolygonSurface3D`, with exact and tolerance-aware point equality and exact range-height derivation. `@planaxis/model-3d` now exports `buildArchitecturalModel3D(ValidatedApartment2D)`: it constructs floor and default ceiling surfaces, wall envelopes, window/door opening prisms, fixed-element volumes, utility positions, and exact camera definitions. It preserves architectural semantics and resolved relationships through constructed 3D instances and a source-semantic ID index. Model-space Z applies the level offset exactly once; X/Y remain unchanged. No slab thickness, physical door-leaf geometry, renderer tessellation, or renderer objects are inferred. The renderer adapter, browser inspection workflow, free-walk navigation, physical Sun, daylight controls, Sunny/Overcast weather, and procedural sky are implemented. Persistent material loading and rendering are implemented. Luminaire validation and persistence are implemented. Luminaire placement/editing, richer lighting, 3D asset placement, and AI-assisted features remain later stages.

PlanAxis Project Format 1.0 and ADR-004 define the implemented Phase 0 application foundation: a portable project directory, server-owned project filesystem boundary, one active project per server process, and controlled browser access to project resources. The loader, filesystem boundary, project-root startup selection, loopback binding, controlled resource APIs, and explicit design persistence are implemented. The browser automatically loads validated project metadata and the active SVG through those APIs while retaining browser-side Apartment SVG validation and the 2D/3D workflow.

PlanAxis Design Format 1.1 is the latest accepted normative persistence contract. It preserves the implemented Design 1.0 architecture-binding, finish-assignment, material-reference, and presentation semantics while adding persistent renderer-independent luminaire definitions. The current `@planaxis/design` package, server design APIs, and browser scenario workflow implement both Design 1.0 and 1.1: `parseDesignDescriptor(text, descriptorPath)` / `validateDesignDescriptor(value, descriptorPath)` provide structural validation, and `resolveDesignArchitecture(design, { path, finishTargets })` checks exact binding and stale finish targets. Design 1.1 luminaires are validated and persisted and adapted into renderer lights without geometric attachment checks. New scenarios use 1.1; editing existing scenarios preserves their declared schema, architecture, finishes, and luminaires. PlanAxis Material Format 1.0 and 1.1 validation is implemented in `@planaxis/material`; controlled raw material-resource reads, browser resolution, and persistent rendering complete Phase 3.

`@planaxis/material` exposes `parseMaterialDescriptor(text, descriptorPath)` and `validateMaterialDescriptor(value, descriptorPath)`. They return structured JSON/format failures or an immutable descriptor with exact project-relative `path` identity and a separate durable `document`. `getEffectiveMaterial(descriptor)` exposes normative defaults without modifying the document. The package has no runtime dependencies and performs no filesystem access, image decoding, or renderer adaptation. Both [Material Format 1.0](docs/specifications/planaxis-material/1.0.md) and [Material Format 1.1](docs/specifications/planaxis-material/1.1.md) are implemented. AO strength is valid only with an AO map, defaults effectively to 1 when omitted, and must be finite in [0, 1]. Without an AO map, no AO strength state is added.

Materials may be authored manually under `assets/materials/` and referenced from a design. Re-select the design (choose **No design**, then the scenario) to reread external edits. No catalog, material editor, file watching, or global cache is provided. Shared textures are fetched and decoded once per selected load, including packed map roles. Selection changes cancel obsolete requests and release prepared images, textures, and scene resources.

Phase 4 has implemented RenderPipeline/HDR bloom, physical daylight, persistent Design 1.1 luminaires, and native-WebGPU VXGI integration with finite convergence. TASK-043 is completed by human acceptance with unresolved leakage and large shadow-light limits; further VXGI work, including rectangular GI proxies, is set aside. Path tracing will be evaluated separately. Luminaire placement/editing, IES photometry, path tracing, and richer atmospheric effects remain future Phase 4 work. 3D asset importing and placement follow in Phase 5.

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
pnpm start -- --project <path-to-project>
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
