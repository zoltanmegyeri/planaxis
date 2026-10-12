# TASK-046: Opaque PBR materials and textures for path tracing

## Task Metadata

- **Status:** Ready
- **Created:** 2026-10-12
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-046-description.md`
- **Related tasks:** TASK-044, TASK-045
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0 and 1.1, PlanAxis Material Format 1.0 and 1.1
- **Implementation commits:** —

## Purpose

Extend the accepted path-tracing experiment so apartment finishes can use the existing opaque PBR material assets and texture maps. The human maintainer accepted TASK-044 daylight transport and TASK-045 design-luminaire lighting and identified material support as the next priority.

This task enables textured, glossy, and metallic finishes while retaining Physical Sunny, the current clear-window approximation, and the existing application workflow. Image correctness and convincing apartment materials take priority over rendering speed.

## Description

The authoritative task definition is the sibling document:

```text
TASK-046-description.md
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
docs/tasks/TASK-046-path-traced-pbr-materials-and-textures/
```

The task is prepared but has not been issued. Execution and human acceptance remain pending.

Masked/blended transparency, frosted/tinted glazing, additional weather modes, new material properties, material editing/import UI, and performance benchmarking remain outside this task.
