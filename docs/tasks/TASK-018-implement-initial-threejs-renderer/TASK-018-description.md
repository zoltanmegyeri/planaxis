# TASK-018: Implement the Initial Three.js Renderer and 3D Apartment View

## Context

TASK-016 introduced exact renderer-independent `ArchitecturalModel3D`. TASK-017 then established the React browser application, which loads and validates Apartment SVG 2.2 locally and retains `ValidatedApartment2D` for valid documents.

The next architectural stage is renderer adaptation and the first interactive 3D apartment view.

This task must keep Three.js and floating-point renderer concerns outside the authoritative domain/model packages. The browser application owns UI state and mounts the renderer; a dedicated renderer package consumes `ArchitecturalModel3D` and owns Three.js scene construction and lifecycle.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/decisions/ADR-002-react-browser-ui.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Implement the first Three.js rendering stage and expose it through the existing browser application.

For a valid Apartment SVG, the user must be able to switch from the existing 2D view to a 3D view that renders the apartment from `ArchitecturalModel3D`, inspect it with an orbit-style camera, and switch to any embedded Apartment SVG camera.

Invalid documents must remain limited to the existing 2D diagnostic workflow.

## Scope

The task includes:

- creating a dedicated `@planaxis/renderer-three` workspace package;
- adopting Three.js using the repository dependency-selection policy;
- using `WebGPURenderer` as the primary renderer with its supported WebGL2 fallback;
- documenting the renderer architecture in `docs/decisions/ADR-003-three-renderer-architecture.md`;
- converting exact PlanAxis geometry to renderer-space floating-point values only at the renderer boundary;
- constructing Three.js geometry for floor, ceiling, walls, wall openings, doors/windows where representable, fixed elements, and useful utility markers;
- using neutral non-authoritative PBR visualization materials;
- providing basic scene lighting and shadows sufficient for readable 3D inspection;
- adding an orbit-style inspection camera and support for embedded Apartment SVG cameras;
- adding a 2D/3D switch to the browser application for valid documents;
- handling renderer creation, resize, model replacement, rendering, and disposal;
- adding focused renderer and browser integration tests;
- updating current-state documentation.

## Architectural Requirements

### Dedicated renderer package

Create:

```text
packages/renderer-three/
```

The package must depend on `@planaxis/model-3d` and Three.js and must remain independent of React.

`apps/web` may:

- construct `ArchitecturalModel3D` from valid `ValidatedApartment2D`;
- choose 2D or 3D view;
- choose the active 3D camera;
- mount, resize, and dispose the renderer.

`apps/web` must not directly construct apartment meshes or contain renderer-specific geometry policy.

Three.js objects, renderer-space `number` values, materials, cameras, GPU resources, and scene-graph objects must not leak into `@planaxis/model`, `@planaxis/model-3d`, validator, parser, or geometry packages.

### ADR-003

Create:

```text
docs/decisions/ADR-003-three-renderer-architecture.md
```

Document at least:

- direct Three.js usage rather than React Three Fiber;
- the dedicated `@planaxis/renderer-three` boundary;
- WebGPU-first rendering with supported WebGL2 fallback;
- renderer-space units and coordinate conversion;
- the exact-to-floating-point boundary;
- ownership of mesh construction and renderer lifecycle.

Do not rewrite ADR-001 or ADR-002 retroactively.

### Three.js dependency

Inspect current registry metadata at execution time and select the newest stable, non-deprecated Three.js release compatible with the repository and implementation.

Pin the selected version according to repository dependency policy. Do not use a prerelease merely to obtain a newer revision.

Do not add a generic CSG/boolean geometry dependency unless a concrete requirement makes deterministic renderer-side construction impractical and the addition is explicitly justified.

## Renderer Coordinate and Unit Boundary

`ArchitecturalModel3D` remains authoritative and exact in centimeters.

At the renderer boundary:

```text
100 PlanAxis centimeters = 1 Three.js world unit
```

Use one centralized conversion policy equivalent to:

```text
PlanAxis X  -> Three X
PlanAxis Y  -> Three Z
PlanAxis Z  -> Three Y
```

with centimeter-to-meter scaling.

This conversion changes coordinate-system handedness to preserve the SVG’s visual layout: +X points right, +Y points down in the floor plan, and architectural +Z points upward. Apply it consistently to geometry and camera positions/orientations. Adjust triangle winding and normals so floor surfaces face upward and ceiling surfaces face downward.

Convert `Decimal` values to JavaScript `number` only inside the renderer adapter or another explicitly renderer-owned boundary. Renderer-derived values must never flow back into authoritative domain state.

## Architectural Scene Construction

### Floor and ceiling

Render the `ArchitecturalModel3D.floor` and `.ceiling` polygon surfaces as planar meshes.

Triangulation is renderer-owned and must preserve the trusted polygon geometry.

Use sensible front/back-face behavior so the apartment remains inspectable from useful viewpoints without inventing architectural thickness.

### Walls and openings

`ArchitecturalModel3D` provides complete wall volumes and separate rectangular opening prisms for windows and doors.

Render wall solids with the openings actually removed visually.

Prefer deterministic construction from the validated axis-aligned wall/opening geometry rather than generic floating-point CSG. The implementation must support all valid multi-opening wall cases permitted by the current model/specification and must not assume one opening per wall.

Do not push tessellation, mesh partitioning, or boolean-result geometry into `@planaxis/model-3d`.

### Windows and doors

Represent source window/door semantics only where supported by existing trusted geometry.

At minimum:

- window openings must remain open through the wall;
- windows should have a simple transparent glass representation when it can be derived without inventing unspecified dimensions;
- opening-only doors remain openings;
- hinged/sliding door leaf geometry may be rendered when existing source/model geometry defines it sufficiently.

Do not invent frame thicknesses, decorative trims, hardware, or other architectural facts absent from the source model.

### Fixed elements and utilities

Render fixed-element volumes, including radiators and other fixed objects, using their trusted `ArchitecturalModel3D` geometry.

Ceiling lights and other utilities may use simple neutral markers where useful for scene comprehension. Do not interpret them as active photometric lights in this task.

Preserve a practical mapping between source element IDs and renderer scene objects/groups so later interaction can build on it.

## Visualization Materials, Lighting, and Shadows

Use neutral physically based visualization defaults, primarily through Three.js standard/physical material facilities.

These colors/materials are renderer defaults only and must not be represented as Apartment SVG or architectural truth.

Provide enough non-semantic scene illumination for the apartment to be readable in 3D, for example neutral environment/ambient contribution plus a directional source.

Enable sensible cast/receive shadows for appropriate architectural objects.

Do not implement:

- user-selectable finishes;
- texture/material libraries;
- HDR environment selection UI;
- physically modeled Apartment SVG luminaires;
- dimmers;
- date/time sunlight;
- GI/SSGI;
- advanced reflection or post-processing pipelines.

Those remain later stages.

## Browser 3D Experience

### Valid-document model construction

Extend the valid browser document pipeline so `ValidatedApartment2D` is used to construct `ArchitecturalModel3D` through the public `@planaxis/model-3d` API.

Retain the trusted 2D model as needed; do not rebuild 3D from raw SVG or parsed intermediate data.

Unexpected `ArchitecturalModel3D` construction or renderer failures must produce an application-level failure state rather than silently falling back to incorrect geometry.

### 2D / 3D switch

For valid documents, provide an obvious workspace control conceptually equivalent to:

```text
[ 2D ] [ 3D ]
```

A newly loaded document should start in 2D.

For invalid documents, 3D must be unavailable because no trusted architectural model exists. The existing invalid-SVG 2D preview and diagnostics must continue to work.

Switching views must not require reloading or reparsing the SVG.

### Inspection camera

Provide a general-purpose orbit-style inspection camera so every valid apartment can be inspected even if the SVG defines no camera.

Support practical desktop interaction for orbit, pan, and dolly/zoom. Provide reasonable touch equivalents where straightforward.

Choose initial framing from the model bounds so the apartment is visible without manual setup.

This inspection camera is not free-walk navigation and requires no collision system.

### Embedded Apartment SVG cameras

Expose the cameras from `ArchitecturalModel3D.cameras` in the 3D UI.

Selecting one must position/orient the Three.js camera from the trusted source camera values.

Apartment SVG stores horizontal FOV while Three.js `PerspectiveCamera.fov` is vertical FOV. Derive the correct vertical FOV from horizontal FOV and the current viewport aspect ratio and recompute it when the viewport size changes.

Provide a clear way to return from an embedded camera to the orbit inspection camera.

Do not modify authoritative camera values from renderer navigation.

## Renderer Lifecycle

The renderer package must expose a deliberate lifecycle suitable for React integration, covering the equivalent of:

```text
create / initialize
set or replace model
resize
select/update camera
render
dispose
```

Exact API names may be refined.

Handle device-pixel ratio sensibly without allowing unbounded render resolution to create avoidable GPU load.

On model replacement or renderer disposal, release owned Three.js/GPU resources, including geometries, materials, textures/render targets if introduced, animation loops, observers/listeners, and renderer resources.

Do not leave a persistent render loop running when the 3D view is unmounted or inactive.

## Out of Scope

This task does **not** include:

- free-walk/FPS navigation;
- pointer-lock walking controls;
- collision detection or player physics;
- doors/windows animation;
- date/time or geographic sun simulation;
- Apartment SVG lamp switching or dimmers;
- photometric/IES luminaire simulation;
- texture/material catalogs or design-state modeling;
- furniture/product libraries or glTF content;
- advanced GI, SSGI, reflections, SSAO/contact-shadow systems, or post-processing;
- quality presets or Photo Mode;
- 3D editing, selection, measurement, or semantic highlighting;
- persistence, server rendering, or AI-assisted rendering;
- React Three Fiber.

Do not add these adjacent capabilities merely because Three.js makes them convenient.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/renderer-three/
apps/web/
package.json
pnpm-lock.yaml
README.md
AGENTS.md
docs/architecture/overview.md
docs/decisions/ADR-003-three-renderer-architecture.md
```

Workspace configuration or shared tooling files may change when required for the new package and tests.

## Testing Requirements

Add focused tests for renderer adaptation without requiring a real GPU whenever possible.

Cover at least:

- centimeter-to-meter conversion;
- PlanAxis-to-Three coordinate conversion, correct surface orientation, and absence of mirroring, verified using an asymmetric layout and a camera with a known viewing direction;
- wall dimensions and placement;
- wall opening construction, including multiple openings on one wall;
- floor/ceiling mesh geometry;
- fixed-element placement;
- source-ID-to-scene-object mapping;
- embedded camera position/orientation conversion;
- horizontal-to-vertical FOV conversion for representative aspect ratios;
- viewport resize behavior;
- deterministic scene construction from the same `ArchitecturalModel3D`;
- renderer/model resource disposal behavior at testable boundaries.

Add browser application coverage for:

- valid document enabling 3D;
- invalid document keeping 3D unavailable;
- 2D/3D switching without reparsing/reloading;
- embedded camera choices appearing for valid models;
- returning to inspection/orbit mode;
- renderer cleanup when changing documents or leaving 3D.

Tests must not depend on pixel-perfect screenshots, an external server, or a physical GPU unless an existing repository requirement makes that unavoidable.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Documentation Requirements

Update current-state wording in:

```text
README.md
AGENTS.md
docs/architecture/overview.md
```

so the repository describes:

- `@planaxis/renderer-three` as the Three.js renderer adapter;
- the renderer unit/coordinate boundary;
- WebGPU-first rendering with supported WebGL2 fallback;
- the browser 2D/3D workflow;
- inspection/orbit and embedded-camera viewing;
- free-walk navigation and advanced lighting/material work as future stages.

Do not modify Apartment SVG 2.2 semantics.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused renderer/web tests during development as useful.

Verify manually through:

```bash
pnpm dev:web
```

with at least one valid Apartment SVG containing walls, door/window openings, fixed elements, and an embedded camera.

Confirm that 2D remains functional, 3D renders correctly, embedded camera selection works, and returning/replacing the document does not leave stale renderer state.

Do not leave the development server running after verification.

If dependency manifests or the lockfile change, perform the dependency verification required by repository policy, including current registry checks and frozen-lockfile installation verification.

## Acceptance Criteria

The task is complete when:

1. `@planaxis/renderer-three` exists as the dedicated non-React Three.js renderer boundary;
2. Three.js is added using the newest suitable stable release selected under repository policy;
3. ADR-003 documents the renderer architecture and exact renderer boundary;
4. valid `ValidatedApartment2D` is converted through `@planaxis/model-3d` to `ArchitecturalModel3D` before rendering;
5. renderer-space conversion uses 1 unit = 1 meter and maps PlanAxis `(X, Y, Z)` to Three.js `(X, Z, Y)`, preserving the SVG floor-plan layout without mirroring;
6. floor, ceiling, walls with real door/window openings, fixed elements, and supported window/door representations are visible in the 3D scene;
7. neutral PBR visualization materials, basic lighting, and sensible shadows provide a readable scene without becoming authoritative design data;
8. valid documents expose working 2D/3D switching while invalid documents remain 2D-only;
9. orbit-style inspection works and all embedded Apartment SVG cameras can be selected with correct orientation/FOV behavior;
10. renderer resize, replacement, and disposal do not leave stale scene/GPU resources;
11. free-walk, advanced lighting/materials, editing, persistence, and AI features remain out of scope;
12. focused tests and repository verification pass.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. dependencies added or changed and the stable versions selected;
4. renderer architecture and geometry approach used;
5. tests added or updated;
6. verification commands and results;
7. deviations from this description, or `None`;
8. follow-up items, or `None`;
9. a suggested Conventional Commits message including:

```text
Task: TASK-018
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
