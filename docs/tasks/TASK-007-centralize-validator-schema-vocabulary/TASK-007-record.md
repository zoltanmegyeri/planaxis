# TASK-007: Centralize Apartment SVG Validator Schema Vocabulary

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-03
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-007-description.md`
- **Related tasks:** TASK-006
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** —

## Purpose

Refactor the Apartment SVG validator to reduce duplication of normative schema string literals identified during the human review of TASK-006.

The validator currently repeats canonical Apartment SVG vocabulary such as namespace URIs, group IDs, SVG element names, attribute names, semantic kinds, and enum values across multiple source files. This task introduces a cohesive internal source of truth for appropriate schema vocabulary while preserving all existing validation behavior and public APIs.

The task is a maintainability refactor only. It does not add new Apartment SVG validation rules or advance the processing pipeline beyond the schema-validation state completed by TASK-006.

## Description

The authoritative task description is stored in:

`TASK-007-description.md`

The task is ready for formal delegation but has not yet been issued.

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

TASK-007 originates from a maintainability observation made during human review of TASK-006.

The observation did not represent an implementation defect and did not prevent TASK-006 from being accepted. The refactor is intentionally separated into its own task so the completed semantic-schema implementation remains historically intact.

The intended outcome is:

```text
repeated normative schema literals
    ↓
cohesive internal schema vocabulary constants
    ↓
validator modules reuse canonical definitions
    ↓
unchanged validation behavior and public API
```

This task must not become a generic constants cleanup across the repository. It is limited to Apartment SVG schema vocabulary used by `@planaxis/validator`.
