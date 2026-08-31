# TASK-002: Report Server Port Conflicts at Startup

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-08-31
- **Issued:** 2026-08-31
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-002-description.md`
- **Related tasks:** TASK-001
- **Related ADRs:** ADR-001
- **Related specifications:** —
- **Implementation commits:** —

## Purpose

Improve the PlanAxis server startup experience when the configured HTTP port cannot be bound because another process is already using it.

This task follows a runtime issue discovered during human review of TASK-001: the server failed correctly with a non-zero exit status, but did not provide a sufficiently clear human-readable explanation of the port conflict.

## Description

The authoritative task description is stored in:

`TASK-002-description.md`

The task is currently `Ready` and has not yet been issued.

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

TASK-002 is a focused follow-up to TASK-001.

It addresses the server port-conflict diagnostic identified during TASK-001 human review without expanding into server configuration, automatic port selection, or broader logging changes.