import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, onTestFinished, vi } from "vitest";

import * as appModule from "../src/app.js";
import * as projectModule from "../src/project/load-project.js";
import { runServer } from "../src/run-server.js";
import * as startModule from "../src/start-server.js";
import { createTemporaryProject } from "./temporary-project.js";

function observeStartup() {
  const buildSpy = vi.spyOn(appModule, "buildApplication");
  const startSpy = vi.spyOn(startModule, "startServer");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
  return { buildSpy, startSpy, errorSpy };
}

describe("runServer", () => {
  it("loads one project before constructing and starting its application", async () => {
    const { root, manifest, bytes } = await createTemporaryProject();
    const { buildSpy, startSpy } = observeStartup();
    const loadSpy = vi.spyOn(projectModule, "loadProject");
    startSpy.mockImplementation(async (application) => {
      onTestFinished(() => application.close());
      expect((await application.inject("/api/project")).json()).toEqual(manifest);
      expect((await application.inject("/api/project/architecture")).rawPayload).toEqual(bytes);
      return 0;
    });

    expect(await runServer(["--project", root])).toBe(0);
    expect(loadSpy).toHaveBeenCalledExactlyOnceWith(root);
    const loaded = await loadSpy.mock.results[0]?.value;
    expect(loaded?.ok).toBe(true);
    if (!loaded?.ok) throw new Error("Expected a loaded project.");
    expect(buildSpy).toHaveBeenCalledExactlyOnceWith(loaded.value);
    expect(startSpy).toHaveBeenCalledExactlyOnceWith(buildSpy.mock.results[0]?.value);
  });

  it("rejects invalid invocation before loading or constructing an application", async () => {
    const { buildSpy, startSpy, errorSpy } = observeStartup();
    const loadSpy = vi.spyOn(projectModule, "loadProject");
    expect(await runServer([])).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--project"));
    expect(loadSpy).not.toHaveBeenCalled();
    expect(buildSpy).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it.each(["invalid manifest", "missing architecture", "missing root"])(
    "does not construct or start a server for %s",
    async (kind) => {
      const { root, manifest } = await createTemporaryProject();
      if (kind === "invalid manifest") {
        await writeFile(path.join(root, "planaxis.project.json"), "{}");
      } else if (kind === "missing architecture") {
        await rm(path.join(root, manifest.architecture.active));
      }
      const { buildSpy, startSpy, errorSpy } = observeStartup();
      expect(
        await runServer(["--project", kind === "missing root" ? path.join(root, "absent") : root]),
      ).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to load.*PROJECT_/));
      expect(buildSpy).not.toHaveBeenCalled();
      expect(startSpy).not.toHaveBeenCalled();
    },
  );

  it("reports unexpected project loading failures without starting HTTP", async () => {
    const { buildSpy, startSpy, errorSpy } = observeStartup();
    const error = new Error("Unexpected filesystem failure");
    vi.spyOn(projectModule, "loadProject").mockRejectedValue(error);
    expect(await runServer(["--project", "project"])).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("Failed to prepare the PlanAxis server.", error);
    expect(buildSpy).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it("propagates listen failure and closes the prepared application", async () => {
    const { root } = await createTemporaryProject();
    const { startSpy } = observeStartup();
    const closeSpy = vi.fn();
    startSpy.mockImplementation(async (application) => {
      application.addHook("onClose", async () => {
        closeSpy();
      });
      return 1;
    });
    expect(await runServer(["--project", root])).toBe(1);
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});
