# TASK-008: Resolve and Validate Apartment SVG References

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-03
- **Issued:** 2026-09-03
- **Completed:** 2026-09-03
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-008-description.md`
- **Related tasks:** TASK-006, TASK-007
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** 334f65f887a382c9b1e4d544c15ff319a29f41bb

## Purpose

Advance the Apartment SVG validation pipeline from schema-valid data with unresolved reference IDs to a reference-valid intermediate representation with typed resolved relationships.

TASK-006 completed schema validation and established `SchemaValidApartmentSvgDocument`. TASK-007 then refactored the validator vocabulary without changing behavior. Reference resolution and referential validation were the next planned architectural stage before geometric and topological validation.

## Description

The authoritative task description is stored in:

`TASK-008-description.md`

The task was formally issued on 2026-09-03 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the Apartment SVG reference-resolution and referential-validation stage in `@planaxis/validator`.

The implementation:

- added a public reference-validation API consuming `SchemaValidApartmentSvgDocument`;
- validates core reference target existence and required semantic kind;
- returns structured `APSVG-REF-*` validation errors for broken and wrong-kind references;
- introduced `ReferenceValidApartmentSvgDocument` and related reference-valid element types with resolved wall and radiator relationships;
- provides a semantic ID index consistent with the reference-valid representation;
- preserves schema-valid exact-decimal values and keeps geometric/topological validation deferred;
- added focused reference-validation tests;
- updated current-state project documentation to reflect completion of the reference-validation stage.

### Verification

No verification failures were reported for the completed implementation.

Command-by-command verification results were not separately provided during task-record finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-008 implementation was accepted for completion.

No implementation issues, deviations, or follow-up items were reported during finalization.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
334f65f887a382c9b1e4d544c15ff319a29f41bb
```

### Commit Messages

```text
feat(validator): resolve Apartment SVG references

Add a reference-validation stage that consumes schema-valid documents,
validates core reference targets and kinds, and returns structured
APSVG-REF errors.

Introduce a reference-valid intermediate representation with resolved
wall and radiator relationships, plus a consistent semantic ID index.
Add focused tests and update current-state documentation.

Task: TASK-008
```

### Supersession

—

## Notes

TASK-008 completed the reference-resolution and referential-validation stage.

The current pipeline is now:

```text
SchemaValidApartmentSvgDocument
    ↓
reference resolution and referential validation
    ↓
ReferenceValidApartmentSvgDocument
    ↓
geometric / topological validation
    ↓
ValidatedApartment2D
```

Geometric and topological validation remain separate future work.
