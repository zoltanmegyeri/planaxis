# TASK-032: Add Server Material Resource APIs

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-23
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-032-description.md`
- **Related tasks:** TASK-031
- **Related ADRs:** ADR-004
- **Related specifications:** PlanAxis Material Format 1.0, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0
- **Implementation commits:** —

## Purpose

Add the controlled read-only server resource boundary required for Phase 3 material loading.

TASK-031 established the pure Material Format 1.0 contract. This task makes explicitly referenced material descriptors and supported texture files safely readable from the selected project while keeping parsing, decoding, browser orchestration, and rendering separate.

## Description

The authoritative task description is stored in:

`TASK-032-description.md`

The description is finalized for delegation while this task remains in `Ready`.

## Execution Record

### Result

Pending.

### Verification

Pending.

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

TASK-032 is the second implementation task of Phase 3.

It intentionally provides only controlled raw material-resource reads. Browser material resolution, texture decoding, runtime PBR adaptation, and persistent rendering remain for TASK-033.
