# TASK-005: Validate Apartment SVG Document Structure and Metadata

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-01
- **Issued:** 2026-09-01
- **Completed:** 2026-09-01
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-005-description.md`
- **Related tasks:** TASK-004
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** 5c9ac1d2119032fbd74ae0a9282f1bfc8e4961d4

## Purpose

Implement the first Apartment SVG schema-validation stage after the completed XML/SVG parsing boundary.

This task establishes the shared validation-result and error foundation and validates the document-level Apartment SVG 2.1 schema: scalar lexical/value types, the root `<svg>` structure, metadata, and top-level groups.

The task deliberately stops before semantic-element schema validation, reference resolution, geometric validation, and construction of trusted apartment domain models.

## Description

The authoritative task description is stored in:

`TASK-005-description.md`

The description was formally issued on 2026-09-01 and remained immutable throughout execution.

## Execution Record

### Result

Codex completed the document-level Apartment SVG schema-validation slice in `@planaxis/validator`.

The implementation included:

- a stage-specific document-schema validation API consuming the parser-owned `ParsedApartmentSvgDocument`;
- reusable Apartment SVG scalar lexical and value validation;
- structured `APSVG-*` validation errors;
- root element, namespace, schema-attribute, and `viewBox` validation;
- metadata multiplicity, CDATA/JSON form, required structure, and value validation;
- lossless preservation of metadata numeric lexemes for exact-decimal conversion;
- optional location and offline IANA time-zone validation;
- required top-level group validation;
- permitted root-level element and extension-group handling;
- applicable core-group transform restrictions;
- focused valid and invalid fixtures;
- automated validator tests;
- required validator package configuration and dependencies;
- current-state repository documentation updates.

Semantic-element schema validation, reference resolution, geometric and topological validation, and trusted apartment-domain-model construction remained outside the implementation.

### Verification

The task was completed without reported verification failures.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-005 implementation was reviewed after Codex completed the work.

No problems or observations requiring correction were identified during human review.

The implementation was accepted as conforming to the intended TASK-005 scope and architectural boundary.

No follow-up items were identified.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
5c9ac1d2119032fbd74ae0a9282f1bfc8e4961d4
```

### Commit Messages

```text
feat(validator): validate Apartment SVG document schema

Add stage-specific validation for root attributes, viewBox, metadata,
required top-level groups, and reusable Apartment SVG scalar types.

Preserve metadata numeric lexemes for exact-decimal conversion, validate
IANA time zones offline, and return structured APSVG validation errors.
Keep semantic-element, reference, and geometric validation out of scope.

Add focused tests, fixtures, dependencies, package configuration, and
current-state documentation.

Task: TASK-005
```

### Supersession

—

## Notes

TASK-005 completed the first Apartment SVG schema-validation slice after TASK-004 established the parsed-but-unvalidated document representation.

The implemented validation boundary is:

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