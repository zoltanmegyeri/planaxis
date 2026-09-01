# TASK-005: Validate Apartment SVG Document Structure and Metadata

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-09-01
- **Issued:** 2026-09-01
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-005-description.md`
- **Related tasks:** TASK-004
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** —

## Purpose

Implement the first Apartment SVG schema-validation stage after the completed XML/SVG parsing boundary.

This task establishes the shared validation-result and error foundation and validates the document-level Apartment SVG 2.1 schema: scalar lexical/value types, the root `<svg>` structure, metadata, and top-level groups.

The task deliberately stops before semantic-element schema validation, reference resolution, geometric validation, and construction of trusted apartment domain models.

## Description

The authoritative task description is stored in:

`TASK-005-description.md`

The description was formally issued on 2026-09-01 and is immutable from this point forward.

## Execution Record

### Result

Pending.

### Verification

Pending.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

Pending.

## Human Review

### Review Status

Pending.

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

TASK-005 begins the Apartment SVG schema-validation phase after TASK-004 established the parsed-but-unvalidated document representation.

The intended validation boundary for this task is limited to:

```text
parsed Apartment SVG document
    ↓
scalar lexical/value validation
    ↓
root document validation
    ↓
metadata validation
    ↓
top-level group validation
```

Semantic-element schemas, document-wide semantic-element ID validation, reference resolution, geometric and topological validation, `ValidatedApartment2D`, and later stages remain intentionally deferred to subsequent tasks.