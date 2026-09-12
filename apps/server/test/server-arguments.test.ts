import { describe, expect, it } from "vitest";

import { parseServerArguments } from "../src/server-arguments.js";

describe("parseServerArguments", () => {
  it.each([
    "./my project",
    "../projects/apartment",
    "/projects/apartment",
    "C:\\projects\\apartment",
  ])("preserves the supplied startup path %s", (projectRoot) => {
    expect(parseServerArguments(["--project", projectRoot])).toEqual({ ok: true, projectRoot });
  });

  it.each([
    [],
    ["--project"],
    ["--project", ""],
    ["--project", "\0"],
    ["--project", "--unknown"],
    ["--project", "-p"],
    ["--project", "--project", "project"],
    ["--project", "first", "--project", "second"],
    ["--project", "first", "--project"],
    ["--project=project"],
    ["project"],
    ["--help"],
    ["--host", "0.0.0.0", "--project", "project"],
    ["--project", "project", "extra"],
    ["--project", "project", "--port", "3001"],
  ])("rejects invalid invocation %j", (...args) => {
    expect(parseServerArguments(args)).toMatchObject({ ok: false, message: expect.any(String) });
  });
});
