import { mkdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, onTestFinished, vi } from "vitest";

import { buildApplication } from "../src/app.js";
import { loadProject } from "../src/project/load-project.js";
import { createTemporaryProject } from "./temporary-project.js";

async function createProjectApplication() {
  const fixture = await createTemporaryProject();
  const loaded = await loadProject(fixture.root);
  if (!loaded.ok) throw new Error(loaded.error.message);
  const application = buildApplication(loaded.value);
  onTestFinished(() => application.close());
  return { ...fixture, application, project: loaded.value };
}

describe("buildApplication", () => {
  it("serves the compatible health endpoint in process", async () => {
    const { application } = await createProjectApplication();
    const response = await application.inject("/health");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns exactly the safe metadata from the explicitly supplied project", async () => {
    const { application, root, manifest, project } = await createProjectApplication();
    const response = await application.inject("/api/project");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(manifest);
    expect(response.body).not.toContain(root);
    expect(response.body).not.toContain(project.canonicalRoot);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("serves invalid Apartment SVG unchanged with a non-executable content type", async () => {
    const { application, bytes } = await createProjectApplication();
    const response = await application.inject("/api/project/architecture");
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(bytes);
    expect(response.headers["content-type"]).toBe("application/octet-stream");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("preserves arbitrary file bytes and observes edits through the loaded boundary", async () => {
    const { application, root, manifest } = await createProjectApplication();
    const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0, 255, 128, 13, 10]);
    await writeFile(path.join(root, manifest.architecture.active), bytes);
    const response = await application.inject("/api/project/architecture");
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(bytes);
  });

  it("keeps the startup manifest selection until the process is restarted", async () => {
    const { application, root, manifest, bytes } = await createProjectApplication();
    await writeFile(path.join(root, "architecture/other.svg"), "Other architecture");
    await writeFile(
      path.join(root, "planaxis.project.json"),
      JSON.stringify({
        ...manifest,
        name: "Changed project",
        architecture: { active: "architecture/other.svg" },
      }),
    );
    expect((await application.inject("/api/project")).json()).toEqual(manifest);
    expect((await application.inject("/api/project/architecture")).rawPayload).toEqual(bytes);
  });

  it.each(["path", "projectRoot", "active", "file"])(
    "rejects client selection through %s",
    async (key) => {
      const { application, project } = await createProjectApplication();
      const readSpy = vi.spyOn(project.filesystem, "readFile");
      onTestFinished(() => readSpy.mockRestore());
      for (const value of [
        "architecture/other.svg",
        "../outside.svg",
        project.canonicalRoot,
        ".planaxis/cache",
      ]) {
        const response = await application.inject({
          url: "/api/project/architecture",
          query: { [key]: value },
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({
          error: "This endpoint does not accept query parameters.",
        });
      }
      expect(readSpy).not.toHaveBeenCalled();
    },
  );

  it.for(["missing", "directory", "symlink", "intermediate symlink"])(
    "returns a controlled error when active architecture becomes %s after loading",
    async (kind, context) => {
      const { application, root, manifest } = await createProjectApplication();
      const active = path.join(root, manifest.architecture.active);
      if (kind === "intermediate symlink") {
        await rename(path.join(root, "architecture"), path.join(root, "original-architecture"));
      } else {
        await rm(active);
      }
      if (kind === "directory") await mkdir(active);
      if (kind.includes("symlink")) {
        try {
          await symlink(
            kind === "symlink"
              ? path.join(root, "planaxis.project.json")
              : path.join(root, "original-architecture"),
            kind === "symlink" ? active : path.join(root, "architecture"),
            kind === "symlink" ? "file" : "dir",
          );
        } catch (error: unknown) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            ["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(String(error.code))
          ) {
            context.skip("The host does not permit the symbolic-link test setup.");
          }
          throw error;
        }
      }
      const response = await application.inject("/api/project/architecture");
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Unable to read the active architecture." });
      expect((await application.inject("/health")).statusCode).toBe(200);
    },
  );

  it("hides unexpected internal filesystem exceptions", async () => {
    const { application, project } = await createProjectApplication();
    const readSpy = vi
      .spyOn(project.filesystem, "readFile")
      .mockRejectedValue(new Error(`Private failure at ${project.canonicalRoot}`));
    onTestFinished(() => readSpy.mockRestore());
    const response = await application.inject("/api/project/architecture");
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Unable to read the active architecture." });
  });

  it("does not serve the manifest, arbitrary resources, or disposable internal files", async () => {
    const { application, root } = await createProjectApplication();
    await mkdir(path.join(root, ".planaxis"));
    await writeFile(path.join(root, ".planaxis/cache"), "Internal state");
    await writeFile(path.join(root, "notes.txt"), "Private notes");
    for (const url of [
      "/planaxis.project.json",
      "/architecture/existing.svg",
      "/notes.txt",
      "/.planaxis/cache",
      "/api/project/files/notes.txt",
      "/api/project/architecture/existing.svg",
    ]) {
      expect((await application.inject(url)).statusCode).toBe(404);
    }
  });
});
