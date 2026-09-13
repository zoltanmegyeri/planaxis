# TASK-027: Add Environment Lighting and Presentation Controls

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-13
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-027-description.md`
- **Related tasks:** TASK-018, TASK-025, TASK-026
- **Related ADRs:** ADR-001, ADR-002, ADR-003
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** —

## Purpose

Complete Phase 1 by adding deterministic environment lighting and the core runtime presentation controls needed to evaluate PBR materials and transmissive glass.

The task adds built-in IBL, tone mapping, EV-based exposure, and environment controls while keeping presentation state transient and separate from architecture, project persistence, and future design scenarios.

## Description

The authoritative task description is stored in:

`TASK-027-description.md`

The task is ready for formal delegation.

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

TASK-027 is the third and final implementation task of Phase 1, the visual rendering foundation.

It adds built-in environment lighting, a retained deterministic directional shadow light, AgX/ACES Filmic/Neutral tone mapping, EV-based exposure, environment intensity/rotation, and transient browser presentation controls. Persistent environment assets, presentation persistence, lighting design, and post-processing remain later work.
