# TASK-027: Add Environment Lighting and Presentation Controls

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-13
- **Issued:** 2026-09-13
- **Completed:** 2026-09-13
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-027-description.md`
- **Related tasks:** TASK-018, TASK-025, TASK-026
- **Related ADRs:** ADR-001, ADR-002, ADR-003
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** 6fe3d168a30deb8bb9c3e2ec1fe87122ca8c54bc

## Purpose

Complete Phase 1 by adding deterministic environment lighting and the core runtime presentation controls needed to evaluate PBR materials and transmissive glass.

The task adds built-in IBL, tone mapping, EV-based exposure, and environment controls while keeping presentation state transient and separate from architecture, project persistence, and future design scenarios.

## Description

The authoritative task description is stored in:

`TASK-027-description.md`

The task was formally issued on 2026-09-13 and completed on 2026-09-13.

## Execution Record

### Result

Codex successfully completed the Phase 1 presentation foundation.

The implementation added built-in neutral room IBL, removed the hemisphere ambient contribution, retained the deterministic directional key/shadow light, and added transient AgX / ACES Filmic / Neutral tone mapping, EV-based exposure, environment intensity, and environment yaw controls in the renderer and browser.

### Verification

The implementation was reported as completed successfully.

Command-by-command agent verification results were not separately provided during task-record finalization.

### Deviations from Description

None reported.

### Agent-Reported Follow-up Items

None reported.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-027 implementation was accepted as successfully completed.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
6fe3d168a30deb8bb9c3e2ec1fe87122ca8c54bc
```

### Commit Messages

```text
feat(renderer): add environment lighting and presentation controls

Add built-in room IBL and transient tone mapping, EV exposure,
environment intensity, and yaw controls with lifecycle coverage.

Task: TASK-027
```

### Supersession

—

## Notes

TASK-027 is the third and final implementation task of Phase 1, the visual rendering foundation.

It adds built-in environment lighting, a retained deterministic directional shadow light, AgX/ACES Filmic/Neutral tone mapping, EV-based exposure, environment intensity/rotation, and transient browser presentation controls. Persistent environment assets, presentation persistence, lighting design, and post-processing remain later work.
