# TASK-040: Implement Persistent Luminaire Semantics

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-30
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-040-description.md`
- **Related tasks:** TASK-039
- **Related ADRs:** ADR-002, ADR-004
- **Related specifications:** PlanAxis Design Format 1.0, PlanAxis Design Format 1.1, PlanAxis Project Format 1.0
- **Implementation commits:** —

## Purpose

Implement the persistent luminaire contract defined by PlanAxis Design Format 1.1 without yet rendering or interactively editing artificial lights.

Design Format 1.1 is now the accepted persistence contract for `point`, `spot`, `linear`, and `area` luminaires. TASK-040 extends the existing Design 1.0 package/server/browser pipeline so those semantics can be validated, loaded, preserved, and written safely while retaining Design 1.0 compatibility.

## Description

The authoritative task description is stored in:

`TASK-040-description.md`

The task is ready for formal delegation and has not yet been issued.

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

TASK-040 is the persistence/domain portion of Phase 4 Stage 4.3.

The task must not introduce Three.js luminaire rendering or luminaire placement/editing controls. Those belong to the subsequent artificial-light implementation stage.

Newly created design scenarios should use Design Format 1.1. Existing Design 1.0 descriptors must remain Design 1.0 unless a future explicit migration operation is introduced.
