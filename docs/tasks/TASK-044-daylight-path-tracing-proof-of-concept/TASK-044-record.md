# TASK-044: Daylight path-tracing proof of concept

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-10-09
- **Issued:** 2026-10-09
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-044-description.md`
- **Related tasks:** TASK-038, TASK-039, TASK-042, TASK-043
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project 1.0, PlanAxis Design 1.1, PlanAxis Material 1.1
- **Implementation commits:** —

## Purpose

Produce a first integrated daylight path-tracing view so the human maintainer can compare a progressively refined apartment interior with the accepted VXGI implementation.

TASK-043 was completed with known unresolved thin-wall light leakage. Further VXGI development is set aside. PlanAxis prioritizes convincing apartment-renovation images over real-time path-tracing performance; waiting a minute or longer for refinement is acceptable.

This task introduces a limited daylight proof of concept based on erichlof's Three.js path-tracing project. It evaluates Sun and sky illumination through a window in a complete architectural enclosure while retaining the existing renderer for comparison.

## Description

The authoritative task description is stored in:

`TASK-044-description.md`

The task was formally issued on 2026-10-09. The task description is now immutable.

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

Pending.

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

The intended repository location is:

`docs/tasks/TASK-044-daylight-path-tracing-proof-of-concept/`

This record does not authorize implementation. The human maintainer must populate the issue date and agent and change the status to `In Progress` when formally issuing the task.

TASK-043 remains completed. TASK-044 neither reopens it nor requires removal or further tuning of its accepted implementation.

Performance benchmarks and a fixed render-time acceptance threshold are intentionally excluded. This task's visual acceptance concerns architectural occlusion and convincing daylight transport.
