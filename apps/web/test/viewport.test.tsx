import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SvgViewport } from "../src/svg-viewport.js";
import { fitDrawing, panDrawing, zoomDrawing } from "../src/view-transform.js";

describe("viewport pixel transforms", () => {
  it("fits and centers the entire image with padding", () => {
    expect(fitDrawing({ width: 848, height: 648 }, { width: 400, height: 200 })).toEqual({
      scale: 2,
      x: 24,
      y: 124,
    });
  });
  it("zooms around the cursor and pans without changing scale", () => {
    const initial = { x: 24, y: 124, scale: 2 };
    const zoomed = zoomDrawing(initial, 2, { x: 424, y: 324 });
    expect(zoomed).toEqual({ x: -376, y: -76, scale: 4 });
    expect(panDrawing(zoomed, { x: 20, y: -10 })).toEqual({ x: -356, y: -86, scale: 4 });
    expect(zoomDrawing(initial, 0, { x: 0, y: 0 }).scale).toBeGreaterThan(0);
  });
});

it("fits on image load and wires zoom, keyboard, drag, pinch, wheel, and reset", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:viewport");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SvgViewport source="<svg/>" name="drawing.svg" />));
    const surface = host.querySelector<HTMLDivElement>(".drawing-surface");
    const image = host.querySelector("img");
    if (!surface || !image) throw new Error("Missing viewport");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 848, 648));
    surface.setPointerCapture = vi.fn();
    Object.defineProperties(image, { naturalWidth: { value: 400 }, naturalHeight: { value: 200 } });
    await act(async () => {
      image.dispatchEvent(new Event("load"));
    });
    expect(image.style.transform).toBe("translate(24px, 124px) scale(2)");
    async function click(label: string): Promise<void> {
      await act(async () =>
        host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click(),
      );
    }
    await click("Zoom in");
    expect(host.querySelector("output")?.textContent).toBe("250%");
    await click("Zoom out");
    expect(host.querySelector("output")?.textContent).toBe("200%");
    await act(async () => {
      surface.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(image.style.transform).toBe("translate(64px, 124px) scale(2)");
    async function pointer(
      type: string,
      pointerId: number,
      clientX: number,
      clientY: number,
    ): Promise<void> {
      await act(async () => {
        surface?.dispatchEvent(
          new PointerEvent(type, { bubbles: true, pointerId, clientX, clientY, button: 0 }),
        );
      });
    }
    await pointer("pointerdown", 1, 100, 100);
    await pointer("pointermove", 1, 120, 110);
    expect(image.style.transform).toBe("translate(84px, 134px) scale(2)");
    await pointer("pointerdown", 2, 220, 110);
    await pointer("pointermove", 2, 320, 110);
    expect(host.querySelector("output")?.textContent).toBe("400%");
    await pointer("pointercancel", 1, 120, 110);
    await pointer("pointerup", 2, 320, 110);
    const before = image.style.transform;
    await pointer("pointermove", 1, 0, 0);
    expect(image.style.transform).toBe(before);
    await act(async () => {
      surface.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -100, clientX: 424, clientY: 324, cancelable: true }),
      );
    });
    expect(host.querySelector("output")?.textContent).not.toBe("400%");
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Fit / Reset")
        ?.click();
    });
    expect(image.style.transform).toBe("translate(24px, 124px) scale(2)");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    expect(revoke).toHaveBeenCalledWith("blob:viewport");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
