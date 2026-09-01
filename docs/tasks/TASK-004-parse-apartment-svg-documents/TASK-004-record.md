# TASK-004: Parse Apartment SVG Documents

## Task Metadata

- **Status:** Completed
- **Created:** 2026-08-31
- **Issued:** 2026-09-01
- **Completed:** 2026-09-01
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-004-description.md`
- **Related tasks:** TASK-003
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** `3cb886ebe80893167f554f85b566cfc53047bbfa`

## Purpose

Implement the Apartment SVG parsing stage that follows the completed numeric and geometric foundations.

This task establishes the boundary that converts untrusted SVG/XML source text into a project-owned parsed representation suitable for later schema validation while preserving the distinction between XML parsing and Apartment SVG conformance checking.

## Description

The authoritative task description is stored in:

`TASK-004-description.md`

The description was formally issued on 2026-09-01 and remained unchanged after issue.

## Execution Record

### Result

Codex successfully implemented the Apartment SVG XML parsing boundary in `@planaxis/parser`.

The accepted implementation:

- introduced the public `parseApartmentSvg(source: string)` API;
- introduced project-owned immutable parsed XML and Apartment SVG parser result types;
- preserves XML namespaces, namespace declarations, lexical attribute values, metadata CDATA, processing instructions, duplicate structures, unknown structures, and semantic nesting needed by later validation;
- returns typed failures for malformed XML rather than treating malformed user input as an unexpected exception;
- rejects `DOCTYPE` input at the parser security boundary and does not resolve external resources;
- keeps annotation descendants outside the semantic element pipeline;
- keeps numeric-looking attribute values as lexical strings rather than converting them to JavaScript `number` or authoritative decimal values;
- added focused parser tests and parser package test/build configuration;
- added `@xmldom/xmldom` as the XML parsing dependency;
- updated the architecture overview to reflect completion of the Apartment SVG parsing boundary.

During human review, a misleading internal helper name was identified. Codex renamed:

```text
isUnknownRecord
```

to:

```text
isNonNullObject
```

so the helper name accurately describes its behavior. The accepted implementation commit contains the corrected name.

### Verification

The implementation was reported as successfully completed and was accepted after manual human review.

No verification failure was reported during finalization. The exact command-by-command execution transcript was not reproduced in this task-finalization conversation.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The implementation was manually reviewed and found acceptable.

One naming issue was identified during review: the internal helper `isUnknownRecord` was misleading because it actually checked whether a value was a non-null object. Codex agreed and renamed it to `isNonNullObject`.

The corrected name is present in the accepted implementation. No other issues were identified.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

`3cb886ebe80893167f554f85b566cfc53047bbfa`

### Commit Messages

```text
feat(parser): parse Apartment SVG documents

Add a reusable XML parsing boundary with project-owned immutable types.
Preserve namespaces, lexical attributes, metadata CDATA, processing
instructions, duplicate structures, and semantic element nesting.

Return typed failures for malformed XML and reject DTD input without
resolving external resources. Keep annotation descendants outside the
semantic element pipeline.

Task: TASK-004
```

### Supersession

—

## Notes

TASK-004 completes the Apartment SVG parsing phase after the authoritative decimal geometry foundation.

The parser intentionally remains validation-neutral: Apartment SVG schema validation, numeric lexical validation, reference resolution, geometric validation, and construction of trusted domain models remain outside this task.

The review-time rename from `isUnknownRecord` to `isNonNullObject` was a naming correction within the existing task scope and is not considered a deviation from the issued task description.
