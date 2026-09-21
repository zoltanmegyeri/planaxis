import { mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, onTestFinished, vi, type TestContext } from "vitest";

import { buildApplication } from "../src/app.js";
import { loadProject } from "../src/project/load-project.js";
import { createTemporaryProject } from "./temporary-project.js";

const design = {
  schema: "planaxis-design/1.0",
  name: "  Warm modern  ",
  architecture: "architecture/missing.svg",
  finishes: [{ target: "wall:missing:side-positive", material: "assets/materials/missing" }],
  presentation: { toneMapping: "agx", exposureEv: 6 },
};

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

function designUrl(relative: string) {
  return `/api/project/design?path=${encodeURIComponent(relative)}`;
}

describe("design persistence HTTP APIs", () => {
  it("returns an empty discovery list without creating designs", async () => {
    const { application, root } = await setup();
    const response = await application.inject("/api/project/designs");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ designs: [] });
    expect(await readdir(root)).not.toContain("designs");
  });

  it("discovers sorted nested candidates and preserves unsupported and malformed bytes on read", async () => {
    const { application, root } = await setup();
    await mkdir(path.join(root, "designs/nested.json"), { recursive: true });
    const candidates = ["designs/z.json", "designs/nested.json/other.json", "designs/a.json"];
    const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0, 255, 128, 13, 10]);
    for (const candidate of candidates) await writeFile(path.join(root, candidate), bytes);
    await writeFile(path.join(root, "designs/a.json"), '{"schema":"future/99"}');
    await writeFile(path.join(root, "designs/ignored.JSON"), "{}");
    await writeFile(path.join(root, "designs/ignored.txt"), "{}");
    const response = await application.inject("/api/project/designs");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ designs: candidates.sort() });
    for (const candidate of candidates) {
      const read = await application.inject(designUrl(candidate));
      expect(read.statusCode).toBe(200);
      expect(read.rawPayload).toEqual(await readFile(path.join(root, candidate)));
      expect(read.headers["content-type"]).toBe("application/octet-stream");
      expect(read.headers["x-content-type-options"]).toBe("nosniff");
    }
  });

  it.each(["designs/first.json", "designs/concepts/nested/first.json"])(
    "creates %s with exact formatting and no resource resolution",
    async (relative) => {
      const { application, root, manifest, bytes } = await setup();
      const response = await application.inject({
        method: "POST",
        url: designUrl(relative),
        payload: design,
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ path: relative });
      expect(await readFile(path.join(root, relative), "utf8")).toBe(
        `${JSON.stringify(design, null, 2)}\n`,
      );
      expect((await application.inject(designUrl(relative))).json()).toEqual(design);
      expect(await readFile(path.join(root, "planaxis.project.json"), "utf8")).toBe(
        JSON.stringify(manifest),
      );
      expect(await readFile(path.join(root, manifest.architecture.active))).toEqual(bytes);
      expect((await readdir(root)).sort()).toEqual([
        "architecture",
        "designs",
        "planaxis.project.json",
      ]);
    },
  );

  it("rejects conflicts without overwriting and atomically replaces an existing invalid descriptor", async () => {
    const { application, root } = await setup();
    await mkdir(path.join(root, "designs"));
    await writeFile(path.join(root, "designs/test.json"), "invalid original\r\n");
    const url = designUrl("designs/test.json");
    expect((await application.inject({ method: "POST", url, payload: design })).statusCode).toBe(
      409,
    );
    expect(await readFile(path.join(root, "designs/test.json"), "utf8")).toBe(
      "invalid original\r\n",
    );
    const updated = {
      schema: design.schema,
      name: "Updated",
      architecture: "architecture/existing.svg",
    };
    const response = await application.inject({ method: "PUT", url, payload: updated });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(await readFile(path.join(root, "designs/test.json"), "utf8")).toBe(
      `${JSON.stringify(updated, null, 2)}\n`,
    );
    expect(await readdir(path.join(root, "designs"))).toEqual(["test.json"]);
  });

  it("returns 404 for missing reads and updates without creating parents", async () => {
    const { application, root } = await setup();
    for (const method of ["GET", "PUT"] as const) {
      const response = await application.inject({
        method,
        url: designUrl("designs/missing/file.json"),
        ...(method === "PUT" ? { payload: design } : {}),
      });
      expect(response.statusCode).toBe(404);
    }
    expect(await readdir(root)).not.toContain("designs");
  });

  it("allows only one concurrent create to publish", async () => {
    const { application, root } = await setup();
    const url = designUrl("designs/nested/test.json");
    const responses = await Promise.all([
      application.inject({ method: "POST", url, payload: design }),
      application.inject({ method: "POST", url, payload: { ...design, name: "Second" } }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const winner = responses[0]?.statusCode === 201 ? design : { ...design, name: "Second" };
    expect(JSON.parse(await readFile(path.join(root, "designs/nested/test.json"), "utf8"))).toEqual(
      winner,
    );
    expect(await readdir(path.join(root, "designs/nested"))).toEqual(["test.json"]);
  });

  it.each([
    [{ ...design, schema: "future/2" }, "DESIGN_UNSUPPORTED_SCHEMA", "$.schema"],
    [{ ...design, name: " " }, "DESIGN_INVALID_NAME", "$.name"],
    [{ ...design, extra: true }, "DESIGN_UNKNOWN_PROPERTY", "$.extra"],
    [
      { ...design, presentation: { toneMapping: "other" } },
      "DESIGN_INVALID_TONE_MAPPING",
      "$.presentation.toneMapping",
    ],
    [
      { ...design, presentation: { extra: true } },
      "DESIGN_UNKNOWN_PROPERTY",
      "$.presentation.extra",
    ],
    [
      { ...design, finishes: [...design.finishes, ...design.finishes] },
      "DESIGN_DUPLICATE_TARGET",
      "$.finishes[1].target",
    ],
    [
      { ...design, finishes: [{ target: "floor", material: "../outside" }] },
      "DESIGN_INVALID_MATERIAL_PATH",
      "$.finishes[0].material",
    ],
    [
      { ...design, architecture: "/private/secret.svg" },
      "DESIGN_INVALID_ARCHITECTURE_PATH",
      "$.architecture",
    ],
    [{ document: design }, "DESIGN_UNKNOWN_PROPERTY", "$.document"],
    [[], "DESIGN_INVALID_OBJECT", "$"],
  ])(
    "returns a structured design failure without durable changes: %s",
    async (payload, code, location) => {
      const { application, root } = await setup();
      await mkdir(path.join(root, "designs"));
      await writeFile(path.join(root, "designs/existing.json"), "original");
      for (const method of ["POST", "PUT"] as const) {
        const relative = method === "POST" ? "designs/new/file.json" : "designs/existing.json";
        const response = await application.inject({ method, url: designUrl(relative), payload });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
          error: { code, location, message: expect.any(String) },
        });
        expect(response.body).not.toContain(root);
      }
      expect(await readFile(path.join(root, "designs/existing.json"), "utf8")).toBe("original");
      expect(await readdir(path.join(root, "designs"))).toEqual(["existing.json"]);
    },
  );

  it.each(["{", "", "null", '{"__proto__":{}}', '{"constructor":{"prototype":{}}}'])(
    "rejects invalid JSON bodies without silently removing keys: %s",
    async (payload) => {
      const { application, root } = await setup();
      const response = await application.inject({
        method: "POST",
        url: designUrl("designs/new.json"),
        headers: { "content-type": "application/json" },
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: expect.stringMatching(/^DESIGN_/),
          location: expect.any(String),
          message: expect.any(String),
        },
      });
      expect(await readdir(root)).not.toContain("designs");
    },
  );

  it.each(["GET", "POST", "PUT"] as const)(
    "rejects invalid descriptor paths for %s",
    async (method) => {
      const { application, root } = await setup();
      for (const relative of [
        "../outside.json",
        "/tmp/design.json",
        "C:/design.json",
        "file:design.json",
        "designs/../outside.json",
        "designs/./a.json",
        "designs//a.json",
        "designs\\a.json",
        "designs/a.JSON",
        "designs/.json",
        "designs/a.svg",
        "architecture/a.json",
        ".planaxis/a.json",
        "designs/a\0.json",
        "",
      ]) {
        const response = await application.inject({
          method,
          url: designUrl(relative),
          ...(method === "GET" ? {} : { payload: design }),
        });
        expect(response.statusCode, relative).toBe(400);
        expect(response.body).not.toContain(root);
      }
      expect(await readdir(root)).not.toContain("designs");
    },
  );

  it.each(["GET", "POST", "PUT"] as const)(
    "requires exactly one query parameter for %s",
    async (method) => {
      const { application } = await setup();
      for (const query of [
        "",
        "?other=x",
        "?path=designs/a.json&path=designs/b.json",
        "?path=designs/a.json&unknown=x",
        "?path=designs/a.json&__proto__=x",
      ]) {
        expect(
          (
            await application.inject({
              method,
              url: `/api/project/design${query}`,
              ...(method === "GET" ? {} : { payload: design }),
            })
          ).statusCode,
        ).toBe(400);
      }
    },
  );

  it.for(["file", "directory", "designs", "dangling"])(
    "never traverses a %s symlink during discovery, reads or writes",
    async (kind, context) => {
      const { application, root } = await setup();
      const outside = await createTemporaryProject();
      await writeFile(path.join(outside.root, "secret.json"), "outside original");
      const isDirectory = kind === "directory" || kind === "designs";
      if (kind !== "designs") await mkdir(path.join(root, "designs"));
      const link =
        kind === "designs"
          ? "designs"
          : kind === "directory"
            ? "designs/link"
            : "designs/link.json";
      const target =
        kind === "dangling"
          ? path.join(outside.root, "missing.json")
          : isDirectory
            ? outside.root
            : path.join(outside.root, "secret.json");
      await linkForTest(context, target, path.join(root, link), isDirectory);
      const relative = isDirectory ? `${link}/secret.json` : link;
      const discovery = await application.inject("/api/project/designs");
      if (kind === "designs") expect(discovery.statusCode).toBe(403);
      else expect(discovery.json()).toEqual({ designs: [] });
      for (const method of ["GET", "POST", "PUT"] as const) {
        expect(
          (
            await application.inject({
              method,
              url: designUrl(relative),
              ...(method === "GET" ? {} : { payload: design }),
            })
          ).statusCode,
        ).toBe(403);
      }
      expect(await readFile(path.join(outside.root, "secret.json"), "utf8")).toBe(
        "outside original",
      );
      expect(await readdir(outside.root)).not.toContain("missing.json");
    },
  );

  it("rechecks a discovered path before reading or writing", async (context) => {
    const { application, root } = await setup();
    await mkdir(path.join(root, "designs"));
    await writeFile(path.join(root, "designs/a.json"), "old");
    expect((await application.inject("/api/project/designs")).json()).toEqual({
      designs: ["designs/a.json"],
    });
    await rename(path.join(root, "designs"), path.join(root, "saved-designs"));
    await linkForTest(context, path.join(root, "saved-designs"), path.join(root, "designs"), true);
    expect((await application.inject(designUrl("designs/a.json"))).statusCode).toBe(403);
    expect(
      (
        await application.inject({
          method: "PUT",
          url: designUrl("designs/a.json"),
          payload: design,
        })
      ).statusCode,
    ).toBe(403);
    expect(await readFile(path.join(root, "saved-designs/a.json"), "utf8")).toBe("old");
  });

  it.each(["listFiles", "readFile", "writeDesignFile"] as const)(
    "logs and hides unexpected %s failures",
    async (method) => {
      const { application, project } = await setup();
      const error = new Error(`Private infrastructure failure: ${project.canonicalRoot}`);
      const spy = vi.spyOn(project.filesystem, method).mockRejectedValue(error);
      const log = vi.fn();
      application.addHook("onRequest", async (request) => {
        vi.spyOn(request.log, "error").mockImplementation(log);
      });
      onTestFinished(() => {
        spy.mockRestore();
      });
      const response =
        method === "listFiles"
          ? await application.inject("/api/project/designs")
          : await application.inject({
              method: method === "readFile" ? "GET" : "POST",
              url: designUrl("designs/a.json"),
              ...(method === "writeDesignFile" ? { payload: design } : {}),
            });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: "Unable to complete the project resource operation.",
      });
      expect(response.body).not.toContain(project.canonicalRoot);
      expect(log).toHaveBeenCalledWith({ err: error }, "Project resource operation failed.");
    },
  );
});

describe("selected architecture resource HTTP API", () => {
  it("reads a non-active architecture without validation and preserves active behavior", async () => {
    const { application, root, bytes } = await setup();
    await mkdir(path.join(root, "architecture/nested"));
    const other = Buffer.from([0, 255, 128, 13, 10]);
    await writeFile(path.join(root, "architecture/nested/other.svg"), other);
    const response = await application.inject(
      "/api/project/architecture-resource?path=architecture/nested/other.svg",
    );
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(other);
    expect(response.headers["content-type"]).toBe("application/octet-stream");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect((await application.inject("/api/project/architecture")).rawPayload).toEqual(bytes);
    expect(
      (await application.inject("/api/project/architecture?path=architecture/nested/other.svg"))
        .statusCode,
    ).toBe(400);
  });

  it("rejects invalid architecture selectors and unrestricted resource access", async () => {
    const { application } = await setup();
    for (const relative of [
      "../outside.svg",
      "/tmp/a.svg",
      "architecture\\a.svg",
      "architecture/./a.svg",
      "architecture/../a.svg",
      "architecture/a.SVG",
      "architecture/.svg",
      "architecture/a.json",
      "designs/a.svg",
      ".planaxis/a.svg",
      "planaxis.project.json",
    ]) {
      expect(
        (
          await application.inject(
            `/api/project/architecture-resource?path=${encodeURIComponent(relative)}`,
          )
        ).statusCode,
        relative,
      ).toBe(400);
    }
    for (const query of [
      "",
      "?path=architecture/a.svg&path=architecture/b.svg",
      "?path=architecture/a.svg&file=notes",
    ]) {
      expect(
        (await application.inject(`/api/project/architecture-resource${query}`)).statusCode,
      ).toBe(400);
    }
    expect(
      (await application.inject("/api/project/architecture-resource?path=architecture/missing.svg"))
        .statusCode,
    ).toBe(404);
    expect(
      (await application.inject("/api/project/files?path=planaxis.project.json")).statusCode,
    ).toBe(404);
  });

  it.for(["file", "directory"])(
    "rejects architecture %s symlink traversal",
    async (kind, context) => {
      const { application, root } = await setup();
      const isDirectory = kind === "directory";
      await linkForTest(
        context,
        path.join(root, "architecture"),
        path.join(root, "architecture/link"),
        true,
      );
      if (!isDirectory) {
        await rm(path.join(root, "architecture/link"));
        await linkForTest(
          context,
          path.join(root, "architecture/existing.svg"),
          path.join(root, "architecture/link.svg"),
          false,
        );
      }
      const relative = isDirectory ? "architecture/link/existing.svg" : "architecture/link.svg";
      expect(
        (await application.inject(`/api/project/architecture-resource?path=${relative}`))
          .statusCode,
      ).toBe(403);
    },
  );
});
