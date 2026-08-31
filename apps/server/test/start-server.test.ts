import { createServer } from "node:net";

import { describe, expect, it, vi } from "vitest";

import { buildApplication } from "../src/app.js";
import { startServer } from "../src/start-server.js";

async function occupyEphemeralPort(): Promise<{
  readonly close: () => Promise<void>;
  readonly port: number;
}> {
  const portOwner = createServer();

  await new Promise<void>((resolve, reject) => {
    portOwner.once("error", reject);
    portOwner.listen({ host: "127.0.0.1", port: 0 }, () => {
      portOwner.off("error", reject);
      resolve();
    });
  });

  const address = portOwner.address();

  if (address === null || typeof address === "string") {
    portOwner.close();
    throw new Error("Expected the occupied test port to have an IP address.");
  }

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        portOwner.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
    port: address.port,
  };
}

describe("startServer", () => {
  it("reports an occupied port and returns a non-zero exit code", async () => {
    const occupiedPort = await occupyEphemeralPort();
    const application = buildApplication();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const exitCode = await startServer(application, {
        host: "127.0.0.1",
        port: occupiedPort.port,
      });

      expect(exitCode).not.toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`PlanAxis server.*port ${occupiedPort.port} is already in use`, "i"),
        ),
        expect.objectContaining({ code: "EADDRINUSE" }),
      );
    } finally {
      errorSpy.mockRestore();
      await application.close();
      await occupiedPort.close();
    }
  });

  it("does not classify an unrelated startup error as a port conflict", async () => {
    const application = buildApplication();
    const unexpectedError = new Error("Unexpected startup failure");
    vi.spyOn(application, "listen").mockRejectedValue(unexpectedError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const exitCode = await startServer(application, {
        host: "127.0.0.1",
        port: 3000,
      });

      expect(exitCode).not.toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to start the PlanAxis server.",
        unexpectedError,
      );
      expect(errorSpy.mock.calls[0]?.[0]).not.toContain("already in use");
    } finally {
      errorSpy.mockRestore();
      await application.close();
    }
  });
});
