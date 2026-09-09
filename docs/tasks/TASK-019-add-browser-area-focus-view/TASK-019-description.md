# TASK-019: Add Browser-Area Focus View

## Context

PlanAxis now provides a browser application with local Apartment SVG validation, an interactive 2D floor-plan viewer, and an interactive 3D apartment view.

The application chrome is useful during normal work, but users also need a distraction-free mode where the currently active apartment view occupies the browser client area.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-threejs-renderer.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Add a browser-area **Focus view** that hides application and viewer chrome and expands the currently active apartment view to the available browser client area.

Focus view must not use the browser Fullscreen API and must preserve the active viewport and its state when entering or leaving the mode.

## Scope

The task includes:

- adding a control for entering Focus view when an apartment viewport is available;
- expanding the active 2D or 3D view to the browser client area;
- hiding normal application, validation, view-selection, and viewport toolbar/help chrome while focused;
- providing a semi-transparent close control in a corner of the focused view;
- allowing `Escape` to exit Focus view;
- supporting the 2D preview of invalid Apartment SVG documents when that preview is available;
- preserving existing viewport and workspace state across focus-mode transitions;
- adding focused browser tests;
- updating current-state documentation where necessary.

## Out of Scope

This task does **not** include:

- the browser Fullscreen API or control of browser/operating-system chrome;
- new 2D or 3D navigation behavior;
- new viewport or rendering controls unrelated to Focus view;
- changes to Apartment SVG semantics or domain models;
- renderer architecture changes unrelated to responding to viewport resize;
- redesigning file loading or drag-and-drop behavior.

## Functional Requirements

### Focus view entry and exit

Provide a clearly identifiable Focus view action when a rendered apartment viewport is available.

Entering Focus view must:

- keep the currently active 2D or 3D view active;
- hide the normal PlanAxis application chrome and viewport controls;
- make the active drawing/rendering surface use the available browser client area.

The only focus-specific control that remains visible must be a semi-transparent close control positioned unobtrusively in a corner of the view.

Users must be able to exit Focus view with either that control or the `Escape` key.

### Browser-area behavior

Focus view is an application layout state, not native browser fullscreen.

The browser's own tab bar, address bar, window borders, and operating-system UI remain outside PlanAxis control. Users may independently use their browser's native fullscreen command if desired.

The focused viewport must respond correctly to client-area size changes using the existing responsive viewer/renderer behavior.

### State preservation

Entering or leaving Focus view must not reload or reprocess the document and must not replace or remount the active viewport solely because focus mode changed.

Existing viewport-owned state must survive the transition, including current 2D navigation state and current 3D camera/navigation state.

The focus-view mechanism must operate generically at the application/layout level and must not depend on enumerating or resetting individual viewport settings. Existing responsive behavior triggered by a real viewport resize may still run normally.

Workspace state hidden by Focus view, such as validation-detail visibility and the selected 2D/3D mode, must be restored unchanged when Focus view closes.

### Supported document states

For a valid document, Focus view must work with whichever apartment view is currently active.

For an invalid document whose original SVG 2D preview is available, Focus view must also allow that preview to be shown without surrounding validation/application chrome.

No Focus view is required when there is no rendered apartment viewport to display.

### Accessibility and interaction

The Focus view entry and exit controls must have meaningful accessible names.

`Escape` handling must only exit Focus view when the mode is active and must not interfere with normal keyboard behavior otherwise.

Normal interaction with the focused drawing/rendering surface must remain available.

## Technical and Architectural Constraints

- Keep focus state and browser interaction concerns in `apps/web`.
- Preserve the ownership boundaries documented by ADR-002 and ADR-003.
- Prefer changing layout/CSS around the existing mounted viewport rather than creating a separate focus-only renderer/viewer instance.
- Do not introduce a renderer API specifically for Focus view.
- Let existing resize observation propagate the focused viewport's actual size to the 2D/3D view implementations.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/web/src/
apps/web/test/
README.md
```

No renderer-package change is expected unless a small correction is required for existing resize behavior.

## Testing Requirements

Add automated coverage for the important Focus view behavior, including:

- entering and exiting Focus view;
- exiting with `Escape`;
- application and viewport chrome being hidden while focused;
- the active 2D/3D selection remaining unchanged across the transition;
- viewport state not being reset through focus-triggered remounting;
- invalid-document 2D preview support;
- focus controls not being offered when no apartment viewport exists.

Use focused tests appropriate to the browser UI and follow `docs/development/testing.md`.

## Documentation Requirements

Update `README.md` if needed so its current browser behavior includes Focus view.

Do not create or modify an ADR unless implementation reveals an architectural decision not already covered by ADR-002 or ADR-003.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused `apps/web` tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. users can enter Focus view from an available 2D or 3D apartment viewport;
2. the active drawing/rendering surface fills the browser client area while normal application and viewport chrome is hidden;
3. a semi-transparent close control and the `Escape` key both exit Focus view;
4. no native browser Fullscreen API is used;
5. entering and leaving Focus view preserves the active viewport and its state rather than remounting or resetting it;
6. invalid documents with an available 2D preview can use Focus view;
7. focused browser tests and full repository verification pass;
8. current-state documentation remains accurate.

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
Task: TASK-019
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
