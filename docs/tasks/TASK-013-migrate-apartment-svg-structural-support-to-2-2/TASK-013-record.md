# TASK-013: Migrate Apartment SVG Structural Support to 2.2

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-06
- **Issued:** 2026-09-06
- **Completed:** 2026-09-06
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-013-description.md`
- **Related tasks:** TASK-004, TASK-006, TASK-008
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** 15e58d9155c7dbac19ef3dc30d435874a603a92e

## Purpose

Migrate the structural and typed validation foundations from Apartment SVG 2.1 to the newly finalized Apartment SVG 2.2 specification before implementing the new geometric and 3D semantics.

This task establishes the mandatory footprint and versioned 2.2 schema/reference representation while intentionally leaving footprint geometry, footprint containment, level-relative Z behavior, and full `ValidatedApartment2D` alignment for follow-up work.

## Description

The authoritative task description is stored in:

`TASK-013-description.md`

The task was formally issued on 2026-09-06 and remained immutable throughout execution.

## Execution Record

### Result

Codex completed the Apartment SVG 2.2 structural migration.

The implementation:

- migrated the supported root and metadata schema identifiers from 2.1 to 2.2;
- added the mandatory `footprint` group and footprint semantic kind to schema validation;
- validates exactly one footprint polygon and its schema-level attributes and coordinate-list syntax;
- preserves exact-decimal footprint points through schema-valid and reference-valid representations and their semantic ID indexes;
- preserves existing reference semantics while ensuring the footprint does not become a valid wall or radiator reference target;
- migrated affected fixtures and tests to Apartment SVG 2.2;
- updated current-state documentation to describe the remaining geometric, containment, Z-semantics, and domain-model migration work.

The task preserved the intended stage boundary: full footprint geometry, footprint containment, level-relative Z behavior, and `ValidatedApartment2D` footprint support remain outside TASK-013.

### Verification

The implementation was reported as successful.

Command-by-command agent verification results were not separately provided during task-record finalization.

### Deviations from Description

None reported.

### Agent-Reported Follow-up Items

None reported beyond the explicitly deferred Apartment SVG 2.2 migration work already identified in the task description.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-013 implementation was accepted as successfully completed.

No additional human-review findings were provided during task-record finalization.

### Human Changes After Agent Execution

None reported.

## Finalization

### Implementation Commits

```text
15e58d9155c7dbac19ef3dc30d435874a603a92e
```

### Commit Messages

```text
feat(validator)!: migrate structural Apartment SVG support to 2.2

Validate the mandatory footprint polygon and preserve its exact-decimal
points through schema and reference validation with consistent ID indexes.
Reuse polygon coordinate parsing and retain existing reference rules.

Migrate metadata, fixtures, and tests to 2.2 and document the remaining
geometry, containment, Z-semantics, and domain-model migration work.

BREAKING CHANGE: Apartment SVG 2.1 identifiers are rejected; 2.2 documents
must include exactly one footprint polygon in the required footprint group.

Task: TASK-013
```

### Supersession

—

## Notes

This task completed the structural/schema/reference portion of the staged Apartment SVG 2.2 migration. Full 2.2 geometric, containment, Z-coordinate, and `ValidatedApartment2D` alignment remains follow-up work before renderer-independent 3D model construction.
