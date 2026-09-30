# TASK-041: Render Persistent Design Luminaires

## Context

TASK-040 implemented PlanAxis Design Format 1.1 luminaire validation and persistence across `@planaxis/design`, server design writes, and the browser scenario workflow.

Design 1.1 scenarios can now persist renderer-independent `point`, `spot`, `linear`, and `area` luminaires, but those luminaires do not yet affect the 3D scene.

This task implements artificial-light rendering only. The intended workflow is manual editing of Design 1.1 JSON followed by reloading or reselecting the scenario. Interactive luminaire placement and editing remain later work.

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
docs/specifications/planaxis-design/1.1.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Render persistent Design 1.1 luminaires in the existing Three.js apartment scene so manually authored design JSON can be used to evaluate artificial lighting.

Support all four persisted types:

```text
point
spot
linear
area
```

Artificial design luminaires must work in both Studio and Physical lighting modes and remain independent from daylight date/time/weather state.

## Scope

The task includes:

- adapting resolved Design 1.1 luminaire data into a renderer runtime contract without passing persistence/schema objects into `@planaxis/renderer-three`;
- rendering `point` luminaires as point lights;
- rendering `spot` luminaires as spot lights;
- rendering `linear` luminaires as one-sided thin rectangular area lights;
- rendering `area` luminaires as one-sided rectangular area lights;
- applying Design 1.1 model-space position and normative orientation correctly;
- applying luminous flux, enabled state, dimming, and Kelvin white-light color;
- enabling architectural shadows for point and spot luminaires;
- intentionally leaving linear and area luminaires shadowless;
- integrating luminaire replacement and disposal with the renderer lifecycle;
- keeping persistent luminaires active in both Studio and Physical modes;
- adding focused renderer/browser tests;
- updating current-state documentation made inaccurate by completion of this work.

## Out of Scope

This task does **not** include:

- any luminaire UI;
- adding, deleting, moving, rotating, selecting, or editing luminaires;
- dimming or on/off controls;
- 2D/3D luminaire markers or gizmos;
- browser writes of luminaire data;
- fixture meshes or decorative light models;
- IES/photometric profiles;
- RGB/RGBW lighting;
- automatic association with Apartment SVG `ceiling-light` utilities;
- geometric validation or repair of luminaire placement;
- shadows for `linear` or `area` luminaires;
- realtime GI, bloom, path tracing, or later lighting stages;
- changes to Design Format 1.1 normative semantics.

## Functional Requirements

### Runtime boundary

Persistent Design Format descriptors must not become renderer inputs.

Adapt resolved Design 1.1 luminaires in the browser/application layer into a renderer-owned runtime contract containing only rendering-relevant semantic values. Keep Design Format validation in `@planaxis/design`.

### Coordinates and orientation

Use the existing renderer conversion:

```text
100 PlanAxis centimeters = 1 Three.js world unit
(X, Y, Z) -> (X / 100, Z / 100, Y / 100)
```

For `spot`, `linear`, and `area`, interpret `headingDegrees`, `pitchDegrees`, and `rollDegrees` through the normative Design 1.1 orientation frame. Do not reinterpret them as arbitrary Three.js Euler angles.

Convert the resulting PlanAxis `forward`, `rolledSide`, and `rolledVertical` directions through the same PlanAxis → Three.js basis mapping.

### Effective luminous output

For every luminaire:

```text
effectiveLumens =
  enabled
    ? luminousFluxLumens * dimming
    : 0
```

Use Three.js luminous-power properties where available rather than arbitrary brightness multipliers. Disabled or zero-dimmed luminaires must contribute no light.

### Color temperature

Convert `colorTemperatureKelvin` to a deterministic approximate white-light RGB color at the renderer boundary.

The mapping must preserve visible warm / neutral / cool differences, must not add automatic camera white balance, and must not alter persisted values.

### Point luminaires

Map `point` to Three.js point-light semantics.

Requirements:

- use the persisted position and effective lumens;
- use physically appropriate distance attenuation;
- do not add an arbitrary finite range cutoff;
- cast architectural shadows when output is active;
- derive shadow-map resolution from the existing PlanAxis shadow-quality policy;
- release owned light/shadow resources correctly.

### Spot luminaires

Map `spot` to Three.js spot-light semantics.

Requirements:

- use persisted position and normative forward direction;
- use effective lumens;
- convert Design 1.1 `beamAngleDegrees` from full cone angle to Three.js half-angle;
- use a fixed reasonable renderer-owned penumbra/falloff;
- use physically appropriate distance attenuation without an arbitrary cutoff;
- cast architectural shadows when output is active;
- derive shadow-map resolution from the existing quality policy.

### Linear luminaires

Map `linear` to a one-sided rectangular area light with:

```text
long dimension  = lengthCm
minor dimension = 1 cm
```

The fixed **1 cm** minor dimension is the renderer convention for this stage and approximates a practical LED-strip emitter.

Orientation:

```text
long dimension -> rolledSide
minor dimension -> rolledVertical
emission normal -> forward
```

Linear luminaires intentionally cast no shadows in TASK-041. Do not approximate them with multiple point/spot lights.

### Area luminaires

Map `area` to a one-sided rectangular area light.

Orientation:

```text
widthCm  -> rolledSide
heightCm -> rolledVertical
emission normal -> forward
```

Use the persisted dimensions and effective luminous output.

Area luminaires intentionally cast no shadows in TASK-041. Do not replace them with multi-light shadow approximations.

### Studio and Physical modes

Persistent design luminaires are installed artificial lights, independent from base lighting mode.

They must render in:

```text
Studio + design luminaires
Physical + design luminaires
```

Switching Studio ↔ Physical or changing Physical date/time/weather must not alter the artificial luminaire set or output.

No design selected means no persistent design luminaires. Design 1.0 scenarios likewise contribute none.

### Lifecycle

Luminaire objects and shadow resources must follow the existing renderer lifecycle:

- replacing/selecting a design removes obsolete luminaires;
- renderer/model replacement must not leak luminaire resources;
- camera/navigation changes must preserve luminaire state;
- final disposal releases owned light/shadow resources;
- keep rendering event-driven; do not add a persistent animation loop.

## Technical and Architectural Constraints

- Keep persistence/validation in `@planaxis/design`.
- Keep Three.js-specific adaptation in `@planaxis/renderer-three`.
- Use an explicit application/runtime adapter between the two.
- Preserve the existing coordinate/handedness boundary.
- Preserve Studio/Physical daylight behavior.
- Point/spot shadow quality must reuse the existing quality contract; add no new Rendering-panel control.
- Linear/area shadow absence is an accepted temporary limitation and must be documented honestly.
- No new dependency is expected.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/renderer-three/src/
packages/renderer-three/test/
apps/web/src/
apps/web/test/
README.md
AGENTS.md
docs/architecture/overview.md
docs/decisions/ADR-003-three-renderer-architecture.md
```

Update ADR-003 only as a refinement of the established renderer boundary and actual implemented luminaire mapping.

No server or Design Format persistence changes are expected.

## Testing Requirements

Add focused automated coverage for at least:

- browser adaptation of Design 1.1 luminaires into runtime renderer inputs;
- No design / Design 1.0 producing no persistent luminaires;
- enabled/disabled and dimmed effective output;
- representative warm/neutral/cool Kelvin conversion;
- point position/output mapping and shadows;
- spot direction, full-angle → half-angle conversion, and shadows;
- shadow resolution following existing quality settings;
- linear mapping to `lengthCm × 1 cm`;
- linear orientation using rolledSide / rolledVertical / forward;
- area width/height/orientation mapping;
- linear/area remaining shadowless and one-sided;
- luminaires remaining stable across Studio/Physical switches and daylight changes;
- luminaire replacement when selecting another design;
- cleanup/disposal of luminaire and shadow resources;
- camera/navigation changes preserving luminaire state.

Where practical, inspect stable Three.js light properties and scene state without requiring a physical GPU.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Manual Verification

Manually test at least one Design 1.1 scenario authored directly in JSON, preferably containing:

```text
one point or spot luminaire
one linear or area luminaire
```

Verify that:

- the selected design visibly lights the apartment;
- warm/cool Kelvin differences are visible;
- dimming/enabled JSON changes alter output after reload/reselection;
- point/spot lighting is blocked by architectural occluders;
- linear/area illumination is visible with the documented shadow limitation;
- luminaires remain present in both Studio and Physical modes;
- nighttime Physical mode can be used to inspect artificial lighting without daylight.

Do not add UI to facilitate this verification.

## Documentation Requirements

Update current-state documentation to describe artificial-light rendering as implemented and luminaire placement/editing UI as deferred.

Document the mapping:

```text
point  -> point light with shadows
spot   -> spot light with shadows
linear -> rectangular area light, lengthCm × 1 cm, no shadows
area   -> rectangular area light, declared size, no shadows
```

Do not change Design Format 1.1 normative semantics.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused renderer/browser tests as useful.

## Acceptance Criteria

The task is complete when:

1. selected Design 1.1 `point`, `spot`, `linear`, and `area` luminaires visibly affect the 3D scene;
2. persistent design descriptors remain outside the renderer boundary;
3. position/orientation follow Design 1.1 semantics and existing coordinate conversion;
4. enabled state and dimming determine effective luminous output;
5. Kelvin values produce deterministic believable white-light differences;
6. point and spot lights use physically appropriate attenuation and architectural shadows;
7. spot full beam angle maps correctly to the renderer half-angle;
8. linear lights render as one-sided `lengthCm × 1 cm` rectangular emitters with no shadows;
9. area lights render as one-sided declared-size rectangular emitters with no shadows;
10. luminaires operate in both Studio and Physical modes and are unaffected by daylight controls;
11. No design and Design 1.0 scenarios contribute no persistent luminaires;
12. replacement/disposal does not leak luminaire or shadow resources;
13. no luminaire placement/editing UI is added;
14. focused tests, repository verification, and manual rendering verification pass;
15. documentation records the implemented mapping and temporary limitations.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. luminaire type → Three.js mapping;
3. runtime adaptation/lifecycle approach;
4. main files/areas changed;
5. tests added or updated;
6. verification results;
7. manual rendering verification and observed result;
8. deviations from this description, or `None`;
9. follow-up items, or `None`;
10. a suggested Conventional Commits message including:

```text
Task: TASK-041
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
