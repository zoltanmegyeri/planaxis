# TASK-036: Implement Viewport-First Browser UI

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-28
- **Issued:** 2026-09-28
- **Completed:** 2026-09-28
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-036-description.md`
- **Related tasks:** TASK-019, TASK-020, TASK-021, TASK-035
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** —
- **Implementation commits:** 9303c6804f4417599be977954028a44065b76412

## Purpose

Complete the second part of the browser UI redesign after TASK-035 established configurable rendering quality and local performance preferences.

The goal is to make the apartment viewport the dominant application surface while retaining the existing design, navigation, rendering, diagnostics, and editing capabilities through compact contextual controls.

## Description

The authoritative task description is stored in:

`TASK-036-description.md`

The task was formally issued on 2026-09-28 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the viewport-first browser workspace redesign.

The implementation includes:

- one compact, non-wrapping primary toolbar for design, 2D/3D switching, camera selection, rendering controls, fullscreen, diagnostics, and help;
- responsive overflow for lower-priority workspace controls and project/document information;
- compact transient design-management, camera-settings, rendering, information, and diagnostics surfaces;
- browser Fullscreen API integration for the 3D render area, with all PlanAxis chrome hidden except the exit `×`;
- replacement of the permanent validation sidebar with compact status, non-blocking problem notification, and overlay diagnostics;
- contextual navigation/help content instead of persistent instruction text;
- keyboard shortcuts for `2`, `3`, `W`, `I`, and `Escape`, with editable-control and modifier safeguards;
- 50 mm Inspection, 16 mm Walk, and embedded-camera-defined default projections, with manual focal-length overrides available through camera settings;
- preservation of TASK-035 quality controls and browser-local quality persistence inside the reorganized Rendering panel;
- current-state README and architecture updates describing the redesigned workflow.

The previous Focus-view workflow and stacked permanent workspace controls were replaced by the new viewport-first shell.

### Verification

The implementation was reported as successful and accepted by the human maintainer.

Exact command-by-command verification results were not provided in this conversation and are therefore not recorded as PASS here.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-036 implementation was accepted as successful. The committed changes implement the intended viewport-first browser workspace, real 3D fullscreen behavior, compact diagnostics and contextual controls, keyboard shortcuts, and navigation-mode lens defaults while preserving the established design, rendering-quality, persistence, and renderer boundaries.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
9303c6804f4417599be977954028a44065b76412
```

### Commit Messages

```text
feat(web): implement viewport-first browser workspace

Consolidate controls into a responsive toolbar and transient panels.
Add native fullscreen, diagnostics, shortcuts, and camera lens defaults.

Task: TASK-036
```

### Supersession

—

## Notes

TASK-036 completes the second and final task of the current UI redesign workflow.

Together with TASK-035, the browser now has a viewport-first workspace and configurable rendering-quality controls while keeping browser-local quality preferences separate from persistent project, design, material, and Apartment SVG data.
