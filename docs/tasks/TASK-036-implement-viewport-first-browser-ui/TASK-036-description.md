# TASK-036: Implement Viewport-First Browser UI

## Context

TASK-035 added configurable 3D rendering quality, browser-local quality preferences, DPR control, shadow quality, environment-lighting control, and PBR-preserving fill light.

The browser application still presents the workspace as several stacked full-width control rows plus an optional validation sidebar. The current Focus view only hides application chrome inside the browser window, 3D controls occupy a wrapping toolbar, design management has its own permanent row, and navigation instructions consume persistent vertical space.

The next step is to reorganize the existing browser capabilities around the apartment viewport so the rendering area receives as much of the browser client area as practical while important controls remain quickly accessible.

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

Inspect the current browser workspace, design workflow, diagnostics, 2D/3D view switching, Three.js controls, renderer camera API, and rendering-quality controls under:

```text
apps/web/
packages/renderer-three/
```

Do not read any other file under `docs/tasks/`.

## Goal

Replace the current stacked browser workspace controls with a compact, viewport-first application shell.

Provide one primary toolbar with direct access to design selection, 2D/3D switching, 3D camera selection, rendering settings, fullscreen, diagnostics status, and contextual help. Move less-frequent controls into transient popovers/panels or overflow UI, replace the current Focus view with real browser fullscreen, and replace the permanent validation sidebar with non-blocking diagnostics UX.

## Scope

The task includes:

- redesigning the valid-workspace application shell around one compact primary toolbar and the viewport;
- removing the permanent stacked header/design/workspace/view/3D-control rows in normal operation;
- integrating existing design selection and design create/edit entry points into compact transient UI;
- keeping 2D/3D switching directly accessible;
- reorganizing existing camera, framing, presentation, and TASK-035 quality controls without removing functionality;
- replacing Focus view with browser Fullscreen API integration for the 3D render area;
- replacing permanent validation details with status, toast, and overlay diagnostics drawer behavior;
- replacing persistent navigation-help text with an information control and contextual transient help;
- adding keyboard shortcuts for the agreed high-frequency view/navigation actions;
- changing default 3D lenses to 16 mm for Walk and 50 mm for Inspection;
- making the primary toolbar responsive without wrapping into additional permanent rows;
- preserving the existing design, validation, material, camera, rendering-quality, and persistence boundaries;
- adding focused browser/renderer tests and updating current-state documentation.

## Out of Scope

This task does **not** include:

- new renderer-quality dimensions or changes to TASK-035 quality preset semantics;
- FPS/frame-time/GPU-stat overlays;
- new environment assets, lighting-design objects, post-processing, or final-render export;
- new material, design, project, or Apartment SVG format fields;
- new persistence beyond the TASK-035 browser-local rendering-quality preference;
- persisting current view, camera, selected design, fullscreen state, aspect ratio, diagnostics state, or transient presentation settings;
- unlit/`MeshBasicMaterial` inspection mode;
- changing Walk movement/collision semantics;
- a general mobile/touch redesign beyond making the toolbar degrade responsively;
- new third-party UI dependencies unless a concrete implementation need is demonstrated.

## Functional Requirements

### Viewport-first application shell

For a usable workspace, normal application operation MUST use one compact primary toolbar above the apartment viewport rather than the current sequence of permanent full-width control rows.

The primary toolbar must provide direct access to:

```text
Design
2D / 3D
Camera (when 3D is active)
Rendering (when 3D is active)
Full screen (when 3D is active)
Diagnostics status
Information / help
```

A compact PlanAxis/project identity may remain in the toolbar.

The architecture path, Apartment SVG version, and similar document metadata must no longer require their own permanent row. Keep them reachable through compact project/document information or overflow UI.

The toolbar must remain one row. At narrower widths, lower-priority items must collapse into an overflow control rather than wrapping into another permanent row. Preserve Design, 2D/3D, Camera, Rendering, and Full screen as long as practical before lower-priority information is collapsed.

The viewport must consume all remaining available application space.

### Design workflow

Design selection remains a primary toolbar action and must continue to expose:

```text
No design
available design scenarios
```

Create-design and edit-current-design actions must remain available but must no longer occupy a permanent full-width design panel.

Use an accessible transient popover, panel, dialog, or equivalent compact interaction for create/edit operations. Preserve the existing creation/editing fields, validation, save behavior, design-resolution behavior, material fallback, notices, and failure reporting.

Do not change Design Format semantics or server persistence APIs in this task.

### 2D and 3D views

Keep 2D and 3D switching directly accessible from the primary toolbar.

Existing 2D pan/zoom behavior must remain available. 2D-specific controls may be compact viewport overlays or transient controls, but must not reintroduce a permanent stacked application row.

View selection remains transient and is not stored in browser-local preferences or project data.

### 3D camera and framing controls

The primary toolbar must provide direct camera selection with these choices:

```text
Inspection
Walk
embedded Apartment SVG cameras
```

Use these navigation-mode defaults:

```text
Inspection -> 50 mm full-frame focal length
Walk       -> 16 mm full-frame focal length
Embedded   -> camera-defined horizontal FOV
```

Entering Inspection or Walk must apply that mode's default focal length. Selecting an embedded camera must return to the embedded camera's defined FOV.

The user must still be able to choose another supported focal length manually through secondary camera/framing UI. A manual focal-length change applies to the current view until another camera/navigation mode is selected, at which point that mode's default above is reapplied.

Preserve the existing supported full-frame focal-length vocabulary and aspect-ratio choices. Focal length and aspect ratio no longer need permanent top-level controls; keep them one compact interaction away through camera/view settings or equivalent transient UI.

Changing camera, focal length, aspect ratio, toolbar layout, or fullscreen state must not reset the current Walk pose beyond the existing navigation-mode semantics.

### Rendering controls

Provide a compact `Rendering` control that exposes the existing renderer presentation settings together with the TASK-035 rendering-quality settings.

The UI must continue to expose all existing editable settings:

```text
Quality preset
Pixel ratio
Shadows
Environment lighting
Fill light
Tone mapping
Exposure
Environment intensity
Environment rotation
```

Preserve TASK-035 behavior:

- Performance/Balanced/High/Custom semantics are unchanged;
- every individual quality setting remains manually editable;
- a manual preset-controlled change produces `Custom` according to the existing quality model;
- quality preferences remain the only settings persisted in browser-local storage.

Preserve existing Design Format presentation behavior: when a selected design supplies tone-mapping/exposure overrides, those values remain design-controlled and the runtime UI must not silently overwrite them.

Rendering changes remain immediate and must not rebuild the apartment or reset navigation.

### Full screen

Replace the current CSS-only Focus view with real browser fullscreen for the 3D rendering area.

Requirements:

- Full screen is available only for the 3D view;
- use the browser Fullscreen API from a user action;
- the fullscreen element must contain the rendered 3D area and the fullscreen exit control;
- while fullscreen is active, **all PlanAxis controls and chrome are hidden except one close/exit `×` button over the rendering area**;
- the close button exits fullscreen;
- native `Escape` fullscreen behavior must work;
- application state must follow `fullscreenchange`, including browser-initiated exit;
- failure or unavailability of the Fullscreen API must not leave stale fullscreen UI state;
- entering/exiting fullscreen must preserve the current model, camera/navigation mode, Walk pose, framing, presentation, and quality settings;
- fullscreen state is transient and must not persist across reloads.

Remove the old Focus-view terminology and CSS/state once replaced.

### Diagnostics

Successful validation must no longer require a permanent validation-details sidebar or expanded panel.

When the current workspace has no actionable problem, show only a compact successful/ready status in the application toolbar.

When a new actionable validation/design/material/resource/renderer problem occurs while a usable workspace exists:

1. show a non-blocking notification/toast with a concise summary and a `View details` action;
2. keep a persistent warning/error indication in the toolbar after the toast disappears;
3. open detailed diagnostics in a temporary drawer/panel that overlays the viewport instead of resizing it.

The diagnostics surface must preserve useful existing structured information and keep error domains distinguishable, including where applicable:

```text
Apartment SVG parser/schema/reference/geometry
Design Format / design resolution
Material Format / material resource loading
Project or API/resource failure
Renderer failure
```

Closing the diagnostics drawer restores the unobstructed viewport.

Failures that prevent any usable workspace from being created may retain an appropriate full-page/empty-state failure presentation instead of forcing the toast/drawer pattern.

Do not convert diagnostics into blocking modal alerts.

### Contextual help

Remove persistent navigation-instruction text from the workspace.

Provide a small accessible information control that opens contextual help for the active view.

At minimum:

- Inspection help describes orbit, pan, and zoom;
- Walk help describes arrow/WASD movement, left-drag look, Shift fast movement, and Option/Space slow movement;
- 2D help describes the existing pan/zoom controls;
- help lists the keyboard shortcuts introduced by this task.

No `?` keyboard shortcut is required.

### Keyboard shortcuts

Add these application shortcuts:

```text
2 -> switch to 2D
3 -> switch to 3D
W -> select Walk
I -> select Inspection
Escape -> close the active transient application UI when not consumed by browser fullscreen
```

Requirements:

- shortcuts must not fire while focus is in an input, textarea, select, editable element, or other text-entry control;
- ordinary shortcuts must not fire with Ctrl, Meta, or Alt modifiers;
- `W` must not interfere with forward movement after Walk is already active; in active Walk navigation, existing renderer movement handling remains authoritative;
- `W` may switch from another 3D camera/navigation mode into Walk;
- `I` switches to Inspection;
- `W` and `I` must not implicitly switch from 2D to 3D unless the implementation can do so clearly and deterministically; keeping them 3D-contextual is acceptable and preferred;
- `Escape` must not prevent the browser's native fullscreen exit behavior;
- closing popovers/drawers with `Escape` must not reset unrelated viewport state.

### Responsive behavior

The compact application shell must remain usable on laptop-sized browser windows and large/high-DPI displays.

Do not rely on CSS wrapping to produce multiple toolbar rows.

Use deliberate overflow/collapse behavior for lower-priority controls and metadata. Controls moved into overflow must remain keyboard-accessible and must not lose their current state.

The redesign should prioritize viewport area over decorative chrome.

## Technical and Architectural Constraints

Keep React/browser interaction in `apps/web`.

Keep Three.js objects and renderer-specific camera implementation inside `@planaxis/renderer-three`.

A small renderer/API change is permitted where required to implement the agreed Walk/Inspection focal-length defaults, but do not move application-shell state into the renderer.

Reuse the existing TASK-035 quality model and browser-local persistence rather than creating a second quality-state system.

Preserve the current separation between:

```text
durable design/project state
transient presentation/view state
browser-local rendering-quality preferences
```

Do not add project/server writes for UI preferences.

Prefer existing platform primitives and repository dependencies. No new dependency is expected.

Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/web/src/
apps/web/test/
packages/renderer-three/src/
packages/renderer-three/test/
README.md
docs/architecture/overview.md
```

Server and format packages are not expected to change.

## Testing Requirements

Add or update focused automated coverage for at least:

- the compact primary toolbar exposing the required primary actions;
- Design selection plus create/edit workflows remaining functional without the permanent design panel;
- direct 2D/3D switching;
- camera selection for Inspection, Walk, and embedded cameras;
- Inspection defaulting to 50 mm, Walk to 16 mm, and embedded cameras to their defined FOV;
- manual focal-length overrides being replaced by the next navigation-mode default;
- aspect-ratio controls remaining functional;
- Rendering UI exposing all existing presentation and TASK-035 quality settings;
- design-controlled tone mapping/exposure remaining protected;
- fullscreen entry, `fullscreenchange`, close-button exit, browser exit, and failure handling;
- fullscreen hiding all UI except the exit `×`;
- validation success not rendering a permanent diagnostics sidebar;
- problem toast/status behavior and overlay diagnostics drawer;
- diagnostics drawer preserving structured Apartment SVG errors and other available failure categories;
- contextual help for 2D, Inspection, and Walk;
- `2`, `3`, `W`, `I`, and `Escape` shortcuts;
- shortcut suppression in editable controls and modifier-key cases;
- `W` not breaking active Walk movement;
- narrow-toolbar/overflow behavior where practical in DOM/component tests;
- existing design, material, quality persistence, Walk, presentation, and renderer behavior remaining compatible.

Tests must not require external network access, a real user project, physical fullscreen display, or a physical GPU device. Mock browser Fullscreen APIs where needed.

## Documentation Requirements

Review and update current-state documentation as needed, at minimum:

```text
README.md
docs/architecture/overview.md
```

Document the viewport-first browser shell, real 3D fullscreen behavior, compact diagnostics workflow, keyboard shortcuts, reorganized rendering controls, and 16 mm Walk / 50 mm Inspection defaults.

Remove or update current-state wording that still describes the old Focus view, permanent validation panel, or stacked 3D toolbar.

No normative format specification change is expected.

## Verification

Run focused browser and renderer tests during development, then run:

```bash
pnpm --filter @planaxis/web test
pnpm --filter @planaxis/renderer-three test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. the normal usable workspace is organized around one compact, non-wrapping primary toolbar and a viewport consuming the remaining application area;
2. Design, 2D/3D, Camera, Rendering, Full screen, diagnostics status, and help remain readily accessible without the old stacked permanent rows;
3. Design creation/editing and all existing camera, aspect, presentation, and TASK-035 quality functionality remain available through compact/transient UI;
4. Inspection defaults to 50 mm, Walk defaults to 16 mm, embedded cameras use their specified FOV, and manual focal overrides behave as defined;
5. real browser fullscreen applies only to the 3D render area and shows no PlanAxis UI except the exit `×`;
6. the old Focus view is removed;
7. successful validation no longer occupies a permanent sidebar, while actionable problems produce non-blocking notification plus persistent status and an overlay diagnostics drawer;
8. persistent navigation-help text is replaced by contextual information UI;
9. shortcuts `2`, `3`, `W`, `I`, and `Escape` work without interfering with text entry or active Walk movement;
10. responsive toolbar behavior uses deliberate overflow rather than permanent row wrapping;
11. no new UI preference persistence or format/server persistence is introduced beyond the existing TASK-035 quality preference;
12. focused tests and repository verification pass; and
13. README and architecture documentation describe the redesigned current browser workflow accurately.

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
Task: TASK-036
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
