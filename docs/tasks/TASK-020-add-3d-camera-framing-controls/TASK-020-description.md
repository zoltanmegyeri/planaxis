# TASK-020: Add 3D Camera Framing Controls

## Context

PlanAxis now provides an interactive 3D apartment view with an inspection/orbit camera, selectable Apartment SVG cameras, and a browser-area Focus view.

The current renderer uses each embedded camera's source horizontal field of view and lets the 3D canvas fill all available space. Users need more deliberate photographic framing through familiar full-frame focal lengths and fixed image aspect ratios.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Extend the existing 3D camera toolbar with independent focal-length and render-aspect-ratio controls.

The focal-length control must provide full-frame photographic presets for both the inspection/orbit camera and embedded Apartment SVG cameras. The aspect-ratio control must either fill the available area or constrain the rendered 3D image to a centered predefined ratio.

## Scope

The task includes:

- adding a focal-length selector to the 3D toolbar;
- adding a render aspect-ratio selector to the 3D toolbar;
- supporting full-frame focal-length presets of 16 mm, 24 mm, 35 mm, 50 mm, 70 mm, and 85 mm;
- preserving each camera's existing projection through a `Camera default` lens option;
- supporting `Fill`, `16:9`, `3:2`, `1:1`, `2:3`, and `9:16` render aspect ratios;
- applying focal-length overrides through renderer-owned perspective math;
- sizing fixed-ratio 3D rendering surfaces in the browser layer;
- preserving framing selections across camera changes, resize, and Focus view transitions;
- adding focused renderer and browser tests;
- updating current-state documentation.

## Out of Scope

This task does **not** include:

- aspect-ratio controls for the 2D viewer;
- arbitrary/custom focal lengths or aspect ratios;
- changing Apartment SVG camera semantics or stored `horizontalFov` values;
- changing `ArchitecturalModel3D` to store runtime framing choices;
- camera sensor formats other than 36 mm-wide full frame;
- depth of field, aperture, exposure, shutter speed, ISO, distortion, or other physical-camera effects;
- dolly movement or automatic camera repositioning when focal length changes;
- image export, Photo Mode, or AI rendering;
- native browser fullscreen behavior.

## Functional Requirements

### Camera, lens, and aspect-ratio controls

The 3D toolbar must expose three independent controls:

1. the existing camera selector;
2. a focal-length selector;
3. a render aspect-ratio selector.

Changing any one control must not change the selected value of either of the other two controls.

This independence applies to both inspection/orbit and embedded cameras. When the lens selector is `Camera default`, changing cameras may naturally change the effective projection because each camera keeps its own default projection, but the selected lens option itself must remain `Camera default`.

### Focal-length presets

The focal-length selector must provide:

```text
Camera default
16 mm
24 mm
35 mm
50 mm
70 mm
85 mm
```

`Camera default` must be selected initially.

For an embedded Apartment SVG camera, `Camera default` must use that camera's existing source `horizontalFov`.

For the inspection/orbit camera, `Camera default` must preserve the renderer's existing inspection projection behavior.

Selecting one of the numeric presets must override the current camera's perspective using a 36 mm-wide full-frame sensor:

```text
horizontalFov = 2 * atan(36 / (2 * focalLengthMm))
```

Convert the result to degrees and derive the renderer's vertical FOV from the actual render-surface aspect ratio using the existing horizontal-to-vertical FOV convention.

A focal-length override changes perspective only. It must not change camera position, heading, pitch, orbit target, or inspection distance.

The selected focal-length option must survive:

- camera changes;
- render-surface resize;
- entering and leaving Focus view.

### Render aspect ratios

The aspect-ratio selector must provide:

```text
Fill
16:9
3:2
1:1
2:3
9:16
```

`Fill` must be selected initially and preserve the current behavior: the 3D render surface uses all available 3D viewport space.

For a fixed ratio, the rendered 3D surface must:

- use the largest rectangle of the selected ratio that fits inside the available 3D viewport area;
- remain centered horizontally and vertically;
- leave unused surrounding space as application background;
- never stretch or crop the rendered image merely to satisfy the selected ratio.

The browser layer must size the actual render surface to the selected ratio so the renderer receives its real width and height through normal resize handling.

The selected aspect ratio must survive:

- camera changes;
- focal-length changes;
- entering and leaving Focus view.

While Focus view is active, a fixed-ratio render must remain at that ratio and expand only to the largest matching rectangle that fits inside the browser client area.

### Projection state and resizing

Renderer projection state must distinguish the selected camera from any focal-length override.

Camera selection and resize must reapply the effective projection without discarding the current focal-length selection.

For embedded cameras, resizing with `Camera default` must continue to derive vertical FOV from the camera's source horizontal FOV. With a numeric focal-length override, resizing must derive vertical FOV from the preset's full-frame horizontal FOV instead.

Aspect-ratio changes must use the same ordinary renderer resize path and must not require a renderer-specific aspect-ratio API.

## Technical and Architectural Constraints

- Keep toolbar and aspect-ratio layout state in `apps/web`.
- Keep focal-length-to-FOV conversion and effective camera projection in `@planaxis/renderer-three`.
- Preserve the ownership boundaries documented by ADR-002 and ADR-003.
- Treat focal length and aspect ratio as runtime UI/renderer state, not Apartment SVG or domain-model facts.
- Preserve existing embedded camera position/orientation behavior and source `horizontalFov`.
- Reuse or extend the existing horizontal-to-vertical FOV logic rather than duplicating inconsistent projection math.
- Do not add an external dependency; none is expected.
- Do not modify any file under `docs/tasks/`.

Exact internal API names may be refined, but the renderer must expose a clear way to apply and clear a focal-length override independently of camera selection.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/web/src/
apps/web/test/
packages/renderer-three/src/
packages/renderer-three/test/
README.md
```

No Apartment SVG parser, validator, or domain-model changes are expected.

## Testing Requirements

Add focused automated coverage for:

- full-frame focal-length-to-horizontal-FOV conversion;
- correct projection for every supported focal-length preset;
- `Camera default` behavior for inspection and embedded cameras;
- focal-length overrides surviving camera changes and resize;
- resetting from a numeric preset to `Camera default`;
- all supported aspect-ratio options and `Fill`;
- fixed-ratio render surfaces remaining centered and correctly constrained;
- camera, focal-length, and aspect-ratio selections remaining independent;
- focal-length and aspect-ratio state surviving Focus view transitions;
- existing 3D camera selection and renderer behavior remaining compatible.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Documentation Requirements

Update `README.md` so the documented 3D browser behavior includes the new camera framing controls.

Do not modify Apartment SVG 2.2 semantics.

Do not create or modify an ADR unless implementation reveals an architectural decision not already covered by ADR-002 or ADR-003.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused `apps/web` and `@planaxis/renderer-three` tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. the 3D toolbar exposes independent camera, focal-length, and aspect-ratio selectors;
2. the focal-length selector provides `Camera default` plus 16, 24, 35, 50, 70, and 85 mm full-frame presets;
3. numeric presets use a 36 mm-wide full-frame sensor and affect perspective without moving the camera;
4. `Camera default` preserves the existing projection behavior of the selected camera;
5. the aspect-ratio selector provides `Fill`, `16:9`, `3:2`, `1:1`, `2:3`, and `9:16`;
6. fixed-ratio renders are centered, maximized within the available area, and neither stretched nor cropped;
7. changing camera, focal length, or aspect ratio does not reset either of the other two selections;
8. focal-length and aspect-ratio selections survive resize and Focus view transitions;
9. focused tests and full repository verification pass;
10. current-state documentation reflects the new 3D framing controls.

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
Task: TASK-020
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
