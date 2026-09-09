# TASK-021: Add 3D Free-Walk Navigation

## Context

PlanAxis now provides an interactive 3D apartment view with inspection/orbit navigation, selectable Apartment SVG cameras, Focus view, focal-length presets, and render aspect-ratio controls.

The next step is a first-person free-walk mode that lets users move through the apartment with keyboard and mouse controls. This initial implementation intentionally omits collision detection and uses the first embedded Apartment SVG camera as the deterministic walk starting anchor.

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

Add a `Walk` viewing mode to the browser 3D experience.

Walk mode must provide continuous first-person horizontal movement and mouse-look controls while preserving the existing inspection, embedded-camera, focal-length, aspect-ratio, resize, and Focus view behavior.

## Scope

The task includes:

- adding `Walk` alongside inspection/orbit and embedded cameras in the existing 3D camera/view selector;
- enabling Walk only when the model contains at least one embedded camera;
- deriving the initial Walk pose from the first embedded camera in source/document order;
- using a fixed 165 cm eye height above the apartment floor;
- supporting WASD and arrow-key movement;
- supporting fast and slow movement modifiers;
- supporting simultaneous keyboard movement and left-mouse-drag look;
- preserving Walk pose when temporarily switching to another 3D viewing mode;
- preventing stuck movement/look state when browser interaction is interrupted;
- keeping continuous rendering active only while continuous movement is actually required;
- adding focused renderer and browser tests;
- updating current-state documentation.

## Out of Scope

This task does **not** include:

- collision detection or collision response;
- preventing movement through walls, fixed elements, doors, or outside the apartment footprint;
- gravity, jumping, crouching, stairs, or vertical movement;
- pointer lock;
- touch/virtual-joystick or gamepad Walk controls;
- configurable eye height, movement speed, mouse sensitivity, or key bindings;
- acceleration/inertia or other character-controller physics;
- persistent Walk state in Apartment SVG or domain models;
- Apartment SVG camera semantic changes;
- lighting, materials, Photo Mode, image export, or AI rendering.

## Functional Requirements

### Walk availability and view selection

Extend the existing 3D camera/view selector so it conceptually provides:

```text
Inspection / orbit
Walk
<embedded camera IDs...>
```

Walk must not be activatable when `model.cameras` is empty. In that case, keep inspection available and show a clear browser UI message explaining that free walk requires at least one camera in the Apartment SVG.

Do not infer a main entrance, zone, or fallback footprint position.

### Initial Walk pose

On the first Walk activation for a loaded model, use the first entry in `model.cameras` as the anchor. Preserve source/document order; do not sort or choose a camera by ID or other heuristic.

The initial Walk pose must use:

- X/Y position from the first embedded camera;
- Z position = `model.floor.z + 165 cm`;
- heading/yaw from the first embedded camera;
- pitch = `0°`;
- no roll.

The source camera's own Z and pitch must not determine Walk eye height or initial vertical look direction.

When the focal-length selector is `Camera default`, Walk must use the first embedded camera's source horizontal FOV as its default projection. Existing numeric focal-length overrides and aspect-ratio selections must remain independent and continue to work in Walk mode.

After Walk has been entered once for the current model, temporarily switching to inspection or an embedded camera and then back to Walk must restore the previous Walk position and look direction rather than respawning. Replacing the model starts a fresh Walk session and therefore resets the Walk pose to the new model's first camera anchor.

### Navigation constants

Define the Walk eye height and base movement speed as clearly named constants in an appropriate renderer navigation/constants module so a human maintainer can find and tune them easily without searching through controller logic.

Required values:

```text
eye height: 165 cm
base walking speed: 1.5 m/s
```

Do not bury these values as unexplained numeric literals.

### Keyboard movement

Support these movement keys while Walk is active:

```text
W / ArrowUp     forward
S / ArrowDown   backward
A / ArrowLeft   left
D / ArrowRight  right
```

Movement must begin immediately on key press, continue while the key remains held, and stop/re-resolve immediately on key release. Do not rely on browser keyboard-repeat timing.

Resolve opposing held directions independently per axis:

- forward + backward cancel to zero forward/backward movement;
- left + right cancel to zero strafe movement.

If one of two opposing held keys is released while the other remains held, movement in the remaining direction must begin immediately.

Normalize combined forward/strafe movement so diagonal movement is not faster than movement along one axis.

Movement direction must use Walk yaw only. Looking up or down must not add vertical movement or change horizontal walking speed.

### Movement speed modifiers

Base speed is `1.5 m/s`.

While moving:

- either Shift key applies fast movement at `2×` base speed (`3.0 m/s`);
- on macOS, either Option key applies slow movement at `0.5×` base speed (`0.75 m/s`);
- on Windows and Linux, Space applies slow movement at `0.5×` base speed (`0.75 m/s`).

If a fast modifier and a slow modifier are held simultaneously, they cancel and movement uses normal `1×` base speed.

Multiple keys representing the same modifier category still count as that category being active.

While Walk is actively handling keyboard input, prevent relevant default browser/page actions such as arrow-key or Space scrolling. Outside Walk mode, do not interfere with normal browser shortcuts or page behavior.

### Mouse look and simultaneous input

While Walk is active, left mouse button + drag over the 3D browser area must adjust view yaw and pitch without pointer lock.

Clamp pitch to a safe range just below vertical, such as `-89°` to `+89°`, so the camera cannot flip. Keep roll at zero.

Keyboard movement and mouse look must be independent. The user must be able to hold multiple movement/modifier keys while dragging the mouse, with both translation and look updates taking effect concurrently.

### Continuous movement and rendering

Movement must be time-based and frame-rate independent, using elapsed time rather than a fixed distance per rendered frame.

Preserve the renderer's event-driven idle behavior. Use a `requestAnimationFrame`-style update loop only while the resolved Walk movement vector is non-zero, and stop it when continuous movement is no longer required. Mouse-drag look may render directly from pointer events.

Holding only modifiers, or holding direction keys that fully cancel each other, must not require a persistent movement loop.

### Input-state reset and lifecycle safety

Walk input must never remain stuck after browser interaction is interrupted.

Clear all held movement/modifier state and active mouse-drag state when relevant interruption/lifecycle events occur, including:

- pointer/mouse leaving the 3D browser interaction area;
- `window` losing focus;
- document visibility changing to hidden;
- leaving Walk mode;
- replacing the model;
- renderer/controller disposal.

Use the appropriate browser pointer/focus/visibility events; exact DOM event choices may be refined. After a reset, movement or mouse look must not resume until new input is received.

## Technical and Architectural Constraints

- Preserve the ownership boundaries defined by ADR-002 and ADR-003.
- Keep browser toolbar/status presentation in `apps/web`.
- Keep Walk camera/control behavior, renderer-space movement, timing, and input lifecycle ownership in `@planaxis/renderer-three`.
- Treat Walk position, look direction, pressed-key state, and speed modifiers as runtime state, not Apartment SVG or domain-model facts.
- Reuse the existing renderer coordinate/unit boundary; do not introduce architectural geometry changes for navigation.
- Preserve existing inspection/orbit controls and embedded-camera behavior.
- Preserve focal-length and aspect-ratio independence established by TASK-020.
- Do not add an external dependency; none is expected.
- Do not modify any file under `docs/tasks/`.

Exact internal API and controller type names may be refined as long as the behavior and ownership above remain clear.

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

No parser, validator, Apartment SVG specification, or domain-model changes are expected.

## Testing Requirements

Add focused automated coverage for:

- Walk being unavailable with a clear message when no embedded camera exists;
- first-camera initial position, 165 cm eye height, heading, neutral pitch, and default projection;
- Walk pose preservation across temporary view-mode changes and reset on model replacement;
- WASD and arrow-key movement equivalence;
- immediate held-key movement and key-release behavior without relying on key repeat;
- opposing direction cancellation and correct resumption when one opposing key is released;
- normalized diagonal movement;
- base, fast, slow, and conflicting speed-modifier behavior on supported platforms;
- yaw-only horizontal movement regardless of pitch;
- independent simultaneous keyboard movement and mouse look;
- pitch clamping and zero roll;
- input-state reset on pointer/mouse leave, blur, hidden visibility, mode change, model replacement, and disposal;
- movement-loop start/stop behavior so idle rendering does not become persistent;
- existing inspection, embedded-camera, focal-length, aspect-ratio, resize, and Focus view behavior remaining compatible.

Follow `docs/development/testing.md` and do not weaken existing tests. Avoid pixel-perfect rendering assertions.

## Documentation Requirements

Update `README.md` and `docs/architecture/overview.md` so current-state documentation describes free-walk navigation as implemented and no longer lists it as future work.

Document the user-facing Walk controls concisely where appropriate.

Do not modify Apartment SVG 2.2 semantics or rewrite ADR history merely to reflect implementation progress.

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

1. the 3D view selector provides a Walk mode while preserving inspection and embedded-camera modes;
2. Walk is unavailable without an embedded camera and the UI explains the requirement;
3. first activation uses the first embedded camera's X/Y and heading, floor + 165 cm eye height, neutral pitch, and that camera's default horizontal FOV;
4. held WASD/arrow input produces immediate, continuous, frame-rate-independent horizontal movement with correct opposing-direction and diagonal behavior;
5. Shift provides `2×` speed, macOS Option or Windows/Linux Space provides `0.5×` speed, and simultaneous fast+slow modifiers resolve to normal speed;
6. left-drag mouse look works without pointer lock and can operate simultaneously with keyboard movement;
7. movement is unconstrained by walls, fixed elements, doors, and the footprint boundary;
8. input state is reliably cleared on interaction loss and renderer/mode lifecycle transitions, preventing stuck movement or look;
9. continuous rendering runs only while continuous movement is required, preserving idle event-driven rendering;
10. Walk pose, focal-length selection, aspect-ratio selection, resize behavior, and Focus view transitions remain compatible;
11. focused tests and full repository verification pass;
12. current-state documentation reflects the new free-walk capability.

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
Task: TASK-021
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
