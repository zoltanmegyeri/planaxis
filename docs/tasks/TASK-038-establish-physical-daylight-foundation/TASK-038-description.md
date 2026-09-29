# TASK-038: Establish the Physical Daylight Foundation

## Context

PlanAxis Phases 0–3 are complete. The roadmap has been reordered so lighting is now Phase 4 and 3D asset importing/placement follows as Phase 5.

The current Three.js renderer uses a generated `RoomEnvironment`, a fixed directional key light, shadow maps, tone mapping, exposure, and runtime quality controls. This is useful neutral visualization infrastructure, but it is not a physical daylight model. The ceiling also currently does not cast shadows, which can allow impossible direct illumination through the apartment from above.

This task implements the first Phase 4 work unit: renderer lighting foundations plus real Sun direction and correct direct-light occlusion. It must preserve the existing visualization workflow as Studio lighting while adding an explicit Physical lighting path.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Establish a clean physical-daylight foundation by:

- upgrading Three.js to the latest stable mutually compatible version;
- introducing renderer-independent runtime solar simulation in a new `@planaxis/simulation` package;
- adding explicit Studio and Physical lighting modes, with Studio as the default;
- driving Physical mode with a geographically correct directional Sun derived from Apartment SVG location/orientation and a runtime instant;
- making walls and the ceiling correctly occlude direct sunlight even when geometry is visually hidden for inspection.

The milestone is correct direct-light geometry, not complete atmospheric lighting.

## Scope

The task includes:

- reviewing and upgrading Three.js and matching typings to the latest stable mutually compatible versions available at implementation time;
- adding `@planaxis/simulation` for renderer-independent runtime simulation logic;
- implementing a deterministic solar-position calculation from latitude, longitude, and an unambiguous instant;
- using Apartment SVG 2.2 `northHeading` semantics to derive the PlanAxis sun direction;
- adding transient `studio` and `physical` lighting modes;
- keeping Studio as the default and preserving the current `RoomEnvironment`-based presentation there;
- making Physical mode available only when the validated Apartment SVG contains `metadata.location`;
- using a runtime instant initialized once from `Date.now()` for this task;
- replacing the arbitrary directional key light in Physical mode with the calculated Sun;
- disabling direct Sun contribution when the calculated Sun is at or below the geometric horizon;
- making ceiling visibility for inspection independent from shadow/light occlusion;
- preserving current material, tone-mapping, exposure, camera, navigation, fullscreen, and quality behavior unless a change is necessary for the lighting-mode boundary;
- adding focused simulation, renderer, and browser tests;
- updating current-state documentation affected by the new lighting architecture.

## Out of Scope

This task does **not** include:

- procedural sky rendering;
- sunrise/sunset, twilight, or night-sky appearance;
- weather or Sunny/Overcast behavior;
- date/time controls or presets;
- time-zone-based civil-time UI;
- persistent simulation state;
- persistent luminaires or PlanAxis Design Format changes;
- artificial-light placement or editing;
- bloom or a new post-processing pipeline;
- realtime global illumination;
- IES photometry;
- path tracing;
- imported 3D assets;
- physically authoritative irradiance, energy, or photometric simulation.

Do not add atmospheric complexity merely to make the Sun model more sophisticated.

## Functional Requirements

### Renderer-independent solar simulation

Create a new shared package:

```text
@planaxis/simulation
```

It must remain independent of React and Three.js.

Provide a small deterministic solar-position API that consumes:

```text
latitude
longitude
unambiguous instant
```

and produces at least:

```text
geographic solar azimuth
solar elevation
```

Use a compact established calculation suitable for architectural visualization, such as NOAA-style solar-position equations or an equivalently simple deterministic implementation.

PlanAxis does not require high-precision astronomical simulation. Practical visual accuracy is sufficient: the Sun should be in the expected direction and elevation for ordinary daylight evaluation.

Requirements:

- no network access;
- no dependence on the machine's local time zone;
- no use of the machine's current time inside the pure calculation;
- deterministic output for explicit inputs;
- no heavyweight astronomy dependency unless a concrete need is demonstrated;
- atmospheric-refraction correction is not required in this task.

Tests must compare representative outputs against trusted reference values with tolerances appropriate to this practical visualization requirement.

### PlanAxis sun direction

Use the normative Apartment SVG 2.2 conversion rather than redefining geographic orientation.

Given:

```text
N = location.northHeading
A = geographic solar azimuth
E = solar elevation
```

derive:

```text
H = normalize360(N + A)

x = cos(E) * cos(H)
y = cos(E) * sin(H)
z = sin(E)
```

with angles evaluated in radians.

This vector points from the apartment toward the Sun. Keep this renderer-independent meaning separate from the Three.js coordinate conversion and directional-light implementation.

### Runtime simulation instant

For this task, the browser may initialize one transient simulation instant from:

```ts
Date.now()
```

The instant is runtime-only and must not be written into Apartment SVG, Design Format, project metadata, browser persistence, or another durable format.

Do not continuously advance the Sun with wall-clock time. Capture the default instant once for the active runtime simulation state and keep it stable until that state is recreated.

Automated tests must inject explicit fixed instants and must never depend on the test machine's current date, time, or time zone.

Date/time editing belongs to a later task.

### Studio and Physical lighting modes

Introduce an explicit transient lighting-mode vocabulary:

```text
studio
physical
```

Studio must be the default.

Expose the mode through the existing browser rendering controls using the smallest UI addition consistent with the current viewport-first design.

#### Studio

Studio must preserve the current neutral visualization behavior, including the existing generated `RoomEnvironment` and arbitrary renderer key light unless an implementation refactor is required to establish the mode boundary.

Existing projects must therefore continue to open with substantially the same default lighting they have today.

#### Physical

Physical mode must:

- be selectable only when the validated apartment contains `metadata.location`;
- use the calculated physical Sun instead of the arbitrary Studio key light;
- not use the Studio `RoomEnvironment` as physical daylight;
- not introduce procedural sky, weather lighting, or fake ambient sky illumination in this task;
- contribute no direct Sun when solar elevation is at or below 0°.

The Physical mode introduced by this task is intentionally incomplete visually. Its purpose is to establish correct Sun direction and direct-light access before diffuse sky/weather lighting is added later.

When `metadata.location` is absent, the Physical option must be disabled/unavailable and the UI must communicate that geographic location/orientation data is required. Do not guess a default latitude, longitude, or north direction and do not add a runtime location override in this task.

Lighting-mode changes must render immediately without rebuilding authoritative architecture or resetting the user's camera/navigation state.

### Direct-light occlusion

Direct sunlight must respect actual architectural geometry.

In particular:

- walls must continue to block sunlight;
- the ceiling must cast shadows and block sunlight;
- direct sunlight must reach interior surfaces only through geometrically valid openings;
- window glass must not create an invented opaque blocker unless already required by its existing material behavior;
- visually hiding or back-face-culling the ceiling for outside/above Inspection viewing must not remove it from shadow/light occlusion.

Preserve the useful Inspection workflow: when viewing the apartment from above/outside, the ceiling should remain visually unobtrusive/hidden as today, while still participating in Sun shadowing.

Do not solve inspection visibility by disabling ceiling shadow casting.

### Three.js upgrade

Update Three.js from the repository's current release to the latest stable mutually compatible release available when the task is executed.

Follow the dependency policy in `docs/development/coding-guidelines.md`:

- check current registry metadata;
- use stable, non-deprecated releases;
- keep `three` and its typings mutually compatible;
- do not use prerelease/canary/`next` versions;
- document a concrete compatibility reason if the absolute latest stable release cannot be used.

Adapt renderer code and tests as necessary for changed Three.js APIs without using the upgrade as an excuse for unrelated refactoring.

## Technical and Architectural Constraints

- `@planaxis/simulation` owns renderer-independent solar/runtime simulation logic.
- `@planaxis/renderer-three` owns Three.js light objects, coordinate adaptation, shadow resources, and GPU-facing behavior.
- `apps/web` owns transient UI selection and the initial `Date.now()` runtime instant.
- Apartment SVG remains the source of permanent latitude, longitude, and `northHeading`.
- Simulation date/time remains runtime state, not architectural or design persistence.
- Do not serialize Three.js classes or renderer settings into persistent formats.
- Preserve WebGPU-first rendering and the supported WebGL2 fallback.
- Preserve the existing event-driven renderer lifecycle; do not introduce a permanent animation loop solely for Sun simulation.
- Preserve existing material and presentation contracts.
- Keep Studio and Physical mode implementation explicit rather than overloading existing environment-intensity or quality settings with a second meaning.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
package.json / pnpm workspace metadata       # if required for the new package
pnpm-lock.yaml
packages/simulation/
packages/renderer-three/
apps/web/
README.md
AGENTS.md
docs/architecture/overview.md
docs/decisions/ADR-003-three-renderer-architecture.md   # only if needed to keep the accepted renderer decision current
```

Use established repository structure and naming where more specific existing locations apply.

No normative Apartment SVG change is expected.

## Testing Requirements

Add focused automated coverage for the new boundaries.

At minimum cover:

- deterministic solar azimuth/elevation for representative fixed latitude/longitude/instant inputs;
- independence from machine local time zone;
- Apartment SVG `northHeading` conversion into the PlanAxis sun vector;
- representative cardinal/orientation cases for that conversion;
- Physical-mode Sun mapping into Three.js coordinates/directional-light behavior;
- no direct Sun when solar elevation is at or below the horizon;
- Studio remaining the default lighting mode;
- Studio preserving its environment/key-light behavior;
- Physical mode not using the Studio `RoomEnvironment`;
- Physical mode being unavailable when `metadata.location` is absent;
- Physical mode being available when required location/orientation fields are present;
- switching modes without resetting camera/navigation or rebuilding the architectural model;
- ceiling geometry remaining visually suitable for above-Inspection viewing while casting shadows;
- renderer lifecycle, model replacement, shadow-quality changes, and disposal continuing to work after the lighting refactor.

Test PlanAxis-owned behavior rather than Three.js internals. Avoid requiring a physical GPU where renderer-facing structures can be tested directly.

Do not weaken existing tests.

## Documentation Requirements

Update current-state documentation to describe:

- lighting as the new Phase 4 direction where roadmap wording is present;
- the distinction between Studio and Physical lighting;
- Studio as the default;
- Physical mode's requirement for Apartment SVG location/orientation;
- the new renderer-independent simulation package;
- the fact that Physical mode in this task provides direct Sun only, with sky/weather and richer daylight still deferred;
- ceiling visibility and light-occlusion separation.

Keep accepted-but-not-yet-implemented features clearly identified as future work.

Do not change normative Apartment SVG semantics.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused simulation, renderer, and browser tests during development as useful.

Perform a browser smoke check with:

1. an Apartment SVG containing valid location/orientation metadata, confirming Studio is the default and Physical can be selected;
2. an Apartment SVG without location metadata, confirming Physical is disabled/unavailable;
3. an above-Inspection view, confirming the ceiling remains visually suitable for inspection;
4. a fixed-input automated/diagnostic daylight case confirming the same ceiling still blocks direct Sun rather than allowing light through from above.

The smoke check is qualitative; automated fixed-input tests remain authoritative for deterministic solar-position behavior.

## Acceptance Criteria

The task is complete when:

1. Three.js and its typings use the latest stable mutually compatible versions available at implementation time, or a concrete compatibility exception is documented;
2. `@planaxis/simulation` provides deterministic renderer-independent solar-position calculation without network or local-time-zone dependence;
3. the browser has explicit Studio and Physical lighting modes, with Studio as the default;
4. Physical mode is unavailable when Apartment SVG location/orientation data is absent and no geographic data is guessed;
5. the initial Physical simulation instant is transient and initialized from `Date.now()` without persistence or continuous wall-clock updates;
6. Physical mode drives a directional Sun from Apartment SVG location, `northHeading`, and the simulation instant;
7. direct Sun is disabled at or below the geometric horizon;
8. Physical mode does not use the Studio `RoomEnvironment` or introduce deferred sky/weather lighting;
9. the ceiling and walls correctly occlude direct sunlight while above-Inspection visibility remains usable;
10. direct sunlight reaches interiors only through geometrically valid openings;
11. existing Studio rendering, materials, presentation settings, navigation, fullscreen, quality behavior, and renderer lifecycle remain compatible;
12. focused automated tests, repository verification, and the requested smoke checks pass;
13. current-state documentation accurately describes the resulting lighting foundation and deferred features.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. selected Three.js and typings versions, including compatibility notes if applicable;
3. main files/areas changed;
4. tests added or updated;
5. verification commands and results;
6. browser smoke-check results;
7. deviations from this description, or `None`;
8. follow-up items, or `None`;
9. a suggested Conventional Commits message including:

```text
Task: TASK-038
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
