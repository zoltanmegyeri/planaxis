import Fastify from "fastify";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { startServer } from "../src/start-server.js";

describe("startServer", () => {
  it("defaults to loopback on port 3000", async () => {
    const application = Fastify();
    onTestFinished(() => application.close());
    const listenSpy = vi.spyOn(application, "listen").mockResolvedValue(undefined);
    expect(await startServer(application)).toBe(0);
    expect(listenSpy).toHaveBeenCalledWith({ host: "127.0.0.1", port: 3000 });
  });

  it("reports an occupied port and returns a non-zero exit code", async () => {
    const application = Fastify();
    onTestFinished(() => application.close());
    const error = Object.assign(new Error("Address in use"), { code: "EADDRINUSE" });
    vi.spyOn(application, "listen").mockRejectedValue(error);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    onTestFinished(() => errorSpy.mockRestore());

    expect(await startServer(application, { host: "127.0.0.1", port: 3210 })).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/PlanAxis server.*port 3210 is already in use/i),
      expect.objectContaining({ code: "EADDRINUSE" }),
    );
  });

  it("does not classify an unrelated startup error as a port conflict", async () => {
    const application = Fastify();
    onTestFinished(() => application.close());
    const unexpectedError = new Error("Unexpected startup failure");
    vi.spyOn(application, "listen").mockRejectedValue(unexpectedError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    onTestFinished(() => errorSpy.mockRestore());

    expect(await startServer(application)).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("Failed to start the PlanAxis server.", unexpectedError);
    expect(errorSpy.mock.calls[0]?.[0]).not.toContain("already in use");
  });
});
