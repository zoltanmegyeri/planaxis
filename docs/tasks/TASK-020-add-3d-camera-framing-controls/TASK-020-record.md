# TASK-020: Add 3D Camera Framing Controls

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-09
- **Issued:** 2026-09-09
- **Completed:** 2026-09-09
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-020-description.md`
- **Related tasks:** TASK-018, TASK-019
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** 5d78cc49f6f16f3b91d2199f294e36f6c2d433f7

## Purpose

Add practical photographic framing controls to the existing 3D apartment view.

The task extends the current camera selector with full-frame focal-length presets and selectable render aspect ratios while keeping camera pose, lens choice, and image framing independent.

## Description

The authoritative task description is stored in:

`TASK-020-description.md`

The task was formally issued on 2026-09-09 and is now completed.

## Execution Record

### Result

Codex completed the 3D camera framing controls.

The implementation adds independent camera, focal-length, and aspect-ratio selectors; full-frame focal-length presets with camera-default projection behavior; centered fixed-aspect 3D rendering; projection handling that preserves focal-length overrides across camera changes and resize; and framing-state preservation across Focus view transitions.

### Verification

The implementation was completed successfully.

Command-by-command agent verification results were not separately provided during task-record finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-020 implementation was accepted as successfully completed.

No additional human-review findings were reported.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
5d78cc49f6f16f3b91d2199f294e36f6c2d433f7
```

### Commit Messages

```text
feat: add 3D camera framing controls

Add full-frame focal presets and centered fixed-aspect rendering.
Preserve framing selections across cameras, resize, and Focus view.

Task: TASK-020
```

### Supersession

—

## Notes

This task treats camera selection, focal length, and render aspect ratio as separate runtime controls.

It does not change Apartment SVG camera definitions or add photographic rendering effects beyond perspective framing.
