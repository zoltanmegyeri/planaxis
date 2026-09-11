# ADR-004: Adopt Filesystem-Backed PlanAxis Projects

- **Status:** Accepted
- **Date:** 2026-09-10

## Context

PlanAxis initially operates as a browser-local single-document application. The user selects
or drops one Apartment SVG file, the browser reads it with the File API, and the existing
shared parser and validation pipeline produces the trusted model used by the 2D and 3D
viewers.

That workflow is appropriate while Apartment SVG is the only user-managed input.

The next development stage expands PlanAxis toward apartment-renovation design and visual
presentation. Planned workflows require project-scoped durable resources such as:

- alternative Apartment SVG layouts;
- PBR materials and texture maps;
- imported GLB/glTF models;
- environment maps;
- webshop product and material photographs;
- design-scenario descriptors;
- generated technical renders;
- AI-generated presentation images;
- disposable derived resources and caches.

PlanAxis deliberately does not intend to become a global asset warehouse. Users are expected
to provide and curate the resources relevant to their own renovation project.

A single independently dropped SVG file therefore no longer provides an adequate persistence,
asset, or authorization boundary.

The existing TypeScript monorepo already contains a Fastify server application. Under
ADR-001, browser and server applications may reuse deterministic shared packages while
environment-specific filesystem, HTTP, and UI concerns remain outside the shared core.
ADR-002 keeps React and browser APIs in `apps/web`. ADR-003 keeps Three.js resources in the
renderer adapter.

A project mechanism must preserve those boundaries and must not turn project metadata into a
second source of architectural geometry.

## Decision

PlanAxis will adopt a **filesystem-backed project model**.

A PlanAxis project is one physical directory conforming to the versioned
**PlanAxis Project Format**. The initial normative specification is:

```text
docs/specifications/planaxis-project/1.0.md
```

The project root is identified by the required manifest:

```text
planaxis.project.json
```

Project Format 1.0 organizes durable architecture, assets, references, designs, and outputs,
plus disposable PlanAxis internal state.

### One project per server process

The initial application model uses exactly one active project per PlanAxis server process.

The project-root path is supplied explicitly when the server is started. The server resolves
and establishes one canonical project root and does not accept arbitrary client-selected
absolute filesystem paths.

Switching projects initially requires restarting PlanAxis with another project root.

A browser-based or desktop `Open Project...` workflow may be added later as a user-interface
layer around the same project-root model. Dynamic project switching is not required by this
decision.

### The server owns project filesystem access

The backend owns access to the physical project directory.

The browser accesses project metadata and project resources through deliberate server APIs
rather than through direct local filesystem ownership.

The project root becomes the server's filesystem authorization boundary.

All project filesystem access must use a centralized project-filesystem abstraction that is
responsible for:

- project-relative path validation;
- canonical filesystem resolution;
- project-root containment;
- symbolic-link policy;
- safe read/write targeting.

Application routes and future asset processors must not independently construct arbitrary
project filesystem paths from client input.

The server must not expose the complete project root as a generic static directory. Project
resources are exposed only through deliberate application endpoints with appropriate
resource semantics.

Disposable `.planaxis/` content is internal and is not served as a generic browser resource.

### Loopback is the safe default

Because the server gains access to local project files, the default network exposure changes
from all interfaces to loopback-only operation.

PlanAxis must bind to a loopback address by default.

Exposure to other hosts or networks, if supported later, requires deliberate configuration
and an appropriate security model.

### Project Format and Apartment SVG remain separate

The PlanAxis project manifest owns project organization and selection, not apartment
geometry.

Apartment SVG remains the canonical source of architectural and geometric truth for each
architectural alternative.

The initial manifest contains only:

```json
{
  "schema": "planaxis-project/1.0",
  "name": "My apartment renovation",
  "architecture": {
    "active": "architecture/existing.svg"
  }
}
```

The manifest does not duplicate Apartment SVG dimensions, geometry, location metadata, or
semantic elements.

Project-format validity and Apartment SVG validity are independent.

A project with a structurally valid manifest and accessible active SVG remains openable even
when the active SVG fails Apartment SVG validation. Existing validation diagnostics remain
the correct mechanism for such failures.

### Browser validation remains reusable

Moving filesystem ownership to the server does not require moving deterministic Apartment
SVG parsing and validation out of the browser.

The browser may continue to consume the shared parser, validator, trusted-domain, 3D-model,
and renderer packages as appropriate.

Server-side use of the same deterministic packages may be added later when a concrete
workflow requires it.

### Portable project-relative references

Durable PlanAxis descriptors use canonical project-relative paths rather than machine-local
absolute paths.

A project is intended to remain portable when its directory tree is copied between supported
systems.

Resource resolution below the canonical project root does not traverse symbolic links in
Project Format 1.0.

### Reserved durable and disposable areas

Project Format 1.0 establishes these top-level roles:

```text
architecture/    Apartment SVG architectural alternatives
assets/          normalized PlanAxis-usable resources
references/      source, product, material, and inspiration references
designs/         durable design-scenario data
outputs/         generated user-valued output
.planaxis/       disposable PlanAxis-owned internal state
```

Only the manifest, `architecture/`, and the active Apartment SVG are required for format
conformance. Other reserved directories may be created when needed.

Deleting `.planaxis/` must never destroy authoritative or otherwise irreplaceable project
information.

### Future formats remain independent

This decision reserves locations for future material, model-asset, and design data but does
not define their internal schemas.

Those concerns will receive separate versioned contracts when implementation requirements
are concrete.

The project format, Apartment SVG format, future material format, future model-asset format,
and future design format evolve independently.

## Rationale

### A project directory matches the real unit of renovation work

Apartment redesign requires many related files whose useful lifetime is longer than one
browser session.

A physical project directory gives architecture, source material, scene assets, design
alternatives, and generated output a clear shared home without requiring a database or a
central PlanAxis asset repository.

### Server-owned filesystem access supports future processing

Later workflows may need to:

- import and normalize textures;
- inspect or transform images;
- create thumbnails;
- import and preprocess 3D models;
- generate renderer output;
- call external AI services;
- persist design scenarios;
- write generated results.

These operations fit naturally behind the Node.js server's filesystem boundary and should
not depend on browser directory-handle capabilities.

### Explicit startup scope provides a strong authorization boundary

Selecting the project root at process startup gives one clear answer to the question:

> Which local files is this PlanAxis instance authorized to operate on?

Restricting resolution to that root is simpler and safer than accepting arbitrary absolute
paths from the browser.

### Project-relative references preserve portability

Absolute paths would couple a project to one workstation and user account.

Project-relative paths allow the complete project to be copied, archived, synchronized,
placed under version control, or moved to another supported system without rewriting
persistent references.

### Project metadata must not compete with Apartment SVG

A project manifest is necessary for organization but must not become a second apartment
model.

Keeping architecture in Apartment SVG preserves the existing validated deterministic
pipeline and avoids synchronization problems between multiple representations of the same
geometry.

### Reserved directories enable incremental development

The broad project areas are already known, but material, model, design, and AI schemas are
not yet mature enough to define responsibly.

Reserving their storage roles now creates a stable project container without introducing
speculative abstractions or prematurely freezing future descriptor contracts.

## Alternatives

### Continue browser-local drag-and-drop

Rejected as the primary future workflow.

It remains simple for one SVG but provides no coherent persistence or asset boundary for
materials, models, references, designs, and generated output.

### Use browser directory-access APIs as the project owner

Not selected for the initial architecture.

Browser filesystem capabilities are browser-specific and do not naturally establish the same
filesystem authority for server-side processing.

They would also move an environment-specific persistence concern into the browser even though
planned asset and AI workflows require backend filesystem access.

### Keep arbitrary external absolute asset paths

Rejected.

Absolute paths reduce portability, complicate security reasoning, and allow project data to
depend on resources outside the explicit project boundary.

### Introduce a database-backed project store

Rejected for the current requirements.

A database would add persistence, migration, backup, export, and synchronization complexity
without a demonstrated need. Human-readable filesystem projects are sufficient and align
with the intended personal renovation workflow.

### Build a global PlanAxis asset warehouse

Rejected.

PlanAxis provides the modeling, rendering, and design foundation. Users curate the materials,
models, and references relevant to their own projects.

A global catalog would introduce a separate product problem and does not solve the immediate
project-persistence requirement.

### Store project organization inside Apartment SVG

Rejected.

Project assets, design alternatives, AI output, and application caches are not apartment
geometry and must not expand Apartment SVG into a general application-container format.

## Consequences

### Positive consequences

- PlanAxis gains a durable top-level project abstraction before material and design features
  are introduced.
- Future assets and scenarios have defined filesystem locations.
- The project directory is naturally understandable, copyable, archivable, and
  version-controllable.
- Apartment SVG remains the canonical architectural representation.
- Server-side processing gains an explicit filesystem scope.
- Project-relative path rules provide a foundation for safe resource APIs.
- The browser no longer needs to own arbitrary local asset access.
- Disposable implementation data has a defined location that cannot become authoritative.
- Future subordinate formats can evolve independently.

### Negative consequences

- The normal web workflow now requires a running PlanAxis backend.
- Startup configuration becomes more complex because a project root must be supplied.
- Filesystem security, path containment, and symlink handling become explicit server
  responsibilities.
- Local asset serving requires deliberate HTTP API design and content handling.
- The application initially supports only one active project per server process.
- Cross-platform filesystem behavior must be considered in tests and project-format
  validation.

### Neutral consequences

- The project root is not a database and provides no built-in collaboration, locking, or
  transactional multi-user semantics.
- Extra non-PlanAxis files may coexist in the project directory without acquiring PlanAxis
  meaning.
- Browser-side Apartment SVG validation may continue unchanged after the SVG is obtained
  through the backend.
- Project switching, project creation UI, asset descriptors, design descriptors, and AI
  workflows remain future work.
- Free-walk collision detection remains independent of this decision.

## Constraints introduced by this decision

Unless superseded by a later accepted ADR:

1. user-facing PlanAxis project operation is based on one explicit physical project root;
2. the initial server process owns exactly one active project;
3. local project filesystem access is owned by the backend, not by arbitrary browser paths;
4. durable project references use the Project Format's project-relative path rules;
5. filesystem access must remain confined to the canonical project root;
6. symbolic links below the canonical project root are not traversed for project resources;
7. the complete project root must not be exposed as an unrestricted static directory;
8. the server binds to loopback by default when serving filesystem-backed projects;
9. Apartment SVG remains the source of architectural and geometric truth;
10. project-format validity and Apartment SVG validity remain separate;
11. `.planaxis/` contains only disposable internal state;
12. future material, model-asset, and design schemas must not be invented as side effects of
    implementing the project container.

## Follow-up work

Implementation should be divided into focused tasks rather than introducing the complete
future design system at once.

Expected near-term work includes:

```text
project-format parsing and validation
project-filesystem boundary
project-root server startup configuration
controlled project APIs and resource serving
browser migration from dropped SVG to the active project architecture
project initialization and richer asset/design workflows later
```

Architecture documentation and user-facing startup instructions should be updated as these
capabilities become implemented rather than describing them as already available.

## References

- [PlanAxis Project Format 1.0](../specifications/planaxis-project/1.0.md)
- [ADR-001](ADR-001-typescript-monorepo.md)
- [ADR-002](ADR-002-react-browser-ui.md)
- [ADR-003](ADR-003-three-renderer-architecture.md)
- [Architecture overview](../architecture/overview.md)
- [Coding guidelines](../development/coding-guidelines.md)
- [Testing guidelines](../development/testing.md)
- [Apartment SVG 2.2](../specifications/apartment-svg/2.2.md)
