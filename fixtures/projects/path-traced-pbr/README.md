# Path-traced opaque PBR controls

All texture assets are purpose-generated deterministic fixtures authored for PlanAxis under
its Apache-2.0 license; no third-party photographs, materials or models are included.
`generate-fixtures.py` reproduces descriptors and images from the repository root with Python
and Pillow. Pillow is a fixture-authoring tool only, not an application dependency.

The architecture reuses the accepted luminaire review room, opening, baffle, blocker and 1 cm
partition, adding a valid floor finish-override zone. Both Design 1.0/1.1 and Material 1.0/1.1
are represented without migration. All scenes use AgX/0 EV, fixed source positions and powers.

- Wood PNG: 128 × 64, 120 × 20 cm period, deliberately variable source alpha under opaque visibility.
- Plaster JPEG: 64 × 64, 50 × 50 cm period, deterministic fine color detail.
- Tile WebP: 64 × 32, 60 × 30 cm period, grout and alternating asymmetric columns.
- Normal PNG: 32 × 16, positive X detail in the left quarter and positive Y detail in the
  image-top quarter. It has the same period as the material despite differing pixel size.
- Neutral normal: 8 × 8, RGB (128,128,255); unavoidable 8-bit quantization makes X/Y slightly positive.
- ORM PNG: 16 × 16, red 64/255 left/right, green 64/200 top/bottom, blue 0/255 left/right.
  The separate-role files have exactly equivalent samples with differing image dimensions.
- White AO: 8 × 8. AO strength zero/white controls isolate attenuation from direct lamps/shadows.

Scalar floor controls isolate roughness, metalness and both polished endpoints. Mapped role
controls isolate normal/roughness/metalness/AO, packed/separate channels, both alpha exclusions,
and asymmetric orientation on floor/ceiling/opposing wall faces/reveals. No-finish, Design 1.0,
concealed-strip and lights-off scenarios exercise replacement and occlusion controls.

See the [architecture evidence](../../../docs/architecture/path-traced-pbr-evaluation/README.md)
for actual browser settings, sample counts and agent observations. These fixtures do not imply
human visual acceptance or calibrated photometry.
