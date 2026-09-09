# TASK-019: Add Browser-Area Focus View

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-09-09
- **Issued:** 2026-09-09
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-019-description.md`
- **Related tasks:** TASK-017, TASK-018
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** —
- **Implementation commits:** —

## Purpose

Add a browser-area focus mode that lets users concentrate on the currently displayed apartment view without surrounding application chrome.

The mode should build on the existing 2D and 3D browser viewers while preserving their state and interaction behavior.

## Description

The authoritative task description is stored in:

`TASK-019-description.md`

The task was formally issued on 2026-09-09 and is now in progress.

## Execution Record

### Result

Pending.

### Verification

Pending.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Pending

### Review Notes

None.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

—

### Commit Messages

—

### Supersession

—

## Notes

This task intentionally uses browser-client-area focus mode rather than the browser Fullscreen API.

The focus-view mechanism is expected to remain generic so future viewport-owned state can be preserved without coupling the feature to specific controls.
