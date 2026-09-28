# TASK-037: Serve the Browser Application from the PlanAxis Server

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-09-28
- **Issued:** 2026-09-28
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-037-description.md`
- **Related tasks:** TASK-002, TASK-023, TASK-024
- **Related ADRs:** ADR-001, ADR-002, ADR-004
- **Related specifications:** PlanAxis Project Format 1.0
- **Implementation commits:** —

## Purpose

Replace the current normal two-process browser startup workflow with a single Fastify runtime that serves both the built React application and the existing project APIs on one port.

The Vite development server remains available for frontend development and HMR, but ordinary PlanAxis use should require only one command and one browser URL.

## Description

The authoritative task description is stored in:

`TASK-037-description.md`

The task was formally issued on 2026-09-28 and is now in progress.

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

TASK-037 implements the server-serving direction already anticipated by ADR-001.

The intended normal runtime becomes:

```text
one startup command
    ↓
one Fastify process on 127.0.0.1:3000
    ├── built React application
    ├── /health
    └── /api/...
```

The separate Vite server remains an optional development/HMR tool rather than the normal PlanAxis runtime.
