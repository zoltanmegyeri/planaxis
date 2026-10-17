# Public Sunny daylight controls

Load this project through `pnpm start -- --project fixtures/projects/path-traced-daylight`.
Select **Neutral**, camera **interior**, Physical/Sunny, **June 21, 2026 at 12:00
Europe/Budapest**, AgX/0 EV, DPR 1 and Path tracing. The main architecture is a 9 × 7 m
room with two 2.4 × 1.8 m south-facing clear windows and complete floor/ceiling/wall boundaries.
No exterior geometry or luminaire supplies the neutral daylight comparison.

Neutral sRGB factor 0.85430583154494 decodes to linear 0.7. All designable paint targets
are assigned explicitly. Caps retain established neutral renderer defaults. Sealed, blocked
and thin-partition scenarios bind their own valid SVGs; none replaces runtime geometry.
PBR, AO/zero AO and metal controls reuse existing generated public PlanAxis texture fixtures.
Individual point/spot/linear/area scenarios share the reference placement. The mixed scenario
separates its sources to avoid coincident sheets; all retain declared lumens, Kelvin and
orientation, with total nominal mixed flux 6400 lm.
Polished-floor sealed, blocked and thin-partition variants exercise visibility while the
reflected-Sun proposal is eligible.

The opt-in Vite engineering page `/evaluation/daylight.html` provides source isolation,
8/16/32 opaque-path and roulette controls and linear HDR readback outside the production UI.
It uses the same project APIs, validation, material resolution and rendering implementation.
See [the evidence and fixed-region protocol](../../../docs/architecture/path-traced-daylight-evaluation/README.md).
No helper calculation is an alternative architectural persistence format.
