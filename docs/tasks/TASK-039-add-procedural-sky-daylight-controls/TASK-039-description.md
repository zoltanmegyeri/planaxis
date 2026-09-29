# TASK-039: Add Procedural Sky and Daylight Simulation Controls

## Context

TASK-038 established the first Phase 4 lighting foundation:

- renderer-independent solar position in `@planaxis/simulation`;
- explicit Studio and Physical lighting modes;
- Studio as the default;
- Physical mode gated by Apartment SVG geographic location/orientation;
- a transient runtime instant initialized from `Date.now()`;
- a geographically oriented directional Sun;
- correct architectural direct-light occlusion, including a shadow-casting ceiling.

Physical mode intentionally provides direct Sun only, so the exterior remains visually incomplete and interiors can be dark.

This task adds the next daylight layer: a procedural sky, explicit transient date/time and weather controls, believable daylight color changes, and simple Sunny/Overcast behavior. It must remain lightweight and visually plausible rather than becoming a high-precision atmospheric simulator.

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

Extend Physical lighting so a user can choose a transient date, time, and weather condition and see a coherent daylight result:

- the existing astronomical Sun moves accordingly;
- direct Sun color and strength change believably with solar elevation and weather;
- the visible exterior sky follows the same Sun and transitions through day, sunset/twilight, and night;
- Sunny and Overcast produce clearly different lighting and shadow character;
- switching to Studio and back restores the previous Physical simulation settings.

No simulation settings are persisted.

## Scope

The task includes:

- extending `@planaxis/simulation` with renderer-independent daylight/weather semantics needed by this task;
- adding exactly two weather conditions: `sunny` and `overcast`;
- keeping `sunny` as the initial default;
- adding transient Physical-mode date, time, and weather controls to the existing Rendering panel, with stacked horizontal date and time sliders;
- interpreting civil date/time using Apartment SVG `location.timeZone` when present;
- using an explicitly labeled UTC representation when `timeZone` is absent rather than guessing a local time zone;
- updating the existing runtime instant when the user edits date/time;
- rendering a procedural physical sky using the installed Three.js release's stable sky facility or an equivalent renderer-owned implementation;
- driving sky appearance from the same solar direction used by the direct Sun;
- implementing simple day, low-Sun/sunset, twilight, and night appearance;
- varying direct Sun color and strength with solar elevation;
- applying a cooler overcast character;
- making Overcast direct Sun very weak with faint, substantially softened shadows;
- preserving Physical date/time/weather state when switching to Studio and back;
- keeping all simulation controls transient and non-persistent;
- preserving TASK-038's Studio behavior and Physical-location requirement;
- adding focused simulation, renderer, and browser tests;
- updating current-state documentation affected by the completed daylight stage.

## Out of Scope

This task does **not** include:

- realtime global illumination or bounced sky light;
- pretending that the procedural sky is an environment map that illuminates through opaque architecture;
- volumetric or modeled clouds;
- cloud coverage percentages or additional weather states;
- precipitation, fog, humidity, visibility, air quality, or live weather APIs;
- Moon, stars, Milky Way, city lights, or astronomical night-sky simulation;
- high-precision atmospheric spectral rendering;
- high-precision solar-position changes or atmospheric-refraction work;
- automatic camera white balance or photographic white-balance controls;
- persistent date/time/weather settings in Design Format, Project Format, Apartment SVG, browser storage, URLs, or any other durable state;
- artificial luminaires;
- bloom or a new post-processing pipeline;
- IES photometry;
- path tracing.

Dark interiors under overcast or sky-only conditions are acceptable until later GI work.

## Functional Requirements

### Physical simulation state

Physical lighting must have transient simulation state containing at least:

```text
instant
weather
```

where weather is exactly:

```text
sunny
overcast
```

Sunny is the default.

The initial instant may continue to be captured once from `Date.now()` for the loaded browser session/view state. It must not advance continuously with wall-clock time.

Editing date or time updates the unambiguous simulation instant and immediately updates Physical lighting without rebuilding the authoritative architectural model or resetting camera/navigation state.

Simulation state must remain in memory only. Do not persist it anywhere.

### Date and time controls

Expose date and time controls when Physical lighting is active.

Use two horizontal sliders stacked vertically in this order:

```text
Date
Time
```

The sliders are intended for rapid interactive daylight exploration, so dragging either slider must update the physical Sun/sky continuously through ordinary control-change events without requiring a separate Apply action.

#### Date slider

The date control must be a horizontal slider covering every calendar day from January 1 through December 31 of the **current year**.

Requirements:

- the user selects month/day only; there is no separate editable year control;
- the effective year is the current year captured for the transient simulation session;
- the slider must account for whether that current year is a leap year;
- the full currently selected date, including year, must be visibly displayed adjacent to the slider;
- choose a concise, unambiguous display format consistent with the rest of the UI.

Changing the date must preserve the selected time of day.

#### Time slider

The time control must be a horizontal slider spanning the complete civil day:

```text
00:00 through 23:59
```

Use one-minute resolution so every minute of the day is selectable.

The current selected time must be visibly displayed adjacent to the slider in 24-hour `HH:MM` form.

Changing the time must preserve the selected calendar date.

#### Civil-time basis

The controls must clearly communicate the civil-time basis being edited:

- when `metadata.location.timeZone` exists, display and interpret the selected date/time in that declared time zone;
- when it is absent, display and interpret the controls in explicitly labeled UTC.

Do not use or infer the browser/machine local time zone as a substitute for missing Apartment SVG time-zone metadata.

Conversion between the slider values and the runtime instant must be deterministic and independent of the machine local time zone. Handle daylight-saving transition edge cases explicitly rather than silently falling back to machine-local interpretation.

Changing either slider must update the existing solar calculation through an explicit instant; do not introduce a second solar-position implementation.

### Weather controls

Expose one weather control with exactly:

```text
Sunny
Overcast
```

Do not add hidden intermediate weather values.

#### Sunny

Sunny must provide:

- the existing physical directional Sun;
- a clear procedural daylight sky;
- strong directional contrast when the Sun is above the horizon;
- comparatively crisp Sun shadows, subject to the existing renderer quality/shadow settings;
- warm low-Sun coloration and more neutral high-Sun coloration.

#### Overcast

Overcast must provide:

- a bright low-contrast gray/white or blue-gray procedural sky during daytime;
- very weak direct Sun rather than a harsh clear-sky Sun;
- faint direct shadows that are substantially softer/blurred than Sunny shadows;
- cooler overall daylight coloration than comparable Sunny daylight.

The exact artistic constants are renderer-owned and may be tuned for believable visualization. Do not attempt cloud or meteorological simulation.

Overcast shadow softening must work with both supported rendering backends using a technique supported by the current Three.js release. It must not require path tracing.

### Sun color and strength

The directional Sun must no longer remain constant white throughout the day.

Use a simple deterministic approximation based primarily on solar elevation, with weather modifying the result.

The intended visual behavior is approximately:

```text
high clear Sun         -> neutral daylight, roughly 5200–6000 K character
lower clear Sun        -> progressively warmer/yellower
near-horizon clear Sun -> warm orange/red, roughly 2200–3500 K character
overcast daylight      -> cooler character, roughly 6500–7500 K overall
```

These ranges express the desired visual character, not precision requirements. A smooth interpolation or similarly simple mapping is sufficient.

Direct Sun strength should also fall toward the horizon and remain zero when the Sun is at or below the geometric horizon, preserving TASK-038 behavior.

Do not add automatic camera white balance. The renderer/viewing response should remain fixed so the changing illuminant color is visible in the apartment.

### Procedural sky

Physical mode must show a procedural sky as visible exterior scenery:

- visible when looking outside or through windows;
- driven by the same solar direction and simulation state as direct Sun;
- clear/blue during ordinary Sunny daytime;
- warmer near the Sun/horizon as solar elevation falls;
- transitioned through a simple twilight state after sunset;
- very dark blue/near-black at night;
- visibly overcast under Overcast weather.

Use the installed Three.js release's stable procedural-sky facility where suitable, wrapped behind PlanAxis renderer code. An equivalent renderer-owned procedural implementation is acceptable if it better supports the required Sunny/Overcast behavior.

Do not expose Three.js-specific sky types outside `@planaxis/renderer-three`.

The sky must not cast shadows, participate in architectural picking, or become persistent project content.

### Visible sky is not global illumination

Keep the distinction between visible sky and light transport explicit.

In Physical mode:

- the procedural sky may be visible as background/exterior scenery;
- `scene.environment` or an equivalent global image-based-light shortcut must not be used to make the sky illuminate interiors through opaque walls;
- weather may affect direct Sun intensity/color/shadow character;
- physically plausible diffuse sky transport into interiors remains deferred to the later realtime-GI task.

It is acceptable for interiors to remain noticeably dark, especially under Overcast conditions or when no direct Sun enters through an opening.

### Day, twilight, and night

Use solar elevation to produce a simple continuous transition.

At minimum:

- normal daytime must look like daylight;
- low Sun must produce warmer Sun/sky coloration;
- after sunset, direct Sun remains disabled;
- twilight must transition toward a dark exterior rather than jumping immediately to black;
- sufficiently deep night must be very dark blue/near-black.

No Moon or stars are required.

The exact thresholds and interpolation curves are implementation details; prefer smooth transitions over many hard-coded presentation modes.

### Studio/Physical mode behavior

Studio remains independent from the physical simulation.

While Studio is selected:

- Studio lighting must retain its current neutral environment/key-light behavior;
- date/time/weather controls may be hidden or disabled;
- changing Studio presentation settings must not overwrite Physical simulation state.

Switching:

```text
Physical -> Studio -> Physical
```

must restore the previous Physical:

```text
date
time
weather
```

and the corresponding Sun/sky state.

The state should also survive ordinary camera, navigation, fullscreen, rendering-panel, and 2D/3D workspace interactions within the loaded browser session where the existing application state model reasonably permits. A page/project reload may initialize a fresh transient state.

Physical mode must remain unavailable when Apartment SVG geographic location/orientation is absent.

## Technical and Architectural Constraints

- `@planaxis/simulation` owns renderer-independent time/weather/daylight semantics and deterministic derivation that is not tied to Three.js.
- `@planaxis/renderer-three` owns Three.js sky objects/shaders, renderer color conversion, light objects, shadow implementation, and GPU-facing details.
- `apps/web` owns transient controls and browser-session simulation state.
- Reuse TASK-038's `calculateSolarPosition` and `planaxisSunDirection`; do not fork solar math.
- Apartment SVG remains the source of permanent geographic location, north orientation, and optional time-zone metadata.
- Date/time/weather remain runtime conditions and must not enter persistent architecture or design contracts.
- Do not place Three.js types in `@planaxis/simulation`.
- Preserve WebGPU-first rendering and the supported WebGL2 fallback.
- Preserve the event-driven renderer lifecycle; update rendering on state changes rather than adding a permanent animation loop.
- Preserve existing Studio presentation, materials, tone mapping, exposure, quality controls, camera state, navigation, and fullscreen behavior.
- Keep the approximation intentionally simple and tune for believable apartment visualization rather than physical or meteorological precision.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/simulation/
packages/renderer-three/
apps/web/
README.md
AGENTS.md
docs/architecture/overview.md
docs/decisions/ADR-003-three-renderer-architecture.md   # only if accepted renderer details need updating
pnpm-lock.yaml                                         # only if dependency metadata changes
```

No normative Apartment SVG, Project Format, Design Format, or Material Format change is expected.

Avoid adding a time-zone or atmospheric dependency unless it materially simplifies a correct, deterministic implementation and complies with repository dependency policy.

## Testing Requirements

Add focused automated coverage for the new behavior.

At minimum verify:

- Sunny is the default weather condition;
- date/time conversion with declared `metadata.location.timeZone` is deterministic and independent of machine local time zone;
- missing `timeZone` uses explicitly labeled UTC rather than browser local time;
- the date slider spans January 1 through December 31 of the current year, including leap-day handling when applicable;
- the time slider spans `00:00` through `23:59` with one-minute resolution;
- moving the date slider preserves time, and moving the time slider preserves date;
- the selected full date and `HH:MM` time are visibly exposed by the browser controls;
- fixed date/time inputs produce the expected updated solar position/direction through the existing solar API;
- elevation-dependent Sun coloration is warmer near the horizon than at high elevation;
- high-Sun Sunny coloration remains approximately neutral daylight;
- Overcast produces a cooler and much weaker direct-light configuration than Sunny;
- direct Sun remains disabled at or below the horizon;
- daylight/twilight/night state transitions are deterministic for representative solar elevations;
- Physical mode creates/updates the procedural sky without enabling Studio `RoomEnvironment`/global environment lighting;
- Sunny and Overcast configure materially different Sun/shadow behavior;
- overcast shadow configuration is softer than Sunny without changing architectural occlusion;
- switching Physical -> Studio -> Physical restores the previous date/time/weather;
- Studio behavior remains compatible and independent;
- camera/navigation state is not reset by simulation edits;
- sky/light resources update and dispose correctly through renderer lifecycle/model replacement;
- Physical remains unavailable without required location/orientation metadata.

Prefer testing PlanAxis-owned derived state/configuration rather than fragile pixel comparisons or Three.js internals. Add a focused visual/manual smoke check for sky appearance and shadow softness.

Do not weaken existing tests.

## Documentation Requirements

Update current-state documentation to describe:

- Physical date/time/weather controls;
- Sunny and Overcast semantics;
- procedural day/twilight/night sky behavior;
- elevation/weather-dependent Sun coloration;
- transient, non-persistent simulation state;
- Studio/Physical state separation and restoration;
- the current limitation that visible sky is not yet realtime GI and interiors may remain dark.

Keep later GI, bloom, IES, path tracing, and richer atmospheric effects clearly identified as future work.

Do not change normative Apartment SVG semantics.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also perform a browser smoke check with an Apartment SVG containing valid location/orientation data:

1. enter Physical mode and confirm Sunny is the default;
2. drag the date and time sliders and confirm Sun position and sky update immediately, with the displayed full date and `HH:MM` time tracking the controls;
3. compare high-Sun daylight with a near-sunrise/sunset time and confirm the direct Sun becomes visibly warmer;
4. confirm sunset transitions through twilight to a very dark night sky with no direct Sun;
5. switch to Overcast and confirm the sky becomes low-contrast/cooler, direct Sun becomes very weak, and remaining shadows are faint and noticeably softer than Sunny;
6. switch Physical -> Studio -> Physical and confirm the chosen date/time/weather are restored;
7. confirm exterior sky is visible through windows while opaque architecture still blocks direct Sun;
8. confirm the application remains usable with the expected temporary limitation that diffuse sky GI is not yet implemented.

## Acceptance Criteria

The task is complete when:

1. Physical lighting exposes transient date, time, and exactly Sunny/Overcast weather controls;
2. date and time are edited with stacked horizontal sliders: date above time; the date slider spans the current year's January 1 through December 31 and shows the full selected date including year, while the time slider spans `00:00` through `23:59` at one-minute resolution and shows the selected `HH:MM`;
3. Sunny is the default and no simulation setting is persisted;
4. declared Apartment SVG time zones are used for civil-time editing, while missing time zones use explicit UTC without machine-local guessing;
5. existing solar calculation remains the sole source of Sun position/direction;
6. the directional Sun changes color and strength believably with solar elevation and weather;
7. near-horizon Sunny light is visibly warmer than high-Sun daylight without automatic camera white balance;
8. a procedural sky follows the same simulation state and provides believable day, low-Sun, twilight, night, Sunny, and Overcast appearance;
9. Overcast has very weak direct Sun and faint, substantially softer shadows than Sunny;
10. direct Sun remains disabled at or below the geometric horizon;
11. the visible sky does not masquerade as global illumination or reintroduce global environment lighting in Physical mode;
12. switching Physical -> Studio -> Physical restores the previous Physical date/time/weather state;
13. Studio behavior, Physical location gating, architectural occlusion, renderer lifecycle, materials, camera/navigation, quality, and presentation behavior remain compatible;
14. focused automated tests, repository verification, and the requested browser smoke checks pass;
15. current-state documentation accurately describes the completed daylight simulation and its temporary GI limitation.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. daylight/weather model and time-zone handling used;
3. main files/areas changed;
4. tests added or updated;
5. verification commands and results;
6. browser smoke-check results, including Sunny/Overcast and day/night behavior;
7. deviations from this description, or `None`;
8. follow-up items, or `None`;
9. a suggested Conventional Commits message including:

```text
Task: TASK-039
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
