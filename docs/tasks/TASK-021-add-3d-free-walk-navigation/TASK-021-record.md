# TASK-021: Add 3D Free-Walk Navigation

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-09
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-021-description.md`
- **Related tasks:** TASK-018, TASK-019, TASK-020
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** —

## Purpose

Add first-person free-walk navigation to the existing browser 3D apartment experience.

The task establishes deterministic camera-anchored Walk startup, keyboard movement, mouse look, speed modifiers, and robust input-state cleanup while intentionally deferring collision handling.

## Description

The authoritative task description is stored in:

`TASK-021-description.md`

The description is finalized and ready for formal delegation but has not yet been issued.

## Execution Record

### Result

Pending.

### Verification

NOT RUN.

### Deviations from Description

Pending.

### Agent-Reported Follow-up Items

Pending.

## Human Review

### Review Status

Pending

### Review Notes

Pending.

### Human Changes After Agent Execution

Pending.

## Finalization

### Implementation Commits

—

### Commit Messages

—

### Supersession

—

## Notes

Walk mode deliberately requires at least one embedded Apartment SVG camera and uses the first camera as its deterministic starting anchor.

Collision detection is intentionally deferred; this task establishes the free-walk interaction model and renderer lifecycle first.
