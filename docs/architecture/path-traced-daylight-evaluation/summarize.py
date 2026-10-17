"""Derived statistics for saved linear HDR reports; no scene inputs or private resources."""
import json
import math
from pathlib import Path

root = Path(__file__).parent
reports = [("baseline", json.loads((root / "baseline.json").read_text()))]
for phase, filename in (
    ("initial-source", "initial-audit/core-measurements.json"),
    ("transport", "transport-audit/source-path.json"),
    ("final", "final-audit/public-final.json"),
    ("matrix", "final-audit/matrix.json"),
    ("regressions", "regressions/measurements.json"),
    ("noise", "noise-audit/controls.json"),
    ("noise-regressions", "noise-audit/regressions.json"),
    ("sky-review", "sky-review/measurements.json"),
    ("lamps-before", "lamp-review/before/measurements.json"),
    ("lamps", "lamp-review/compact/measurements.json"),
):
    path = root / filename
    if path.exists():
        reports.extend((phase, row) for row in json.loads(path.read_text()))
summary = []
# Two-sided 95% Student t values for the saved block counts (NIST table).
t_values = {2: 12.706, 3: 4.303, 4: 3.182, 5: 2.776, 6: 2.571, 7: 2.447, 8: 2.365,
            16: 2.131, 32: 2.040}
for phase, report in reports:
    # Pauses can add irregular checkpoints; use all complete 512-sample blocks, without
    # selecting a favorable frame. A partial capture after the last full block is labeled separately.
    by_count = {c["samples"]: c for c in report["checkpoints"] if c["samples"] % 512 == 0}
    checkpoints = [by_count[count] for count in sorted(by_count)]
    if not checkpoints:
        continue
    regions = {}
    for region in checkpoints[-1]["measurements"]:
        block_means = []
        previous_total = previous_samples = 0
        for checkpoint in checkpoints:
            count = checkpoint["samples"]
            total = checkpoint["measurements"][region]["Y"] * count
            block_means.append((total - previous_total) / (count - previous_samples))
            previous_total, previous_samples = total, count
        mean = checkpoints[-1]["measurements"][region]["Y"]
        blocks = len(block_means)
        se = (math.sqrt(sum((x - mean) ** 2 for x in block_means) / (blocks - 1) / blocks)
              if blocks > 1 else None)
        t = t_values.get(blocks)
        earlier = next((c for c in checkpoints if c["samples"] == checkpoints[-1]["samples"] // 2), None)
        regions[region] = {
            "Y": mean, "blockMeans": block_means, "standardError": se,
            "approximate95PercentHalfWidth": se * t if t else None,
            "halfRunRelativeChange": (mean / earlier["measurements"][region]["Y"] - 1
                                      if earlier and earlier["measurements"][region]["Y"] else None),
        }
    direct = regions["directFloor"]["Y"]
    summary.append({
        "phase": phase, "case": report.get("case", "baseline"), "design": report["design"],
        "camera": report["camera"], "instant": report["instant"], "path": report["path"],
        "samples": checkpoints[-1]["samples"], "captureSamples": report.get("captureSamples"),
        "regions": regions,
        "shadedFloorToDirect": regions["shadedFloor"]["Y"] / direct if direct else None,
    })
(root / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
for row in summary:
    print(row["phase"], row["case"], row["design"], row["samples"],
          *(f'{name}={result["Y"]:.6g}' for name, result in row["regions"].items()))
