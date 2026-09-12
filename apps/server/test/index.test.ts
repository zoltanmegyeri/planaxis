import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createTemporaryProject } from "./temporary-project.js";

describe("server process entry point", () => {
  it.each(["invalid invocation", "invalid project"])(
    "sets a non-zero process status for %s",
    async (kind) => {
      const { root } = await createTemporaryProject();
      const originalArguments = process.argv;
      const originalExitCode = process.exitCode;
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.resetModules();
      process.argv = [
        process.execPath,
        "server",
        ...(kind === "invalid project" ? ["--project", path.join(root, "missing")] : []),
      ];
      process.exitCode = 0;
      try {
        await import("../src/index.js");
        expect(process.exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        process.argv = originalArguments;
        process.exitCode = originalExitCode;
        errorSpy.mockRestore();
      }
    },
  );
});
