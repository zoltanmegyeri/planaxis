# TASK-045: Path-traced design luminaires

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-10-11
- **Issued:** 2026-10-11
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-045-description.md`
- **Related tasks:** TASK-043, TASK-044
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0 and 1.1, PlanAxis Material Format 1.1
- **Implementation commits:** —

## Purpose

Continue the accepted daylight path-tracing experiment by rendering the artificial lights already defined by PlanAxis Design Format 1.1. The human maintainer tested TASK-044 in several scenarios and found its images substantially more convincing than the current VXGI output.

This task evaluates point, spot, linear, and area light transport, including indirect illumination from a concealed LED strip, within the existing experimental rendering view. Image correctness and convincing apartment lighting take priority over rendering speed.

## Description

The authoritative task definition is the sibling document:

```text
TASK-045-description.md
```

It defines the complete delegated scope, required reading, implementation constraints, verification, and acceptance criteria. The description is finalized for delegation and must remain unchanged after issue.

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

Pending.

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

Intended repository directory:

```text
docs/tasks/TASK-045-path-traced-design-luminaires/
```

The task was issued to Codex on 2026-10-11. Execution and human acceptance remain pending; the issued task description is immutable.

The accepted scope retains the current Physical Sunny, matte-finish, and thin-clear-pane subset. Luminaire editing, fixture models, broader material support, and performance benchmarking remain outside this task.
