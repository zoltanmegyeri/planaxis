# TASK-047: Path-traced daylight calibration and indirect-light validation

## Task Metadata

- **Status:** Ready
- **Created:** 2026-10-13
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-047-description.md`
- **Related tasks:** TASK-044, TASK-045, TASK-046
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0 and 1.1, PlanAxis Material Format 1.0 and 1.1
- **Implementation commits:** —

## Purpose

Correct the insufficient brightness of indirectly lit regions in the accepted path-tracing view. After accepting PBR material support, the human maintainer reported that a large living room with substantial windows remains unrealistically dark outside the direct Sun patch under summer daytime conditions.

The current Sun strength and sky radiance are qualitative appearance values inherited from Interactive rendering. This task establishes a documented daylight scale and validates indirect transport, material energy, and presentation with controlled references and the reported apartment case. Path tracing remains the slower final-rendering option; Interactive/VXGI remains available for navigation.

## Description

The authoritative task definition is the sibling document:

```text
TASK-047-description.md
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

Repository directory:

```text
docs/tasks/TASK-047-path-traced-daylight-calibration/
```

The task is prepared but has not been issued. Execution and human acceptance remain pending.

Physical Sunny, the existing material/glazing subset, and final-rendering usage remain the accepted boundaries. Source calibration and evidence-backed transport corrections are included; arbitrary indirect-light gain, automatic exposure, and performance benchmarking are excluded.
