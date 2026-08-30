import { describe, expect, it } from "vitest";

import { buildApplication } from "../src/app.js";

describe("buildApplication", () => {
  it("serves the health endpoint in process", async () => {
    const application = buildApplication();

    try {
      const response = await application.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await application.close();
    }
  });
});
