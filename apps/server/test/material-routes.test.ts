import { mkdir, readFile, readdir, rename, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, onTestFinished, vi, type TestContext } from "vitest";

import { buildApplication } from "../src/app.js";
import { loadProject } from "../src/project/load-project.js";
import { createTemporaryProject } from "./temporary-project.js";

async function setup() {
  const fixture = await createTemporaryProject();
  const loaded = await loadProject(fixture.root);
  if (!loaded.ok) throw new Error(loaded.error.message);
  const application = buildApplication(loaded.value);
  onTestFinished(() => application.close());
  return { ...fixture, application, project: loaded.value };
}

async function linkForTest(
  context: TestContext,
  target: string,
  destination: string,
  directory: boolean,
) {
  try {
    await symlink(target, destination, directory ? "dir" : "file");
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

describe("raw material resource reads", () => {
  it.each([
    [
      "material",
      "assets/materials/nested/paint/material.json",
      Buffer.from('{\r\n  "schema": "planaxis-material/1.0", "name": "Paint"\r\n}\r\n'),
    ],
    ["material", "assets/materials/unsupported.json", Buffer.from('{"schema":"future/99"}')],
    ["material", "assets/materials/malformed.json", Buffer.from("{ not JSON")],
    [
      "material",
      "assets/materials/invalid-encoding.json",
      Buffer.from([0xef, 0xbb, 0xbf, 0, 255, 128, 13, 10]),
    ],
    ...["png", "jpg", "jpeg", "webp"].map(
      (extension) =>
        [
          "material-texture",
          `assets/materials/shared/nested/texture.${extension}`,
          Buffer.from([0, 255, 128, 13, 10, 60, 115, 118, 103, 62]),
        ] as const,
    ),
  ] as const)(
    "serves %s %s unchanged without parsing or decoding",
    async (endpoint, relative, bytes) => {
      const { application, root } = await setup();
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), bytes);
      const response = await application.inject(
        `/api/project/${endpoint}?path=${encodeURIComponent(relative)}`,
      );
      expect(response.statusCode).toBe(200);
      expect(response.rawPayload).toEqual(bytes);
      expect(response.headers["content-type"]).toBe("application/octet-stream");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(await readFile(path.join(root, relative))).toEqual(bytes);
    },
  );
});

describe.each([
  ["material", ".json"],
  ["material-texture", ".png"],
] as const)("%s HTTP boundary", (endpoint, extension) => {
  const relative = `assets/materials/nested/resource${extension}`;
  const url = (resource: string) => `/api/project/${endpoint}?path=${encodeURIComponent(resource)}`;

  it("rejects unsafe paths and selectors outside the allowed resource kind before I/O", async () => {
    const { application, project } = await setup();
    const read = vi.spyOn(project.filesystem, "readFile");
    onTestFinished(() => read.mockRestore());
    for (const resource of [
      "",
      `../outside${extension}`,
      `/assets/materials/a${extension}`,
      `C:/assets/materials/a${extension}`,
      `file:assets/materials/a${extension}`,
      `https://example.com/a${extension}`,
      `assets/materials/C:/a${extension}`,
      `assets/materials/../a${extension}`,
      `assets/materials/./a${extension}`,
      `assets/materials//a${extension}`,
      `assets\\materials\\a${extension}`,
      `assets/materials/a\0${extension}`,
      `assets/materials/a${extension.toUpperCase()}`,
      `assets/models/a${extension}`,
      `references/materials/a${extension}`,
      `assets/materials-other/a${extension}`,
      `.planaxis/a${extension}`,
      `assets/materials/${extension}`,
      "assets/materials/a",
      "assets/materials/a.gif",
      "assets/materials/a.svg",
      "planaxis.project.json",
      `assets/materials/a${endpoint === "material" ? ".png" : ".json"}`,
    ]) {
      const response = await application.inject(url(resource));
      expect(response.statusCode, resource).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "PROJECT_INVALID_PATH" } });
      expect(response.body).not.toContain(project.canonicalRoot);
    }
    expect(read).not.toHaveBeenCalled();
  });

  it("requires exactly one path parameter and rejects unknown or repeated parameters", async () => {
    const { application } = await setup();
    for (const query of [
      "",
      "?",
      "?other=x",
      `?path=${relative}&path=${relative}`,
      `?path=${relative}&p%61th=${relative}`,
      `?path=${relative}&unknown=x`,
      `?path=${relative}&__proto__=x`,
      `?path=${relative}&constructor=x`,
    ]) {
      const response = await application.inject(`/api/project/${endpoint}${query}`);
      expect(response.statusCode, query).toBe(400);
      expect(response.json()).toEqual({ error: "Expected exactly one path query parameter." });
    }
  });

  it("returns a controlled 404 for absent material directories or files without creating them", async () => {
    const { application, root } = await setup();
    for (const createDirectory of [false, true]) {
      if (createDirectory)
        await mkdir(path.join(root, "assets/materials/nested"), { recursive: true });
      const response = await application.inject(url(relative));
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: "PROJECT_NOT_FOUND", location: relative },
      });
      expect(response.body).not.toContain(root);
      if (!createDirectory) expect(await readdir(root)).not.toContain("assets");
    }
  });

  it.each(["target", "parent"])("rejects a non-regular %s", async (kind) => {
    const { application, root } = await setup();
    await mkdir(path.join(root, "assets/materials"), { recursive: true });
    if (kind === "target") await mkdir(path.join(root, relative), { recursive: true });
    else await writeFile(path.join(root, "assets/materials/nested"), "not a directory");
    const response = await application.inject(url(relative));
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: kind === "target" ? "PROJECT_NOT_REGULAR_FILE" : "PROJECT_NOT_DIRECTORY",
      },
    });
  });

  it.for(["file", "directory", "materials", "assets", "dangling"])(
    "rejects %s symbolic links below the root",
    async (kind, context) => {
      const { application, root } = await setup();
      const outside = await createTemporaryProject();
      const secret = `secret${extension}`;
      await writeFile(path.join(outside.root, secret), "outside secret");
      const directory = ["directory", "materials", "assets"].includes(kind);
      const link =
        kind === "assets"
          ? "assets"
          : kind === "materials"
            ? "assets/materials"
            : kind === "directory"
              ? "assets/materials/link"
              : `assets/materials/link${extension}`;
      await mkdir(path.dirname(path.join(root, link)), { recursive: true });
      await linkForTest(
        context,
        directory
          ? outside.root
          : path.join(outside.root, kind === "dangling" ? `missing${extension}` : secret),
        path.join(root, link),
        directory,
      );
      if (kind === "assets") {
        await mkdir(path.join(outside.root, "materials"));
        await writeFile(path.join(outside.root, "materials", secret), "outside secret");
      }
      const resource =
        kind === "assets" ? `assets/materials/${secret}` : directory ? `${link}/${secret}` : link;
      const response = await application.inject(url(resource));
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: { code: "PROJECT_SYMLINK" } });
      expect(response.body).not.toContain(outside.root);
      expect(response.body).not.toContain("outside secret");
    },
  );

  it.for(["file", "directory"])("rechecks the %s boundary on every read", async (kind, context) => {
    const { application, root } = await setup();
    await mkdir(path.join(root, "assets/materials/nested"), { recursive: true });
    await writeFile(path.join(root, relative), "original");
    expect((await application.inject(url(relative))).body).toBe("original");
    const original = path.join(root, kind === "file" ? relative : "assets/materials/nested");
    const moved = `${original}-saved`;
    await rename(original, moved);
    await linkForTest(context, moved, original, kind === "directory");
    const response = await application.inject(url(relative));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "PROJECT_SYMLINK" } });
  });

  it("logs unexpected infrastructure failures and returns only a generic 500", async () => {
    const { application, project } = await setup();
    const error = new Error(`Private infrastructure failure at ${project.canonicalRoot}`);
    const read = vi.spyOn(project.filesystem, "readFile").mockRejectedValue(error);
    onTestFinished(() => read.mockRestore());
    const log = vi.fn();
    application.addHook("onRequest", async (request) => {
      vi.spyOn(request.log, "error").mockImplementation(log);
    });
    const response = await application.inject(url(relative));
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "Unable to complete the project resource operation.",
    });
    expect(response.body).not.toContain(project.canonicalRoot);
    expect(log).toHaveBeenCalledWith({ err: error }, "Project resource operation failed.");
  });

  it("exposes no material write methods", async () => {
    const { application, root } = await setup();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      expect(
        (await application.inject({ method, url: url(relative), payload: {} })).statusCode,
      ).toBe(404);
    }
    expect(await readdir(root)).not.toContain("assets");
  });
});

it("does not expose material discovery, static resources, or generic project files", async () => {
  const { application, root } = await setup();
  await mkdir(path.join(root, "assets/materials"), { recursive: true });
  await writeFile(path.join(root, "assets/materials/material.json"), "private bytes");
  for (const url of [
    "/api/project/materials",
    "/api/project/material-textures",
    "/assets/materials/material.json",
    "/api/project/files?path=assets/materials/material.json",
    "/api/project/assets/materials/material.json",
  ])
    expect((await application.inject(url)).statusCode, url).toBe(404);
});
