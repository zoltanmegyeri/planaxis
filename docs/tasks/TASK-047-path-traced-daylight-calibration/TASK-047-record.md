# TASK-047: Path-traced daylight calibration and indirect-light validation

## Task Metadata

- **Status:** Completed
- **Created:** 2026-10-13
- **Issued:** 2026-10-13
- **Completed:** 2026-10-17
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-047-description.md`
- **Related tasks:** TASK-044, TASK-045, TASK-046
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0 and 1.1, PlanAxis Material Format 1.0 and 1.1
- **Implementation commits:** 5670906191a04a51232340140725c25f9f3b163b

## Purpose

Correct the insufficient brightness of indirectly lit regions in the accepted path-tracing view. After accepting PBR material support, the human maintainer reported that a large living room with substantial windows remains unrealistically dark outside the direct Sun patch under summer daytime conditions.

The current Sun strength and sky radiance are qualitative appearance values inherited from Interactive rendering. This task establishes a documented daylight scale and validates indirect transport, material energy, and presentation with controlled references and the reported apartment case. Path tracing remains the slower final-rendering option; Interactive/VXGI remains available for navigation.

## Description

The authoritative task definition is the sibling document:

```text
TASK-047-description.md
```

It defines the complete delegated scope, required reading, implementation constraints, verification, and acceptance criteria. The description is finalized for delegation and must remain unchanged after issue.

## Execution Record

### Result

Codex introduced a fixed Sunny reference in `simulation` and renderer-owned angular/RGB normalization for path tracing. Source-isolation and linear HDR measurements identified the former daylight scale as the dominant cause of dark indirect regions. The implementation completes the terminal-bounce sky/emitter estimator, uses measured 16-opaque/96-total interaction limits with compensated roulette, and improves conservative intersection/contact handling without changing authoritative geometry.

A bounded reflected-Sun proposal reduces rare bright samples from smooth horizontal-metal paths through probability-corrected sampling. Camera, reflection, and lighting escapes share calibrated horizon-color continuation below the horizon. The raw image remains unfiltered; no exposure offset, material gain, fabricated exterior geometry, or unoccluded fill supplies the correction.

Subsequent review corrected the tracer's lamp-unit mismatch: point/spot/linear/area sources now use Interactive-compatible photometric RGB coefficients without the former `/683/Kelvin Y` conversion. The accepted Sun/sky appearance remains intact under an explicitly daylight-specific render calibration. Persistent luminaire data, Interactive/VXGI source appearance, PBR semantics, and AgX/0 EV presentation remain unchanged; the unit-policy adjustment is recorded below.

Public fixtures, a bounded evaluation harness, analytical/reference tests, browser captures, linear readbacks, provenance, and architecture documentation cover daylight, material/path energy, reflected-Sun noise, sky continuity, all four lamps, occlusion, runtime controls, and the private apartment reproduction.

### Verification

Implementation results below are reported in the committed [daylight evaluation and review report](../../architecture/path-traced-daylight-evaluation/README.md), including its final lamp-unit correction:

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS — reported after the final correction. |
| `pnpm typecheck` | PASS — reported after the final correction. |
| `pnpm test` | PASS — 2,503 tests reported after the final correction. |
| `pnpm build` | PASS — the existing bundle-size advisory remains. |
| Daylight/source/transport audit | PASS — fixed-exposure HDR comparisons separate Sun/sky scale, 8/16/32-interaction truncation, compensated roulette, material energy, and finite-sample error. |
| Public browser and regression controls | PASS — reported daylight, PBR, sky, lamp, runtime, and reflected-Sun reviews retain actual architectural visibility; sealed/blocked/thin-wall controls report zero whole-image HDR luminance in their documented runs. Final browser warning/error logs are empty. |
| Lamp-unit review | PASS — 13 completed public matrix cases verify Interactive-compatible coefficients, all four types, proportional flux/dimming, Off, thin-wall occlusion, and unchanged accepted no-lamp daylight inputs. |
| Private apartment review | PASS — the actual Open Space June 21/noon case and a later private 560 lm nighttime design were run through the configured project boundary. Private resources/captures remain outside the repository. |

[Measurement summaries](../../architecture/path-traced-daylight-evaluation/summary.json) and the linked phase-specific reports distinguish historical baselines, intermediate audits, and final controls. The original summer-room source correction and the later lower-sky/lamp adjustments are documented separately; historical captures are not represented as final-code output. Analytical tests separately cover reference normalization, retained BSDF energy, roulette expectation, sampling PDFs, intersection precision, and corrected lamp coefficients.

No dependency manifests or lockfile changed, so dependency-change checks were not applicable. Implementation commands and browser cases were not rerun during this task-record-only finalization; the results above are attributed to the committed implementation report.

### Deviations from Description

The committed report documents a review-directed unit-policy adjustment. The initial description required a coherent relationship to the existing lamp transport scale and preservation of lamp appearance. Review instead identified the former `/683/Kelvin Y` lamp mapping as incompatible with Interactive and corrected those coefficients, changing traced lamp brightness while preserving nominal descriptor lumens and Interactive behavior.

At the maintainer's reported request, the already accepted Sunny output was retained. Its scale is now explicitly a daylight-specific render calibration; the earlier claim of a common absolute photometric daylight/lamp simulation is withdrawn, and mixed-light balance remains an RGB appearance approximation. The human maintainer accepted the resulting implementation commit on 2026-10-17. The issued description remains unchanged.

### Agent-Reported Follow-up Items

- Evaluate grazing paint and rough-metal energy with a fuller rough-interface/substrate model and a separate passive-energy/PDF audit.
- Evaluate remaining mapped/tilted-reflector, narrow artificial-source, and window-escape noise separately. The implemented reflected-Sun proposal is bounded to eligible smooth horizontal-metal paths; it is not a general caustics or denoising solution.

## Human Review

### Review Status

Accepted

### Review Notes

On 2026-10-17, the human maintainer confirmed that Codex successfully implemented TASK-047, identified the accepted implementation commit, and requested that the task be marked Completed. The implementation report separately records earlier visual acceptance of daylight/firefly corrections on 2026-10-15 and the subsequent horizon and lamp review iterations.

The accepted result retains the bounded PBR model's grazing/rough-metal energy losses, finite path limits, fixed atmosphere/RGB assumptions, approximate lower-hemisphere boundary, residual Monte Carlo noise, and float32 intersection limits. Daylight/lamp balance is an appearance calibration rather than a common absolute photometric prediction. The measurements and reviewed occlusion controls do not establish complete convergence or correctness for every apartment, scale, material, or device.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

- `5670906191a04a51232340140725c25f9f3b163b`

### Commit Messages

```text
fix(renderer-three): calibrate path-traced lighting

- Calibrate daylight and align luminaire output with Interactive rendering.
- Improve indirect lighting, terminal-bounce handling, and intersection precision.
- Reduce reflected-Sun fireflies and restore sky color below the horizon.
- Add public evaluation fixtures, measurements, regression tests, and documentation.

Task: TASK-047
```

### Supersession

—

## Notes

Repository directory:

```text
docs/tasks/TASK-047-path-traced-daylight-calibration/
```

The task was issued to Codex on 2026-10-13 and completed on 2026-10-17 after human acceptance of the implementation commit. The issued task description remains unchanged and immutable.

Physical Sunny, the existing material/glazing subset, and final-rendering usage remain the accepted boundaries. Source calibration and evidence-backed transport corrections are included; arbitrary indirect-light gain, automatic exposure, and performance benchmarking are excluded.
