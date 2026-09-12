import { describe, expect, it } from "vitest";
import config from "../vite.config.js";

describe("development project API proxy", () => {
  const proxy = config.server?.proxy ?? {};
  function targetFor(path: string): unknown {
    return Object.entries(proxy).find(([pattern]) => new RegExp(pattern).test(path))?.[1];
  }

  it.each(["/api/project", "/api/project/architecture", "/api/project?unexpected=1"])(
    "forwards %s to the loopback server without rewriting the request",
    (path) => {
      expect(targetFor(path)).toBe("http://127.0.0.1:3000");
    },
  );

  it.each([
    "/api/projects",
    "/api/project/assets",
    "/api/other",
    "/architecture/a.svg",
    "/.planaxis/cache",
    "/health",
  ])("does not proxy unrelated path %s", (path) => {
    expect(targetFor(path)).toBeUndefined();
  });
});
