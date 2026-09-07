# ADR-002: Adopt React for the Browser UI

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

PlanAxis needs its first official user-facing entry point: a browser application for
local Apartment SVG loading, validation feedback, and read-only 2D viewing. The UI must
coordinate asynchronous file reads, trusted validation results, collapsible diagnostics,
and interactive viewing without coupling those concerns to deterministic domain packages.
Vite is already the browser build tool under ADR-001.

## Decision

Use React and React DOM with the standard Vite React plugin in `apps/web`.
Keep explicit component and hook state; introduce no router, global state library,
component library, CSS framework, or React-specific rendering abstraction.

The browser composes the existing parser, schema, reference, geometry, and trusted 2D
model builder APIs. It never duplicates validation rules. React, DOM events, File API,
blob URLs, and viewport transforms remain application concerns. Shared packages retain
renderer-independent types and exact-decimal geometry.

The original SVG is shown using a blob-backed `<img>`, independently of its validation
status. No uploaded markup is inserted into the application DOM. The application owns
URL cleanup and ignores superseded file reads. Native pointer events support desktop
pan and touch pinch/zoom; keyboard controls provide another navigation path.

`pnpm dev:web` builds the shared dependencies and starts Vite. Three.js adaptation and
3D visualization remain the next development stage, outside this decision's initial workflow.

## Alternatives

- **Vanilla TypeScript and DOM:** smallest dependency set, but increasingly manual
  synchronization of document, diagnostic, and resource lifecycle state.
- **Vue or Svelte:** viable component frameworks, but offer no concrete advantage for
  this task sufficient to prefer them over React's explicit component composition.
- **A larger application framework:** routing and server rendering are unnecessary for
  the current local, single-document application and would widen the architecture.

## Consequences

React supplies declarative rendering and component lifecycle boundaries for the evolving
workspace. Tests use Vitest with Happy DOM to exercise application behavior without a
server, WebGL, or end-to-end infrastructure. The shared Vitest catalog moves to the current
stable version so application and core tests use one version.

The application gains React runtime and type dependencies. Resource effects must remain
safe under repeated setup/cleanup, and asynchronous replacement must be guarded explicitly.
Validation currently runs synchronously after the asynchronous file read; unusually large
inputs can occupy the main thread. A worker boundary may be evaluated if measured usage
requires it. SVG image rendering remains separate from semantic interpretation.

## References

- [ADR-001](ADR-001-typescript-monorepo.md)
- [Architecture overview](../architecture/overview.md)
- [Coding guidelines](../development/coding-guidelines.md)
- [Apartment SVG 2.2](../specifications/apartment-svg/2.2.md)
