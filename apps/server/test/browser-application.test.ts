import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import { buildApplication } from "../src/app.js";
import { loadProject } from "../src/project/load-project.js";
import { createTemporaryBrowserBuild } from "./temporary-browser-build.js";
import { createTemporaryProject } from "./temporary-project.js";

async function createApplication(apiOnly = false) {
  const project = await createTemporaryProject();
  const build = await createTemporaryBrowserBuild();
  const loaded = await loadProject(project.root);
  if (!loaded.ok) throw new Error(loaded.error.message);
  const application = buildApplication(loaded.value, { browserBuildRoot: build.root, apiOnly });
  onTestFinished(() => application.close());
  return { application, project, build };
}

describe("production browser application", () => {
  it("serves the entry document and built assets with their content types", async () => {
    const { application, build } = await createApplication();
    const entry = await application.inject("/");
    expect(entry.statusCode).toBe(200);
    expect(entry.body).toBe(build.entry);
    expect(entry.headers["content-type"]).toContain("text/html");
    for (const [url, type, content] of [
      ["/assets/app.js", "javascript", 'console.log("PlanAxis test build");'],
      ["/assets/app.css", "text/css", "body { margin: 0; }"],
    ] as const) {
      const response = await application.inject(url);
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain(type);
      expect(response.body).toBe(content);
    }
    expect((await application.inject({ method: "HEAD", url: "/" })).body).toBe("");
  });

  it("preserves health and project APIs and reserves unknown API paths", async () => {
    const { application, project, build } = await createApplication();
    await mkdir(path.join(build.root, "api"));
    await writeFile(path.join(build.root, "health"), "Static collision");
    await writeFile(path.join(build.root, "api/project"), "Static collision");
    await writeFile(path.join(build.root, "api/unknown"), "Static collision");
    expect((await application.inject("/health")).json()).toEqual({ status: "ok" });
    expect((await application.inject("/api/project")).json()).toEqual(project.manifest);
    const architecture = await application.inject("/api/project/architecture");
    expect(architecture.rawPayload).toEqual(project.bytes);
    expect(architecture.headers["content-type"]).toBe("application/octet-stream");
    expect((await application.inject("/api/project/designs")).json()).toEqual({ designs: [] });
    expect((await application.inject("/api/project/architecture?unknown=true")).statusCode).toBe(
      400,
    );
    expect((await application.inject("/api/unknown")).statusCode).toBe(404);
  });

  it("does not fall back to HTML or expose project files, repository files, or directories", async () => {
    const { application, project } = await createApplication();
    await writeFile(path.join(project.root, "notes.txt"), "Private project notes");
    for (const url of [
      "/unknown",
      "/api/project/unknown",
      "/assets/missing.js",
      "/planaxis.project.json",
      "/architecture/existing.svg",
      "/notes.txt",
      "/.planaxis/cache",
      "/package.json",
      "/src/index.ts",
    ]) {
      const response = await application.inject(url);
      expect(response.statusCode, url).toBe(404);
      expect(response.headers["content-type"]).not.toContain("text/html");
    }
  });

  it("rejects directory listing and traversal outside the browser build", async () => {
    const { application } = await createApplication();
    for (const url of ["/assets/", "/assets/../../package.json", "/%2e%2e/package.json"]) {
      const response = await application.inject(url);
      expect([403, 404]).toContain(response.statusCode);
      expect(response.headers["content-type"]).not.toContain("text/html");
    }
  });

  it.each([
    "missing build",
    "missing entry",
    "empty entry",
    "unbuilt entry",
    "directory entry",
    "missing JavaScript",
    "empty JavaScript",
    "missing CSS",
  ])("rejects a %s before the server can listen", async (kind) => {
    const { application, build } = await createApplication();
    const entry = path.join(build.root, "index.html");
    if (kind === "missing build") await rm(build.root, { recursive: true });
    else if (kind === "missing entry") await rm(entry);
    else if (kind === "empty entry") await writeFile(entry, "");
    else if (kind === "unbuilt entry")
      await writeFile(entry, '<script type="module" src="/src/main.tsx"></script>');
    else if (kind === "directory entry") {
      await rm(entry);
      await mkdir(entry);
    } else if (kind === "missing JavaScript") await rm(path.join(build.root, "assets/app.js"));
    else if (kind === "empty JavaScript")
      await writeFile(path.join(build.root, "assets/app.js"), "");
    else await rm(path.join(build.root, "assets/app.css"));
    await expect(application.ready()).rejects.toThrow(
      /production browser build is missing or unusable.*pnpm start/,
    );
  });

  it("supports API-only operation with no browser build", async () => {
    const { application, build, project } = await createApplication(true);
    await rm(build.root, { recursive: true });
    expect((await application.inject("/api/project")).json()).toEqual(project.manifest);
    expect((await application.inject("/")).statusCode).toBe(404);
    expect((await application.inject("/assets/app.js")).statusCode).toBe(404);
  });
});
