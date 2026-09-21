import * as fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { loadProject } from "../src/project/load-project.js";
import { createTemporaryProject } from "./temporary-project.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open), rename: vi.fn(actual.rename) };
});

afterEach(() => vi.restoreAllMocks());

async function setup() {
  const fixture = await createTemporaryProject();
  const loaded = await loadProject(fixture.root);
  if (!loaded.ok) throw new Error(loaded.error.message);
  await fs.mkdir(path.join(fixture.root, "designs"));
  await fs.writeFile(path.join(fixture.root, "designs/existing.json"), "original descriptor");
  return { ...fixture, filesystem: loaded.value.filesystem };
}

describe("design filesystem writes", () => {
  it.each(["partial write", "sync", "rename"])(
    "preserves the authoritative file and cleans staging after a %s failure",
    async (failure) => {
      const { root, filesystem } = await setup();
      const cause = Object.assign(new Error("Injected storage failure"), { code: "EIO" });
      if (failure === "rename") {
        vi.mocked(fs.rename).mockRejectedValueOnce(cause);
      } else {
        const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
        vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
          // The first open checks target readability; inject failure only in the staged write.
          const handle = await actual.open(...args);
          return handle;
        });
        vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
          const handle = await actual.open(...args);
          if (failure === "sync") vi.spyOn(handle, "sync").mockRejectedValueOnce(cause);
          else {
            const write = handle.writeFile.bind(handle);
            vi.spyOn(handle, "writeFile").mockImplementationOnce(async () => {
              await write("partially written");
              throw cause;
            });
          }
          return handle;
        });
      }
      await expect(
        filesystem.writeDesignFile("designs/existing.json", "replacement", "update"),
      ).rejects.toThrow("Unexpected project filesystem failure");
      expect(await fs.readFile(path.join(root, "designs/existing.json"), "utf8")).toBe(
        "original descriptor",
      );
      expect(await fs.readdir(path.join(root, "designs"))).toEqual(["existing.json"]);
    },
  );

  it("does not create an update target removed while staging", async () => {
    const { root, filesystem } = await setup();
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(fs.open)
      .mockImplementationOnce(actual.open)
      .mockImplementationOnce(async (...args) => {
        const handle = await actual.open(...args);
        await fs.unlink(path.join(root, "designs/existing.json"));
        return handle;
      });
    expect(
      await filesystem.writeDesignFile("designs/existing.json", "replacement", "update"),
    ).toMatchObject({ ok: false, error: { code: "PROJECT_NOT_FOUND" } });
    expect(await fs.readdir(path.join(root, "designs"))).toEqual([]);
  });

  it("does not expose a partial descriptor when creation fails", async () => {
    const { root, filesystem } = await setup();
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
      const handle = await actual.open(...args);
      vi.spyOn(handle, "sync").mockRejectedValueOnce(
        Object.assign(new Error("Storage full"), { code: "ENOSPC" }),
      );
      return handle;
    });
    await expect(
      filesystem.writeDesignFile("designs/new.json", "replacement", "create"),
    ).rejects.toThrow();
    expect(await fs.readdir(path.join(root, "designs"))).toEqual(["existing.json"]);
  });

  it("skips inaccessible candidates without reading their contents", async () => {
    const { root, filesystem } = await setup();
    await fs.writeFile(path.join(root, "designs/readable.json"), "malformed");
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const spy = vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      if (String(args[0]).endsWith("existing.json"))
        throw Object.assign(new Error("Denied"), { code: "EACCES" });
      const handle = await actual.open(...args);
      vi.spyOn(handle, "readFile").mockRejectedValue(new Error("Discovery must not read contents"));
      return handle;
    });
    expect(await filesystem.listFiles("designs", ".json")).toEqual({
      ok: true,
      value: ["designs/readable.json"],
    });
    spy.mockRestore();
  });

  it("rejects writes outside designs and non-directory parents", async () => {
    const { root, filesystem } = await setup();
    for (const relative of [
      "architecture/existing.svg",
      "planaxis.project.json",
      "assets/a.json",
      "references/a.json",
      "outputs/a.json",
      ".planaxis/a.json",
      "designs/../outside.json",
    ]) {
      expect(await filesystem.writeDesignFile(relative, "replacement", "create")).toMatchObject({
        ok: false,
        error: { code: "PROJECT_INVALID_PATH" },
      });
    }
    expect(
      await filesystem.writeDesignFile(
        "designs/existing.json/nested.json",
        "replacement",
        "create",
      ),
    ).toMatchObject({ ok: false, error: { code: "PROJECT_NOT_DIRECTORY" } });
    await fs.mkdir(path.join(root, "designs/directory.json"));
    expect(
      await filesystem.writeDesignFile("designs/directory.json", "replacement", "create"),
    ).toMatchObject({ ok: false, error: { code: "PROJECT_ALREADY_EXISTS" } });
    expect(
      await filesystem.writeDesignFile("designs/directory.json", "replacement", "update"),
    ).toMatchObject({ ok: false, error: { code: "PROJECT_NOT_REGULAR_FILE" } });
  });

  it("refuses discovery and writes after the established root is replaced", async () => {
    const { root, filesystem } = await setup();
    const moved = `${root}-original`;
    await fs.rename(root, moved);
    onTestFinished(() => fs.rm(moved, { recursive: true, force: true }));
    await fs.mkdir(root);
    for (const result of [
      await filesystem.listFiles("designs", ".json"),
      await filesystem.writeDesignFile("designs/new.json", "replacement", "create"),
      await filesystem.writeDesignFile("designs/existing.json", "replacement", "update"),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "PROJECT_RESOURCE_CHANGED" } });
    expect(await fs.readdir(root)).toEqual([]);
    expect(await fs.readFile(path.join(moved, "designs/existing.json"), "utf8")).toBe(
      "original descriptor",
    );
  });
});
