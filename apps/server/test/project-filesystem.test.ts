import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, type TestContext } from "vitest";

import { loadProject } from "../src/project/load-project.js";
import { ProjectFilesystem } from "../src/project/project-filesystem.js";
import type { ProjectResult } from "../src/project/project-result.js";

function valueOf<T>(result: ProjectResult<T>): T {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

async function createSymlink(
  context: TestContext,
  target: string,
  link: string,
  directory = false,
): Promise<void> {
  try {
    await symlink(target, link, directory ? "dir" : "file");
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

describe("project loading and filesystem access", () => {
  let temporaryRoot: string;
  let projectRoot: string;
  let siblingRoot: string;
  const source = "This is deliberately neither XML nor an Apartment SVG.";
  const manifest = {
    schema: "planaxis-project/1.0",
    name: "Test apartment",
    architecture: { active: "architecture/existing.svg" },
  };

  beforeEach(async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), "planaxis-project-"));
    projectRoot = path.join(temporaryRoot, "project");
    siblingRoot = path.join(temporaryRoot, "project-sibling");
    await mkdir(path.join(projectRoot, "architecture"), { recursive: true });
    await mkdir(siblingRoot);
    await writeFile(path.join(projectRoot, "planaxis.project.json"), JSON.stringify(manifest));
    await writeFile(path.join(projectRoot, "architecture/existing.svg"), source);
    await writeFile(path.join(siblingRoot, "secret.svg"), "Outside the project");
  });

  afterEach(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it("loads a minimal project independently of Apartment SVG validity and without optional directories", async () => {
    const project = valueOf(await loadProject(projectRoot));
    expect(project.canonicalRoot).toBe(await realpath(projectRoot));
    expect(project.manifest).toEqual(manifest);
    expect(project.activeArchitecturePath).toBe(manifest.architecture.active);
    expect(
      valueOf(await project.filesystem.readFile(project.activeArchitecturePath)).toString("utf8"),
    ).toBe(source);
    expect(await readFile(path.join(projectRoot, "planaxis.project.json"), "utf8")).toBe(
      JSON.stringify(manifest),
    );
  });

  it("allows unrelated extra files, directories, and unaccessed symlinks", async (context) => {
    await writeFile(path.join(projectRoot, "notes.md"), "Personal notes");
    await mkdir(path.join(projectRoot, "unrecognized"));
    await createSymlink(context, siblingRoot, path.join(projectRoot, "unrelated-link"), true);
    expect((await loadProject(projectRoot)).ok).toBe(true);
  });

  it("allows optional directories and remains valid after deleting .planaxis", async () => {
    for (const directory of ["assets", "references", "designs", "outputs", ".planaxis"]) {
      await mkdir(path.join(projectRoot, directory));
    }
    await writeFile(path.join(projectRoot, ".planaxis/cache"), "Disposable");
    expect((await loadProject(projectRoot)).ok).toBe(true);
    await rm(path.join(projectRoot, ".planaxis"), { recursive: true });
    expect((await loadProject(projectRoot)).ok).toBe(true);
  });

  it.each(["assets", "references", "designs", "outputs", ".planaxis"])(
    "rejects a regular file occupying reserved directory %s",
    async (directory) => {
      await writeFile(path.join(projectRoot, directory), "Wrong role");
      expect(await loadProject(projectRoot)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_NOT_DIRECTORY", location: directory },
      });
    },
  );

  it.each([
    ["planaxis.project.json", "PROJECT_NOT_FOUND"],
    ["architecture", "PROJECT_NOT_FOUND"],
    ["architecture/existing.svg", "PROJECT_NOT_FOUND"],
  ])("rejects missing required path %s", async (resource, code) => {
    await rm(path.join(projectRoot, resource), { recursive: true });
    expect(await loadProject(projectRoot)).toMatchObject({
      ok: false,
      error: { code, location: resource },
    });
  });

  it.each(["planaxis.project.json", "architecture/existing.svg"])(
    "rejects a directory in place of regular file %s",
    async (resource) => {
      await rm(path.join(projectRoot, resource));
      await mkdir(path.join(projectRoot, resource));
      expect(await loadProject(projectRoot)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_NOT_REGULAR_FILE", location: resource },
      });
    },
  );

  it("rejects an architecture entry that is not a directory", async () => {
    await rm(path.join(projectRoot, "architecture"), { recursive: true });
    await writeFile(path.join(projectRoot, "architecture"), "Not a directory");
    expect(await loadProject(projectRoot)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_DIRECTORY", location: "architecture" },
    });
  });

  it.each(["planaxis.project.json", "architecture"])(
    "enforces exact reserved spelling for %s on every host",
    async (resource) => {
      await rename(
        path.join(projectRoot, resource),
        path.join(projectRoot, resource.toUpperCase()),
      );
      expect(await loadProject(projectRoot)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_NOT_FOUND", location: resource },
      });
    },
  );

  it.each([
    ["not json", "PROJECT_INVALID_JSON"],
    ["[]", "PROJECT_INVALID_MANIFEST"],
    [JSON.stringify({ ...manifest, schema: "planaxis-project/2.0" }), "PROJECT_UNSUPPORTED_SCHEMA"],
    [JSON.stringify({ ...manifest, name: " " }), "PROJECT_INVALID_MANIFEST"],
    [JSON.stringify({ ...manifest, extra: true }), "PROJECT_INVALID_MANIFEST"],
    [
      JSON.stringify({ ...manifest, architecture: { active: "architecture/existing.SVG" } }),
      "PROJECT_INVALID_ARCHITECTURE_PATH",
    ],
    [
      JSON.stringify({
        ...manifest,
        architecture: { active: "architecture/../../project-sibling/secret.svg" },
      }),
      "PROJECT_INVALID_PATH",
    ],
  ])("propagates manifest validation failure %s", async (text, code) => {
    await writeFile(path.join(projectRoot, "planaxis.project.json"), text);
    expect(await loadProject(projectRoot)).toMatchObject({ ok: false, error: { code } });
  });

  it("loads nested active architecture", async () => {
    await mkdir(path.join(projectRoot, "architecture/variants"));
    await writeFile(path.join(projectRoot, "architecture/variants/open kitchen.svg"), source);
    await writeFile(
      path.join(projectRoot, "planaxis.project.json"),
      JSON.stringify({
        ...manifest,
        architecture: { active: "architecture/variants/open kitchen.svg" },
      }),
    );
    const project = valueOf(await loadProject(projectRoot));
    expect(project.activeArchitecturePath).toBe("architecture/variants/open kitchen.svg");
  });

  it("rejects missing and non-directory physical roots", async () => {
    expect(await loadProject(path.join(temporaryRoot, "missing"))).toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND", location: "projectRoot" },
    });
    expect(await loadProject(path.join(projectRoot, "planaxis.project.json"))).toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_DIRECTORY", location: "projectRoot" },
    });
    expect(await loadProject("")).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_PATH" },
    });
  });

  it("canonicalizes relative and dot-containing root input", async () => {
    const input = path.relative(process.cwd(), projectRoot) + path.sep + ".";
    const project = valueOf(await loadProject(input));
    expect(project.canonicalRoot).toBe(await realpath(projectRoot));
  });

  it("permits symlink indirection in the supplied root", async (context) => {
    const link = path.join(temporaryRoot, "root-link");
    await createSymlink(context, projectRoot, link, true);
    const project = valueOf(await loadProject(link));
    expect(project.canonicalRoot).toBe(await realpath(projectRoot));
    expect(valueOf(await project.filesystem.readFile("architecture/existing.svg")).toString()).toBe(
      source,
    );
  });

  it("rejects symlink replacement of the established root", async (context) => {
    const filesystem = valueOf(await ProjectFilesystem.create(projectRoot));
    await rename(projectRoot, `${projectRoot}-original`);
    await createSymlink(context, `${projectRoot}-original`, projectRoot, true);
    expect(await filesystem.readFile("architecture/existing.svg")).toMatchObject({
      ok: false,
      error: { code: "PROJECT_SYMLINK", location: "projectRoot" },
    });
  });

  it.for(["planaxis.project.json", "architecture/existing.svg", "architecture"])(
    "rejects required symlink %s even when the target is inside the root",
    async (resource, context) => {
      const original = path.join(projectRoot, resource);
      const moved = `${original}-actual`;
      await rename(original, moved);
      await createSymlink(context, moved, original, resource === "architecture");
      expect(await loadProject(projectRoot)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_SYMLINK", location: resource },
      });
    },
  );

  it.for(["target", "intermediate", "dangling"])(
    "rejects %s resource symlinks toward a similarly prefixed sibling",
    async (kind, context) => {
      const filesystem = valueOf(await ProjectFilesystem.create(projectRoot));
      const isDirectory = kind === "intermediate";
      const target =
        kind === "dangling"
          ? path.join(siblingRoot, "missing.svg")
          : isDirectory
            ? siblingRoot
            : path.join(siblingRoot, "secret.svg");
      await createSymlink(context, target, path.join(projectRoot, "link"), isDirectory);
      const resource = isDirectory ? "link/secret.svg" : "link";
      expect(await filesystem.resolve(resource)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_SYMLINK" },
      });
      expect(await filesystem.readFile(resource)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_SYMLINK" },
      });
    },
  );

  it("rechecks symlinks after earlier successful resolution", async (context) => {
    const filesystem = valueOf(await ProjectFilesystem.create(projectRoot));
    expect((await filesystem.resolve("architecture/existing.svg")).ok).toBe(true);
    await rm(path.join(projectRoot, "architecture/existing.svg"));
    await createSymlink(
      context,
      path.join(siblingRoot, "secret.svg"),
      path.join(projectRoot, "architecture/existing.svg"),
    );
    expect(await filesystem.readFile("architecture/existing.svg")).toMatchObject({
      ok: false,
      error: { code: "PROJECT_SYMLINK" },
    });
  });

  it.each([
    "../project-sibling/secret.svg",
    "architecture/../../project-sibling/secret.svg",
    "/secret.svg",
    "C:/secret.svg",
    "file:///secret.svg",
    "architecture\\existing.svg",
    "architecture//existing.svg",
    "architecture/./existing.svg",
    "architecture/existing.svg/",
    "\0",
  ])("refuses unsafe read/resolve input %j", async (resource) => {
    const filesystem = valueOf(await ProjectFilesystem.create(projectRoot));
    expect(await filesystem.resolve(resource)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_PATH" },
    });
    expect(await filesystem.readFile(resource)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_PATH" },
    });
  });

  it("rejects an absolute path to the similarly prefixed sibling", async () => {
    const filesystem = valueOf(await ProjectFilesystem.create(projectRoot));
    expect(await filesystem.readFile(path.join(siblingRoot, "secret.svg"))).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_PATH" },
    });
  });

  it("reads allowed binary resources and resolves directories through the same boundary", async () => {
    const filesystem = valueOf(await ProjectFilesystem.create(projectRoot));
    await mkdir(path.join(projectRoot, "assets"));
    const bytes = Buffer.from([0, 255, 127, 1]);
    await writeFile(path.join(projectRoot, "assets/resource.bin"), bytes);
    expect(valueOf(await filesystem.readFile("assets/resource.bin"))).toEqual(bytes);
    expect(valueOf(await filesystem.resolve("assets", "directory"))).toEqual({
      projectRelativePath: "assets",
      absolutePath: path.join(await realpath(projectRoot), "assets"),
      kind: "directory",
    });
    expect(await filesystem.readFile("assets")).toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_REGULAR_FILE" },
    });
    expect(await filesystem.readFile("assets/resource.bin/child")).toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_DIRECTORY" },
    });
  });

  it("reports unreadable active architecture without parsing it", async (context) => {
    if (process.platform === "win32" || process.getuid?.() === 0) {
      context.skip("POSIX permission denial is unavailable for this host/user.");
    }
    const active = path.join(projectRoot, "architecture/existing.svg");
    await chmod(active, 0);
    try {
      expect(await loadProject(projectRoot)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_INACCESSIBLE", location: "architecture/existing.svg" },
      });
    } finally {
      await chmod(active, 0o600);
    }
  });
});
