# TASK-035: Add Configurable 3D Rendering Quality

## Context

PlanAxis now supports persistent PBR materials, ambient occlusion, built-in environment lighting, shadows, and transient presentation controls. On high-DPI displays, especially in full-window Walk usage, rendering at native device pixel ratio can be unnecessarily expensive.

Before the browser UI is redesigned in the following task, PlanAxis needs a coherent runtime rendering-quality layer that lets users trade visual quality for interactive performance without changing project or design data.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
```

Inspect the existing presentation, shadow, environment-lighting, renderer lifecycle, and browser 3D-control implementation under:

```text
packages/renderer-three/
apps/web/
```

Do not read any other file under `docs/tasks/`.

## Goal

Add configurable, immediately applied 3D rendering-quality settings for device pixel ratio, shadows, environment lighting, and non-directional fill lighting, together with Performance/Balanced/High presets and browser-local persistence.

Preserve the existing PBR material model and keep rendering-quality preferences separate from project, design, architecture, and persistent presentation data.

## Scope

The task includes:

- adding a renderer-owned runtime quality/settings contract;
- supporting selectable device pixel ratio values derived from the browser's native `devicePixelRatio`;
- supporting shadow quality levels;
- allowing built-in environment lighting to be enabled or disabled;
- adding configurable fill light that preserves the existing PBR materials;
- adding `Performance`, `Balanced`, `High`, and `Custom` quality states;
- applying preset-controlled settings deterministically and switching to `Custom` after manual changes;
- applying setting changes immediately without rebuilding architectural/domain models;
- persisting rendering-quality preferences locally in the browser and restoring them on later page loads;
- exposing functional browser controls for the new settings without performing the planned overall application-shell redesign;
- preserving existing tone mapping, exposure, environment intensity, and environment rotation behavior;
- adding focused renderer/browser tests and updating current-state documentation.

## Out of Scope

This task does **not** include:

- the viewport-first application-shell redesign planned for the following task;
- new compact/responsive top-toolbar or overflow-menu design;
- browser Fullscreen API integration or replacement of the current Focus view;
- diagnostics toast/drawer redesign;
- keyboard shortcuts;
- changing Walk/Inspection focal-length defaults;
- FPS/frame-time overlays;
- unlit/`MeshBasicMaterial` material-inspection mode;
- editable architectural/artificial light fixtures;
- persistence in PlanAxis Project, Design, Material, or Apartment SVG formats;
- post-processing or new third-party runtime dependencies.

## Functional Requirements

### Runtime rendering-quality contract

Introduce a deliberate renderer-owned contract for quality/performance settings. It must remain separate from `ArchitecturalModel3D` and from persistent design/presentation formats.

It must support at least:

```text
pixelRatio
shadowQuality
environmentLightingEnabled
fillLightLevel
```

Exact type and API names may follow repository conventions.

Updates must take effect on the next rendered frame without rebuilding the apartment/domain model or introducing a permanent render loop.

### Device pixel ratio

The browser must derive selectable DPR values from the current native `window.devicePixelRatio`:

- include every positive integer starting at `1` that is strictly below native DPR;
- always include the exact native DPR as the final option;
- do not duplicate the native value when it is already an integer.

Examples:

```text
native 1    -> 1
native 1.25 -> 1, 1.25
native 2    -> 1, 2
native 2.5  -> 1, 2, 2.5
native 3    -> 1, 2, 3
```

Changing DPR must immediately reconfigure the renderer and render-buffer sizing while preserving the current camera/navigation state and CSS viewport size.

Handle invalid/non-finite/non-positive native DPR defensively with a deterministic safe fallback.

### Shadow quality

Expose this PlanAxis vocabulary:

```text
Off
Low
Medium
High
```

`Off` disables shadow rendering. `Low`, `Medium`, and `High` must map to deterministic renderer settings with increasing shadow-map quality/cost. Choose and document concrete Three.js settings appropriate to the existing renderer; renderer-specific details must remain inside `@planaxis/renderer-three`.

Changing shadow quality must not recreate the architectural model or reset camera/navigation state.

### Environment lighting

Allow the existing built-in environment lighting to be enabled or disabled at runtime.

When disabled, its image-based lighting contribution and environment reflections must be removed/neutralized consistently. The neutral scene background remains independent and unchanged.

Existing environment intensity and rotation values must remain available and be preserved while environment lighting is disabled, so re-enabling restores their effect.

### Fill light

Add renderer-level non-directional fill lighting with this user-facing vocabulary:

```text
Off
Low
Medium
High
```

Its purpose is to keep PBR surfaces and textures inspectable when environment/scene lighting is weak or disabled.

Requirements:

- preserve the existing PBR materials and texture behavior;
- do not replace materials with `MeshBasicMaterial` or another unlit material model;
- use a deterministic neutral light contribution;
- define increasing, documented intensity values for Low/Medium/High;
- keep renderer-specific light implementation inside `@planaxis/renderer-three`;
- avoid changing architectural/domain models.

### Quality presets and Custom state

Expose these quality states:

```text
Performance
Balanced
High
Custom
```

Named presets must apply deterministic values to the settings introduced by this task. Use these required DPR policies:

```text
Performance -> 1
Balanced    -> min(2, native DPR), using an available DPR option
High        -> native DPR
```

Define sensible deterministic shadow/environment/fill values for each preset, optimized respectively for interactive performance, normal use, and maximum available quality. Document the chosen mappings in code/tests and current-state documentation where useful.

`Custom` is not an independently applied preset. If the user manually changes any preset-controlled setting so the effective settings no longer exactly match the selected named preset, the quality state becomes `Custom`.

If manual settings exactly match a named preset, the implementation may recognize that preset again if this can be done simply and deterministically; otherwise remaining `Custom` is acceptable.

Selecting a named preset must reapply all settings controlled by that preset.

### Browser-local persistence

Persist the rendering-quality preference locally in the browser using an appropriate browser-local mechanism such as `localStorage`.

Persist only the quality/performance state introduced by this task. It must not become project/design persistence or cause server writes.

Requirements:

- restore valid saved settings on later page loads;
- validate/sanitize persisted data rather than trusting arbitrary storage contents;
- adapt restored DPR to the current device's available DPR values so preferences remain safe if the display/device changes;
- fall back deterministically when stored data is missing, malformed, or no longer supported;
- browser storage failure must not prevent PlanAxis from rendering.

Do not newly persist camera mode, selected design, aspect ratio, tone mapping, exposure, environment intensity/rotation, Focus view, or other existing transient state.

### Browser controls

Add accessible controls sufficient to select presets and manually edit all settings introduced by this task.

The controls may integrate with the existing 3D toolbar/layout. Do not perform the planned TASK-036 application-shell redesign merely to accommodate them.

Requirements:

- changes apply immediately;
- controls reflect `Custom` after applicable manual edits;
- controls are unavailable/disabled when the renderer is not ready, consistent with existing 3D controls;
- all individual settings remain editable regardless of the previously selected preset;
- existing presentation controls continue to function.

## Technical and Architectural Constraints

Keep the established responsibility split:

```text
@planaxis/renderer-three
  renderer-quality contract and Three.js/WebGPU/WebGL adaptation

apps/web
  device-DPR discovery, user controls, quality preset/application state,
  browser-local persistence, and renderer orchestration
```

Quality/performance settings must not enter:

```text
ArchitecturalModel3D
Apartment SVG
PlanAxis Project Format
PlanAxis Design Format
PlanAxis Material Format
```

Preserve the existing event-driven renderer lifecycle and resource ownership. Do not add a permanent render loop except where Walk already requires continuous frames while active.

Do not modify any file under `docs/tasks/`.

## Testing Requirements

Add focused automated coverage for at least:

- DPR option generation for integer and fractional native DPR values;
- defensive native-DPR fallback;
- immediate renderer DPR updates and buffer resizing without camera reset;
- all shadow-quality mappings, including `Off`;
- environment lighting enable/disable and preservation of intensity/rotation state;
- fill-light Off/Low/Medium/High behavior while preserving PBR materials;
- deterministic Performance/Balanced/High mappings;
- preset selection applying all controlled settings;
- manual edits changing quality state to `Custom`;
- valid persisted settings restoring across browser initialization;
- malformed/stale storage falling back safely;
- restored DPR adapting to a changed native DPR;
- storage read/write failure remaining non-fatal;
- existing tone mapping, exposure, environment controls, camera modes, Walk, resize, and material rendering remaining compatible.

Tests must not require external network access, a real user project, or a physical GPU device.

## Documentation Requirements

Review and update current-state documentation as needed, at minimum:

```text
README.md
docs/architecture/overview.md
```

Document the new runtime rendering-quality capabilities, quality presets, DPR behavior, shadow/environment/fill controls, and browser-local persistence boundary. Do not describe these preferences as project/design state.

## Verification

Run focused tests during development, then run:

```bash
pnpm --filter @planaxis/renderer-three test
pnpm --filter @planaxis/web test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. PlanAxis exposes runtime DPR, shadow-quality, environment-lighting, and fill-light settings without changing persistent project/design/material formats;
2. DPR options follow the specified native-DPR algorithm and changes immediately resize renderer buffers without resetting navigation;
3. shadows support Off/Low/Medium/High with deterministic increasing quality;
4. environment lighting can be disabled/re-enabled while preserving its existing intensity/rotation state;
5. fill light provides configurable neutral baseline illumination while retaining the normal PBR material model;
6. Performance/Balanced/High presets deterministically configure the new settings and manual edits produce `Custom` state;
7. rendering-quality preferences persist locally, restore safely, and adapt to changed device DPR without server/project writes;
8. accessible browser controls expose every new setting while leaving the overall UI redesign to the following task;
9. existing presentation, camera, Walk, material, and event-driven renderer behavior remains compatible;
10. focused tests and repository verification pass; and
11. current-state documentation describes the implemented quality controls and persistence boundary.

## Final Response

Provide a concise execution report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands actually run and their results;
5. dependency changes, or `None`;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-035
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
