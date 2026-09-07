# TASK-017: Implement the Initial Browser Application and 2D SVG Workflow

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-07
- **Issued:** 2026-09-07
- **Completed:** 2026-09-07
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-017-description.md`
- **Related tasks:** TASK-016
- **Related ADRs:** ADR-001, ADR-002
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** 33104318a3837a1488fb6641bb132778a8ef5cf4

## Purpose

Introduce the first user-facing PlanAxis browser workflow now that the deterministic pipeline can construct `ArchitecturalModel3D` from a valid Apartment SVG.

The task replaces the placeholder web application with a usable full-window interface for loading an Apartment SVG, validating it locally, inspecting validation problems, and viewing the original SVG as a read-only 2D floor plan.

## Description

The authoritative task description is stored in:

`TASK-017-description.md`

The task was formally issued on 2026-09-07 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the first user-facing PlanAxis browser workflow in `apps/web`.

The implementation:

- adopted React with Vite for the browser application and documented the decision in ADR-002;
- added local SVG file loading through file selection and drag-and-drop;
- runs the existing parser, schema, reference, and geometry validation stages in the browser and constructs `ValidatedApartment2D` for valid input;
- presents document status and structured parser/validation diagnostics;
- displays uploaded SVG files in a safe read-only image context;
- added pan, zoom, fit/reset, keyboard, and touch-oriented 2D viewport interaction;
- handles document replacement and preview resource lifecycle;
- added focused web tests and the root-level `pnpm dev:web` command;
- updated README, AGENTS, and architecture documentation for the new browser entry point.

### Verification

No verification failures were reported for the accepted implementation.

Command-by-command verification results were not separately provided during task-record finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-017 implementation was reviewed as successful and accepted for completion.

No additional implementation issues or follow-up items were reported during finalization.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
33104318a3837a1488fb6641bb132778a8ef5cf4
```

### Commit Messages

```text
feat(web): add local SVG validation and 2D viewer

Implement the React workspace with local file loading, diagnostics,
safe pan/zoom previews, and focused tests. Document React adoption.

Task: TASK-017
```

### Supersession

—

## Notes

TASK-017 established the first official user-facing PlanAxis browser application.

The browser can now load and validate Apartment SVG 2.2 files locally and display them in a safe read-only 2D viewer. Three.js renderer adaptation, `ArchitecturalModel3D` consumption, 3D view switching, cameras, free-walk navigation, lighting, and AI features remain later work.
