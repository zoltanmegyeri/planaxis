# TASK-012: Add Apartment SVG Validation CLI

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-05
- **Issued:** 2026-09-05
- **Completed:** 2026-09-05
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-012-description.md`
- **Related tasks:** TASK-004, TASK-010, TASK-011
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** 041dacbc86fa3c5b3b8d00702767c1bc57714415

## Purpose

Add a simple developer-facing command-line entry point for exercising the completed Apartment SVG parsing and validation pipeline against real files.

The task is intentionally inserted after TASK-011 and before the planned 3D-model work so developers can validate Apartment SVG documents directly from the repository and inspect validation failures without building an application UI.

## Description

The authoritative task description is stored in:

`TASK-012-description.md`

The task was formally issued on 2026-09-05 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the developer-facing Apartment SVG validation CLI.

The implementation:

- added a private `@planaxis/cli` Node.js workspace application;
- added the root-level `pnpm validate:svg <path-to-svg>` command;
- reads one Apartment SVG file and runs the existing parser, schema, reference, and geometry validation stages in order;
- reports a concise success message for valid input;
- reports parser and structured validation diagnostics for invalid input;
- preserves all validation errors returned by the failing stage;
- returns non-zero process statuses for invalid documents, usage errors, and file-read failures;
- added focused automated CLI tests;
- updated current-state project documentation for the validation command and CLI application.

### Verification

No verification failures were reported for the completed implementation.

During human review, the CLI was manually exercised with multiple Apartment SVG test files. The observed outputs were correct and matched expectations.

Command-by-command agent verification results were not separately provided during task-record finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-012 implementation was reviewed and accepted without objections.

The CLI was manually tested with multiple Apartment SVG files, and all observed outputs were correct and expected. No implementation problems, issues, deviations, or additional follow-up items were identified.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
041dacbc86fa3c5b3b8d00702767c1bc57714415
```

### Commit Messages

```text
feat(cli): add Apartment SVG validation command

Add a private Node.js CLI that reads one SVG file and runs the
existing parser, schema, reference, and geometry validation stages.

Report complete structured diagnostics with non-zero failure statuses,
add focused CLI coverage, and document the root validation command.

Task: TASK-012
```

### Supersession

—

## Notes

None.
