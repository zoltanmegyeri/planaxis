# TASK-042: Introduce WebGPU Render Pipeline and Bloom

## Context

PlanAxis currently renders its apartment scene directly through Three.js `WebGPURenderer`. Physical daylight, persistent materials, presentation settings, and Design 1.1 artificial luminaires are implemented.

The luminaire placement/editing UI originally planned as the remainder of Stage 4.4 is intentionally deferred. Manual Design JSON authoring is sufficient for now, so the next priority is Stage 4.5: establish the WebGPU post-processing foundation and add subtle bloom for a more realistic HDR presentation.

Three.js `WebGPURenderer` provides the node-based `RenderPipeline` post-processing system and supports the existing automatic WebGL2 backend fallback. PlanAxis must use that single renderer/pipeline architecture rather than introducing the legacy `EffectComposer` path.

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
```

Do not read any other file under `docs/tasks/`.

## Goal

Replace direct final scene rendering with a Three.js `RenderPipeline` and add configurable full-scene HDR bloom.

Expose transient bloom controls in the existing Rendering panel:

```text
Enabled
Strength
Radius
Threshold
```

Bloom must remain visually subtle by default and must not replace lighting, GI, emissive fixture geometry, or other future rendering stages.

## Scope

The task includes:

- introducing a renderer-owned `RenderPipeline` for the existing `WebGPURenderer`;
- rendering the scene through a scene pass and node-based post-processing output;
- adding full-scene luminance-threshold bloom using Three.js `BloomNode`;
- compositing bloom with HDR scene color before final tone mapping/color conversion;
- introducing a renderer/runtime post-processing settings contract;
- exposing bloom Enabled / Strength / Radius / Threshold in the existing Rendering panel;
- applying bloom changes immediately without rebuilding architecture, materials, luminaires, cameras, or navigation state;
- integrating bloom with the existing Performance / Balanced / High quality preset UX through the agreed lightweight enabled-state recommendation;
- preserving the existing WebGPU-first / WebGL2-fallback architecture;
- preserving event-driven rendering, resize/fullscreen behavior, tone mapping, exposure, and renderer lifecycle;
- adding focused renderer/browser tests;
- updating current-state documentation and ADR-003 to describe the implemented pipeline and bloom behavior.

## Out of Scope

This task does **not** include:

- luminaire placement/editing UI;
- selective/emissive-only bloom;
- MRT emissive extraction solely for bloom;
- fake visible bulbs, glowing spheres/rectangles, or invented fixture geometry;
- changes to Design Format or other persistent project formats;
- persistence of bloom settings in design JSON, project files, or browser local storage;
- realtime GI;
- IES photometry;
- path tracing;
- depth of field, SSR, vignette, chromatic aberration, film grain, FXAA, color grading, or other new post-processing effects;
- replacing `WebGPURenderer` with `WebGLRenderer`;
- adding a separate legacy `EffectComposer` pipeline for the WebGL2 fallback.

## Functional Requirements

### RenderPipeline foundation

Create and own one Three.js `RenderPipeline` for the renderer instance.

The pipeline must:

1. render the existing scene/camera through a scene pass;
2. expose the HDR scene-color node as the bloom input;
3. when bloom is enabled, composite the scene color with its bloom contribution;
4. apply the existing renderer tone mapping and output color-space conversion only after the HDR effect chain;
5. render through `RenderPipeline.render()` rather than calling `renderer.render(scene, camera)` for the final viewport image.

Use the `WebGPURenderer`/TSL post-processing APIs supported by the repository's existing Three.js version.

Do not introduce `EffectComposer`.

### Bloom behavior

Use full-scene luminance-threshold bloom rather than selective emissive bloom.

This is deliberate: current Design 1.1 luminaires are idealized light emitters and do not define visible fixture geometry or emissive surfaces.

Bloom must therefore operate on bright HDR rendered regions such as intense highlights, bright sky/window regions, and strongly lit surfaces without inventing visible light-source geometry.

When bloom is disabled, the pipeline must bypass the bloom effect work rather than merely setting strength to zero. Enabling/disabling bloom may switch/reconfigure the pipeline output node, but must not rebuild the apartment scene or renderer.

### Post-processing settings contract

Introduce a renderer-owned runtime contract conceptually equivalent to:

```ts
interface RendererPostProcessingSettings {
  readonly bloomEnabled: boolean;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
}
```

Exact naming may follow existing conventions.

Validation must reject invalid runtime settings. At minimum:

- `bloomEnabled` is boolean;
- strength is finite and non-negative;
- radius is finite and in `[0, 1]`;
- threshold is finite and non-negative.

Export deliberate defaults.

Bloom settings are runtime/browser state only. They must not enter Design Format, project persistence, Apartment SVG, material descriptors, or renderer quality persistence.

### Default bloom tuning

Bloom is enabled by default for the normal PlanAxis experience.

Do not blindly use Three.js effect defaults if they make ordinary surfaces glow excessively. Select conservative default strength/radius/threshold values through practical manual tuning.

The final defaults must satisfy the qualitative goal:

> ordinary diffusely lit walls/floors should normally not visibly glow, while genuinely intense HDR highlights may bloom softly.

Document the chosen defaults in current-state documentation.

### Rendering-panel controls

Add controls for:

```text
Bloom enabled
Bloom strength
Bloom radius
Bloom threshold
```

to the existing Rendering panel.

Requirements:

- controls are disabled until the renderer is ready;
- changing any bloom setting immediately updates the next rendered frame;
- controls must not rebuild the model or reset camera/navigation state;
- radius UI must respect `[0, 1]`;
- strength/threshold controls must prevent invalid negative values;
- exact practical slider/input ranges and steps may be chosen for useful visual tuning;
- bloom controls remain editable regardless of the selected named quality preset.

Do not persist these controls to project/design data or local storage in this task.

### Quality-preset interaction

Quality and bloom remain separate runtime concepts.

Only explicit selection of a named quality preset applies a bloom-enabled recommendation:

```text
Performance -> Bloom Off
Balanced    -> Bloom On
High        -> Bloom On
```

After that selection, the user may change Bloom Enabled independently.

Required behavior includes:

```text
Balanced -> user disables Bloom
Quality remains Balanced

Performance -> user enables Bloom
Quality remains Performance
```

Changing bloom enabled/strength/radius/threshold must not make the quality preset `Custom`.

Editing individual quality fields such as DPR, shadows, environment lighting, or fill light may make quality `Custom` under the existing rules, but must not change bloom settings.

At initial browser restoration:

```text
restored Performance -> Bloom Off
restored Balanced    -> Bloom On
restored High        -> Bloom On
restored Custom      -> Bloom On
```

Bloom state itself is not separately restored because it is not persisted.

Display/DPR adaptation of an already selected/restored quality preference must not repeatedly overwrite a user's later bloom override; the preset recommendation is applied at initialization and on explicit named-preset selection.

### Tone mapping and exposure

Preserve the existing presentation contract:

```text
AgX / ACES Filmic / Neutral
exposure EV
```

Bloom must operate on HDR scene color before final tone mapping/output color conversion.

Existing design-saved presentation overrides and transient presentation controls must continue to behave as before.

Do not add a bloom-specific exposure control or automatic white-balance behavior.

### Resize, DPR, fullscreen, and lifecycle

The post-processing pipeline/effect resources must track the existing renderer lifecycle.

Requirements:

- viewport resize updates effective post-processing render-target sizes;
- pixel-ratio changes remain correct;
- render-aspect and fullscreen changes remain correct;
- model replacement preserves post-processing settings;
- Studio/Physical mode changes preserve post-processing settings;
- design/luminaire/material replacement preserves post-processing settings;
- camera/navigation changes preserve post-processing settings;
- final renderer disposal releases `RenderPipeline`/BloomNode-owned resources;
- disposal during in-flight renderer initialization remains safe.

Keep rendering event-driven. Do not add a persistent animation loop merely for bloom.

### Backend compatibility

Use the same `WebGPURenderer` + `RenderPipeline` architecture for:

```text
native WebGPU backend
automatic WebGL2 backend fallback
```

Do not maintain separate post-processing implementations for the two backends.

An unsupported backend/pipeline failure must continue through the existing renderer/application failure path rather than silently falling back to a different visual architecture.

## Technical and Architectural Constraints

- Keep Three.js post-processing implementation inside `@planaxis/renderer-three`.
- Keep React/browser code responsible for transient UI state and user interactions.
- Do not couple bloom to persistent design semantics.
- Keep `RendererQualitySettings` focused on its existing quality fields; bloom must not be added merely to make preset coupling convenient.
- Reuse the existing renderer instance and scene resources.
- Do not introduce a second rendering stack.
- Do not invent emissive fixture geometry to demonstrate bloom.
- Avoid new dependencies; Three.js already provides the required pipeline/effect APIs.
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

No server, Design Format, Material Format, or Apartment SVG changes are expected.

## Testing Requirements

Add focused automated coverage for at least:

- runtime post-processing settings validation and defaults;
- pipeline creation/use replacing direct final scene rendering;
- bloom-enabled composition and bloom-disabled bypass behavior;
- strength/radius/threshold updates reaching the existing bloom node without rebuilding the scene;
- tone mapping/exposure remaining effective with the pipeline;
- resize and pixel-ratio changes retaining correct pipeline behavior;
- renderer disposal releasing pipeline/effect resources;
- event-driven rendering remaining intact;
- initial bloom enablement from restored Performance/Balanced/High/Custom quality state;
- explicit preset selection applying Performance -> Off, Balanced -> On, High -> On;
- manual bloom toggling not changing the named quality preset;
- manual bloom parameter edits not changing the quality preset;
- quality-field edits/Custom state not changing bloom;
- later DPR/display adaptation not overwriting a user's bloom override;
- Studio/Physical and design/camera changes preserving bloom settings.

Where practical, test stable pipeline/settings state without requiring a physical GPU.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Manual Verification

Perform practical browser verification with representative PlanAxis scenes.

At minimum verify:

- Balanced starts with bloom enabled;
- Performance selection disables bloom;
- High selection enables bloom;
- manual Bloom Enabled override works independently after each preset selection;
- all four bloom controls visibly affect the image;
- ordinary diffuse surfaces do not exhibit obvious glow with default settings;
- bright daylight/window highlights can produce subtle bloom;
- nighttime artificial-light scenes can produce subtle bloom around sufficiently bright rendered regions;
- bloom On/Off does not change geometry, camera pose, materials, luminaires, or lighting state;
- tone mapping and exposure remain correct;
- resize, render aspect ratio, fullscreen, Studio/Physical switching, and camera navigation remain functional.

Record the chosen default strength/radius/threshold values in the completion report.

## Documentation Requirements

Update current-state documentation so it describes:

- `RenderPipeline` as the final rendering path;
- full-scene HDR bloom and its runtime controls;
- the quality-preset bloom recommendation policy;
- bloom settings as transient/non-persistent;
- the chosen default bloom values;
- remaining deferred work including realtime GI, IES, path tracing, and luminaire placement/editing UI.

Refine ADR-003 to record the implemented post-processing architecture.

Do not change normative format specifications.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused renderer/browser tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. final 3D rendering goes through Three.js `RenderPipeline`;
2. full-scene HDR bloom is composited before final tone mapping/color conversion;
3. disabled bloom bypasses bloom processing rather than only using zero strength;
4. Enabled, Strength, Radius, and Threshold are exposed in the Rendering panel;
5. conservative defaults produce subtle bloom rather than general scene glow;
6. Performance selects Bloom Off, while Balanced and High select Bloom On;
7. users can override bloom independently without changing the quality preset;
8. Custom/manual quality changes do not alter bloom;
9. bloom state is transient and not written to project/design/local-storage persistence;
10. existing tone mapping/exposure semantics remain correct;
11. resize, DPR, fullscreen, lighting-mode, design, and navigation behavior remain compatible;
12. the same pipeline architecture works through WebGPURenderer's WebGPU and WebGL2 backend paths;
13. renderer/effect resources are cleaned up correctly and rendering remains event-driven;
14. focused tests, repository verification, and practical manual rendering verification pass;
15. current-state documentation and ADR-003 accurately describe the implemented pipeline and bloom behavior.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. RenderPipeline/bloom architecture;
3. chosen default bloom values and tuning rationale;
4. quality-preset interaction behavior;
5. main files/areas changed;
6. tests added or updated;
7. verification commands and results;
8. manual rendering verification and observed result;
9. deviations from this description, or `None`;
10. follow-up items, or `None`;
11. a suggested Conventional Commits message including:

```text
Task: TASK-042
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
