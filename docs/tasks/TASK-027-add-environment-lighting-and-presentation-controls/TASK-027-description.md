# TASK-027: Add Environment Lighting and Presentation Controls

## Context

TASK-025 established exact renderer-independent designable architectural surfaces and finish-target identities.

TASK-026 added physical texture mapping, transient runtime PBR finish assignment, physically scaled UV generation, and transmissive glass.

The renderer still uses a flat background plus fixed hemisphere and directional lights, and the browser exposes no controls for environment lighting, exposure, or tone mapping. This limits the usefulness of the new PBR material and glass capabilities.

The final Phase 1 task is to add a deliberate runtime presentation layer for deterministic environment lighting and core renderer presentation controls without introducing persistent presentation assets or design-scenario state.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Add runtime image-based/environment lighting and a small presentation-control contract to the Three.js renderer.

Expose transient browser controls for environment intensity, environment rotation, tone mapping, and exposure while preserving the existing renderer architecture and keeping presentation state out of Apartment SVG, project persistence, and `ArchitecturalModel3D`.

## Scope

The task includes:

- adding renderer-level runtime presentation settings;
- introducing a built-in neutral studio/room-style environment suitable for PBR lighting and reflections;
- applying that environment to scene lighting without requiring project assets;
- removing the existing hemisphere ambient light when the environment-lighting path is active;
- retaining the existing directional light as a deterministic key/shadow light;
- supporting environment intensity;
- supporting environment yaw rotation around the architectural vertical axis;
- supporting a deliberate small tone-mapping vocabulary;
- supporting exposure as user-facing EV stops;
- converting EV exposure to the renderer's exposure multiplier;
- exposing browser controls for environment intensity, environment rotation, tone mapping, and exposure;
- applying control changes immediately without rebuilding architectural/domain models;
- preserving presentation settings across camera/orbit/walk changes for the lifetime of the viewport;
- keeping the existing neutral scene background separate from environment lighting;
- ensuring renderer resource ownership/disposal is correct;
- adding focused automated tests for renderer settings and browser controls;
- updating current-state documentation.

## Out of Scope

This task does **not** include:

- persistent HDRI/environment assets;
- project-relative environment paths;
- `planaxis-environment/*` or any environment asset specification;
- presentation presets persisted to project files;
- design-scenario persistence;
- Apartment SVG presentation attributes;
- custom background images or visible environment backgrounds;
- browser file selection for HDR/EXR images;
- lighting-design objects or editable architectural light fixtures;
- moving/resizing/recoloring the retained directional key light through the browser;
- bloom, SSAO, SSGI, depth of field, vignette, LUT/color grading, or other post-processing;
- replacing the renderer with a post-processing graph;
- photorealistic final-render export;
- server/project APIs for presentation assets;
- material-asset persistence.

Do not turn transient presentation controls into a persistence format.

## Functional and Architectural Requirements

### Runtime presentation contract

Introduce a renderer-owned presentation contract conceptually equivalent to:

```text
RendererPresentationSettings
```

It must contain only renderer/presentation state and must not become part of `ArchitecturalModel3D`.

The contract must support at least:

```text
environmentIntensity
environmentRotationDegrees
toneMapping
exposureEv
```

Exact names may follow repository conventions.

The renderer must expose a deliberate API for applying updated presentation settings without requiring the architectural model to be rebuilt.

Presentation settings must remain transient runtime state.

### Built-in environment lighting

Provide a built-in neutral procedural/studio/room-style environment that works without project assets or network access.

Use it for PBR environment lighting/reflections.

Requirements:

- initialize it deterministically;
- assign it to the scene/environment-lighting path;
- do not show it as the scene background;
- preserve the existing neutral background color unless current implementation constraints require an equivalent neutral replacement;
- reuse/dispose generated environment resources correctly;
- avoid network-loaded HDR/EXR dependencies.

The environment is a renderer capability, not an architectural or project-domain object.

### Ambient/key-light relationship

When built-in environment lighting is active:

- remove the existing `HemisphereLight` ambient contribution;
- retain the existing `DirectionalLight` as a deterministic key light and shadow source;
- preserve the existing directional-light positioning relative to the loaded apartment and the current shadow-framing behavior unless a small adjustment is required for correct coexistence with IBL.

Do not expose directional-light design controls in this task.


### Environment intensity

Support a finite non-negative environment intensity.

Default:

```text
1.0
```

The value must scale environment lighting/reflection contribution through the supported Three.js/WebGPU scene/environment mechanism.

The browser must expose a practical bounded control range suitable for interactive use. Choose a deterministic UI range and step size; do not couple the public renderer contract to HTML-control limitations.

### Environment rotation

Support yaw rotation around the architectural/model vertical axis.

Default:

```text
0 degrees
```

The browser control may normalize/wrap values for usability, but the renderer API must define deterministic behavior.

The rotation must affect environment lighting/reflections, not rotate architectural geometry or the camera.

Do not expose pitch/roll environment rotation in this task.

### Tone mapping

Expose only this deliberate PlanAxis vocabulary:

```text
AgX
ACES Filmic
Neutral
```

Use AgX as the default.

Do not expose every Three.js tone-mapping constant or leak raw Three.js enums through the public browser-facing API.

Map the PlanAxis vocabulary internally to supported Three.js/WebGPU renderer behavior.

Tone-mapping changes must take effect without recreating the apartment scene.

### Exposure

Expose exposure to users in EV stops.

Default:

```text
0 EV
```

Convert EV to the renderer exposure multiplier using:

```text
exposureMultiplier = 2 ^ exposureEv
```

Use a practical bounded browser range with deterministic step size.

The renderer contract should remain numeric and presentation-focused; do not persist exposure in the project.

Changing exposure must affect the next render immediately.

### Renderer lifecycle

The presentation system must work with the existing event-driven renderer lifecycle.

Changing presentation settings must request/render a new frame without creating a permanent render loop.

Presentation settings must survive:

- inspection/orbit camera changes;
- embedded-camera selection;
- free-walk activation/deactivation;
- focal-length changes;
- resize/aspect-ratio changes.

Replacing the architectural model must not silently reset user-selected presentation settings unless the renderer instance itself is recreated.

Disposal must release environment-generation resources, environment textures/render targets, and any new renderer-owned resources introduced by this task.

### Browser controls

Add transient 3D presentation controls to the existing Three.js toolbar.

Expose:

- tone mapping;
- exposure;
- environment intensity;
- environment rotation.

Requirements:

- controls are disabled until the renderer is ready, consistent with existing camera controls;
- changes apply immediately;
- state is owned by the React 3D viewport/browser layer and passed through the renderer API;
- the controls remain hidden in the existing focus-view mode if the rest of the toolbar is hidden there;
- no persistence, local storage, project writes, or server calls are introduced;
- existing camera, focal-length, and aspect-ratio controls continue to work.

Use accessible labels and preserve existing toolbar behavior.

### Defaults and compatibility

Opening an existing valid project must continue to work without any new project files or resources.

Default presentation should be deterministic and visually suitable for the TASK-026 PBR materials and glass.

Existing neutral/runtime finishes, source selection, shadows, cameras, orbit, free walk, focal-length override, resize behavior, and event-driven rendering must remain compatible.

No changes to Apartment SVG validation or project loading are expected.

## Expected Areas

Expected changes are primarily under:

```text
packages/renderer-three/src/
packages/renderer-three/test/
apps/web/src/
apps/web/test/
README.md
docs/architecture/overview.md
```

`@planaxis/model-3d`, server code, project-format code, and Apartment SVG specification should not change unless required for a narrowly justified compile/test adaptation.

## Testing Requirements

Add focused automated coverage for at least:

- default presentation settings;
- AgX, ACES Filmic, and Neutral tone-mapping mappings;
- EV-to-exposure conversion;
- validation/handling of invalid presentation-setting values;
- default environment intensity and environment rotation;
- environment intensity updates;
- environment yaw rotation updates;
- neutral scene background remaining independent from environment lighting;
- hemisphere ambient light no longer contributing when the environment path is active;
- directional key/shadow light remaining present;
- settings changes triggering event-driven rendering without a persistent loop;
- settings surviving camera changes, walk mode, resize, and model replacement on the same renderer instance;
- environment/resource disposal;
- browser controls rendering with accessible labels;
- browser controls disabled before renderer readiness;
- browser control changes calling the renderer with the expected values;
- existing camera/focal-length/aspect-ratio behavior remaining protected by the current test suite.

Routine tests must not require external network resources or HDR/EXR downloads.

## Documentation Requirements

Update current-state documentation so it describes:

- built-in environment/IBL support;
- retained deterministic directional shadow light;
- AgX default tone mapping with ACES Filmic and Neutral alternatives;
- EV-based exposure;
- environment intensity and yaw rotation;
- transient browser presentation controls;
- the neutral background remaining separate from environment lighting;
- persistent environment assets, presentation persistence, lighting design, and post-processing as future work.

Do not describe runtime presentation state as project or design-scenario persistence.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused `renderer-three` and browser tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. the renderer provides deterministic built-in environment lighting suitable for TASK-026 PBR materials and glass without requiring project assets or network access;
2. the old hemisphere ambient light is removed from the active environment-lighting setup while the directional key/shadow light remains;
3. runtime presentation settings support environment intensity, environment yaw rotation, tone mapping, and EV-based exposure;
4. tone mapping exposes only AgX, ACES Filmic, and Neutral, with AgX as default;
5. exposure uses `2 ^ EV` conversion and applies immediately;
6. the neutral scene background remains independent from the environment used for lighting/reflections;
7. presentation settings remain transient, survive normal camera/view changes and model replacement within one renderer instance, and do not enter `ArchitecturalModel3D`, Apartment SVG, or project persistence;
8. the browser exposes accessible transient controls for all four presentation settings;
9. the renderer remains event-driven and correctly owns/disposes environment resources;
10. no persistent environment asset format, lighting-design system, background-image workflow, or post-processing stack is introduced;
11. focused automated tests and repository-level verification pass;
12. documentation accurately reflects the completed Phase 1 presentation foundation and deferred work.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands and results;
5. deviations from this description, or `None`;
6. follow-up items, or `None`;
7. a suggested Conventional Commits message including:

```text
Task: TASK-027
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
