# TASK-006: Validate Apartment SVG Semantic Element Schemas

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-09-01
- **Issued:** 2026-09-02
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-006-description.md`
- **Related tasks:** TASK-005
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** —

## Purpose

Complete the Apartment SVG 2.1 schema-validation phase after TASK-005 established document-level validation for the root structure, metadata, top-level groups, scalar values, and structured validation errors.

This task validates the schemas of all core semantic elements and produces a typed schema-valid intermediate representation with exact decimal values and unresolved reference IDs for the subsequent reference-resolution stage.

The task deliberately stops before resolving references, enforcing geometric or topological invariants, or constructing `ValidatedApartment2D`.

## Description

The authoritative task description is stored in:

`TASK-006-description.md`

The description was formally issued on 2026-09-02 and is immutable from this point forward.

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

TASK-006 is intended to complete the schema-validation phase established by TASK-005.

The intended validation and transformation boundary is:

```text
ParsedApartmentSvgDocument
    ↓
document-level schema validation
    ↓
semantic-element schema validation
    ↓
SchemaValidApartmentSvgDocument
    ↓
reference resolution
```

The schema-valid intermediate representation is trusted only for schema conformance. It contains typed exact-decimal values, validated enums and strings, unique core semantic IDs, and unresolved reference ID strings.

Reference target existence and kind, geometric and topological validation, `ValidatedApartment2D`, and later stages remain intentionally deferred to subsequent tasks.
