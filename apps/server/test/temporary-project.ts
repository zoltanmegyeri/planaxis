import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { onTestFinished } from "vitest";

export async function createTemporaryProject() {
  const root = await mkdtemp(path.join(tmpdir(), "planaxis-server-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const manifest = {
    schema: "planaxis-project/1.0",
    name: "Test apartment",
    architecture: { active: "architecture/existing.svg" },
  };
  const bytes = Buffer.from("Deliberately invalid Apartment SVG.\r\n");
  await mkdir(path.join(root, "architecture"));
  await writeFile(path.join(root, "planaxis.project.json"), JSON.stringify(manifest));
  await writeFile(path.join(root, manifest.architecture.active), bytes);
  return { root, manifest, bytes };
}
