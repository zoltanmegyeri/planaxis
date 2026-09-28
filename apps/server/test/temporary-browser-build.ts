import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { onTestFinished } from "vitest";

export async function createTemporaryBrowserBuild() {
  const root = await mkdtemp(path.join(tmpdir(), "planaxis-browser-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const entry =
    '<!doctype html><html><head><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></head><body><main id="app"></main></body></html>';
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), entry);
  await writeFile(path.join(root, "assets/app.js"), 'console.log("PlanAxis test build");');
  await writeFile(path.join(root, "assets/app.css"), "body { margin: 0; }");
  return { root, entry };
}
