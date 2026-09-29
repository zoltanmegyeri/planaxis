import { expect, it } from "vitest";
import { deriveDaylight } from "@planaxis/simulation";
import { daylightSunColor } from "../src/physical-sky.js";

it("maps neutral high daylight, orange low Sun, and cooler Overcast into linear renderer color", () => {
  const high = daylightSunColor(deriveDaylight(60));
  const low = daylightSunColor(deriveDaylight(1));
  const overcast = daylightSunColor(deriveDaylight(60, "overcast"));
  expect(high.r / high.b).toBeLessThan(1.3);
  expect(low.r / low.b).toBeGreaterThan(10);
  expect(overcast.b / overcast.r).toBeGreaterThan(1.5);
});
