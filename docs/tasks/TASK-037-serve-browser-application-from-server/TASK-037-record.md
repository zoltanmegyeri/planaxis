# TASK-037: Serve the Browser Application from the PlanAxis Server

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-28
- **Issued:** 2026-09-28
- **Completed:** 2026-09-28
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-037-description.md`
- **Related tasks:** TASK-002, TASK-023, TASK-024
- **Related ADRs:** ADR-001, ADR-002, ADR-004
- **Related specifications:** PlanAxis Project Format 1.0
- **Implementation commits:** 1756018b16ac2111ac74d8a66bf8d1bf72cd4bd4

## Purpose

Replace the current normal two-process browser startup workflow with a single Fastify runtime that serves both the built React application and the existing project APIs on one port.

The Vite development server remains available for frontend development and HMR, but ordinary PlanAxis use should require only one command and one browser URL.

## Description

The authoritative task description is stored in:

`TASK-037-description.md`

The task was formally issued on 2026-09-28 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the single-server PlanAxis runtime workflow.

The implementation:

- added a root `pnpm start -- --project <path>` workflow that builds the server, browser application, and required workspace dependencies before launching Fastify;
- added `@fastify/static` and production browser serving from `apps/web/dist`;
- validates the browser entry document and referenced build assets before normal startup;
- serves `/` and built browser assets from the same Fastify origin as `/health` and the existing project APIs;
- preserves API route precedence and leaves unknown routes as 404 responses without a SPA fallback;
- added `--api-only` server startup for the optional Vite HMR development workflow without requiring a production browser build;
- prints `http://127.0.0.1:3000/` only after successful normal server startup;
- added focused server tests for static serving, build validation, API precedence, startup argument behavior, and URL reporting;
- updated README, AGENTS, and architecture documentation to describe the single-server normal workflow and optional Vite development workflow.

### Verification

The implementation was reported as successful and accepted by the human maintainer.

Exact command-by-command verification results were not separately provided during task-record finalization and are therefore not recorded as PASS here.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-037 implementation was accepted as successful.

The committed changes establish the intended one-command, one-process, one-port normal runtime while retaining Vite HMR through the explicit API-only server mode.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
1756018b16ac2111ac74d8a66bf8d1bf72cd4bd4
```

### Commit Messages

```text
feat(server): serve the browser application from Fastify

Add one-command startup, browser build checks, and API-only development mode.
Cover static serving and startup behavior; update workflow documentation.

Task: TASK-037
```

### Supersession

—

## Notes

TASK-037 completes the transition of normal PlanAxis browser operation from the previous two-process Vite/Fastify workflow to a single Fastify runtime.

The normal workflow is now:

```text
pnpm start -- --project <path>
    ↓
one Fastify process on 127.0.0.1:3000
    ├── built React application
    ├── /health
    └── /api/...
```

Vite remains available as the optional development/HMR workflow by starting the backend with `--api-only`.
