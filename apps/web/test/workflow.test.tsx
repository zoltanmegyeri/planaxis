import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";
import { processDocument } from "../src/process-document.js";
import { useDocument } from "../src/use-document.js";
import type { DocumentState } from "../src/use-document.js";
import * as model3D from "@planaxis/model-3d";
import * as processing from "../src/process-document.js";

const rendererMocks = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>(),
  setModel: vi.fn(),
  resize: vi.fn(),
  selectCamera: vi.fn(),
  setFocalLengthOverride: vi.fn(),
  render: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("@planaxis/renderer-three", () => ({
  createApartmentRenderer: () => rendererMocks,
  FULL_FRAME_FOCAL_LENGTHS: [16, 24, 35, 50, 70, 85],
  isFullFrameFocalLength: (value: number) => [16, 24, 35, 50, 70, 85].includes(value),
}));

const fixture = (path: string): string =>
  readFileSync(resolve(fileURLToPath(import.meta.url), "../../../../fixtures", path), "utf8");
const validSource = fixture("valid/minimal-document-schema.svg");
let host: HTMLDivElement;
let root: Root;
let nextUrl = 0;
const createUrl = vi.fn((blob: Blob | MediaSource) => {
  void blob;
  return `blob:preview-${++nextUrl}`;
});
const revokeUrl = vi.fn();

beforeEach(() => {
  rendererMocks.initialize.mockResolvedValue();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(URL, "createObjectURL").mockImplementation(createUrl);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeUrl);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function render(element: ReactElement = <App />): Promise<void> {
  await act(async () => root.render(element));
}
function file(source = validSource, name = "apartment.svg"): File {
  return new File([source], name, { type: "image/svg+xml" });
}
async function pick(files: File[]): Promise<void> {
  const input = host.querySelector("input");
  if (!input) throw new Error("Missing file picker");
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function drop(files: File[]): Promise<void> {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  await act(async () => {
    host.firstElementChild?.dispatchEvent(event);
  });
}

it("starts empty with keyboard-accessible open actions and textual status", async () => {
  await render();
  expect(host.textContent).toContain("Drop your floor plan here");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("No document");
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
    "Open SVG",
    "Browse files",
  ]);
  expect(host.querySelector('[aria-label="Enter Focus view"]')).toBeNull();
  expect(host.querySelector("img")).toBeNull();
});

it("opens a valid file through the picker and exposes all-stage success", async () => {
  await render();
  await pick([file()]);
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Valid");
  expect(host.textContent).toContain("trusted 2D apartment model is ready");
  expect(host.textContent).toContain("apartment.svg");
  expect(host.querySelector("img")?.src).toMatch(/^blob:preview-/);
});

describe("stage diagnostics", () => {
  it.each([
    ["invalid/malformed-xml.svg", "Parser", "malformed-xml"],
    ["invalid/missing-cameras-group.svg", "Schema", "APSVG-"],
    ["invalid/multiple-broken-wall-references.svg", "Reference", "APSVG-REF-"],
    ["invalid/footprint-diagonal-edge.svg", "Geometry", "APSVG-FOOTPRINT-"],
  ])(
    "presents %s without treating invalid input as a processing failure",
    async (path, stage, code) => {
      await render();
      await drop([file(fixture(path))]);
      expect(host.querySelector('[role="status"]')?.textContent).toBe("Invalid");
      expect(host.textContent).toContain(`${stage} validation failed`);
      expect(host.textContent).toContain(code);
      const result = processDocument(fixture(path));
      if (result.status !== "invalid") throw new Error("Expected invalid fixture");
      if (result.stage === "Parser") {
        expect(host.textContent).toContain(result.error.message);
        if (result.error.location)
          expect(host.textContent).toContain(
            `Line ${result.error.location.line}, column ${result.error.location.column}`,
          );
      } else {
        for (const error of result.errors)
          for (const value of Object.values(error)) expect(host.textContent).toContain(value);
      }
    },
  );
});

it("keeps renderable invalid source in a safe image and releases replaced/disposed URLs", async () => {
  await render();
  await pick([file()]);
  const firstUrl = host.querySelector("img")?.src;
  const invalid =
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><script>window.bad = true</script><rect width="100" height="100"/></svg>';
  await drop([file(invalid, "drawing.txt")]);
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Invalid");
  expect(host.querySelector("img")).not.toBeNull();
  expect(host.querySelector("svg, script, object, iframe")).toBeNull();
  expect(revokeUrl).toHaveBeenCalledWith(firstUrl);
  const blob = createUrl.mock.calls.at(-1)?.[0];
  expect(blob).toBeDefined();
  const lastUrl = host.querySelector("img")?.src;
  await act(async () => root.unmount());
  expect(revokeUrl).toHaveBeenCalledWith(lastUrl);
  root = createRoot(host);
});

it("shows preview failure independently of validation and lets details collapse", async () => {
  await render();
  await pick([file()]);
  await act(async () => {
    host.querySelector("img")?.dispatchEvent(new Event("error"));
  });
  expect(host.textContent).toContain("Preview unavailable");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Valid");
  const toggle = host.querySelector<HTMLButtonElement>('[aria-controls="validation-details"]');
  await act(async () => toggle?.click());
  expect(host.querySelector("aside")).toBeNull();
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
});

it("handles read errors, multiple drops, and unexpected processing failures", async () => {
  await render();
  const unreadable = file();
  vi.spyOn(unreadable, "text").mockRejectedValue(new Error("Read denied"));
  await pick([unreadable]);
  expect(host.textContent).toContain("File read failure: Read denied");
  await drop([file(), file()]);
  expect(host.textContent).toContain("Open exactly one SVG file");
  vi.spyOn(processing, "processDocument").mockImplementation(() => {
    throw new Error("Internal invariant failed");
  });
  await pick([file()]);
  expect(host.textContent).toContain("Unexpected processing failure: Internal invariant failed");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("File / processing failure");
  expect(host.querySelector("img")).not.toBeNull();
});

it("retains the trusted model and clears it immediately on replacement, ignoring stale reads", async () => {
  let state: DocumentState = { status: "empty" };
  const currentState = (): DocumentState => state;
  let load: (files: File[]) => Promise<void> = async () => {
    throw new Error("Not mounted");
  };
  function Probe(): ReactElement {
    const controller = useDocument();
    state = controller.document;
    load = controller.load;
    return <span>{state.status}</span>;
  }
  await render(<Probe />);
  await act(async () => load([file()]));
  expect(state.status).toBe("valid");
  const trusted = currentState();
  if (trusted.status !== "valid") throw new Error("Expected retained model");
  expect(trusted.model.footprint).toBe(
    trusted.model.semanticElementsById.get("apartment-footprint"),
  );
  expect(trusted.model.metadata.level.defaultCeilingHeight.toString()).toBe("242");
  const slow = file();
  let finish: (text: string) => void = () => {
    throw new Error("No pending read");
  };
  vi.spyOn(slow, "text").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = load([slow]);
  });
  expect(state.status).toBe("processing");
  expect(state).not.toHaveProperty("model");
  await act(async () =>
    load([file('<svg xmlns="http://www.w3.org/2000/svg"/>', "replacement.svg")]),
  );
  expect(state.status).toBe("invalid");
  expect(state).not.toHaveProperty("model");
  await act(async () => {
    finish(validSource);
    await pending;
  });
  expect(state).toMatchObject({ status: "invalid", name: "replacement.svg" });
  await act(async () => load([file()]));
  expect(state.status).toBe("valid");
  expect(state).not.toHaveProperty("errors");
});

async function clickView(name: string): Promise<void> {
  const button = [...host.querySelectorAll("button")].find((button) => button.textContent === name);
  if (!button) throw new Error(`Missing ${name} button`);
  await act(async () => button.click());
}

async function clickControl(label: string): Promise<void> {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Missing ${label} button`);
  await act(async () => button.click());
}

it("focuses the 2D viewport without remounting it or resetting workspace state", async () => {
  await render();
  await pick([file()]);
  const surface = host.querySelector<HTMLDivElement>(".drawing-surface");
  const image = host.querySelector<HTMLImageElement>("img");
  const details = host.querySelector("aside");
  if (!surface || !image || !details) throw new Error("Missing loaded 2D workspace");
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 848, 648));
  Object.defineProperties(image, { naturalWidth: { value: 400 }, naturalHeight: { value: 200 } });
  await act(async () => image.dispatchEvent(new Event("load")));
  await clickControl("Zoom in");
  const transform = image.style.transform;
  const previewUrlCalls = createUrl.mock.calls.length;

  await clickControl("Enter Focus view");

  const application = host.querySelector(".application");
  expect(application?.classList.contains("focus-view")).toBe(true);
  for (const chrome of host.querySelectorAll<HTMLElement>(".focus-view-hidden"))
    expect(chrome.hidden).toBe(true);
  expect(host.querySelector("img")).toBe(image);
  expect(image.style.transform).toBe(transform);
  expect(createUrl).toHaveBeenCalledTimes(previewUrlCalls);
  expect(host.querySelector('[aria-label="Exit Focus view"]')).not.toBeNull();

  await clickControl("Exit Focus view");

  expect(application?.classList.contains("focus-view")).toBe(false);
  expect(host.querySelector("img")).toBe(image);
  expect(image.style.transform).toBe(transform);
  expect(host.querySelector("aside")).toBe(details);
  expect(
    host.querySelector('[aria-controls="validation-details"]')?.getAttribute("aria-expanded"),
  ).toBe("true");
});

it("exits Focus view with Escape while preserving the active 3D view and camera", async () => {
  await render();
  await pick([file(fixture("valid/minimal-semantic-schema.svg"))]);
  await clickView("3D");
  const canvas = host.querySelector("canvas");
  const select = host.querySelector<HTMLSelectElement>("select");
  if (!canvas || !select) throw new Error("Missing 3D viewport");
  await act(async () => {
    select.value = "camera-1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await clickControl("Enter Focus view");
  expect(host.querySelector<HTMLElement>(".three-toolbar")?.hidden).toBe(true);
  const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  await act(async () => window.dispatchEvent(escape));

  expect(escape.defaultPrevented).toBe(true);
  expect(host.querySelector(".application")?.classList.contains("focus-view")).toBe(false);
  expect(host.querySelector("canvas")).toBe(canvas);
  expect(select.value).toBe("camera-1");
  expect(host.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.textContent).toBe("3D");
  expect(rendererMocks.setModel).toHaveBeenCalledTimes(1);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();

  const inactiveEscape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  await act(async () => window.dispatchEvent(inactiveEscape));
  expect(inactiveEscape.defaultPrevented).toBe(false);
});

it("keeps camera, lens, and fitted image selections independent through Focus view", async () => {
  await render();
  await pick([file(fixture("valid/minimal-semantic-schema.svg"))]);
  await clickView("3D");
  const application = host.querySelector<HTMLElement>(".application");
  const area = host.querySelector<HTMLDivElement>(".three-render-area");
  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const camera = host.querySelector<HTMLSelectElement>('[aria-label="3D camera"]');
  const lens = host.querySelector<HTMLSelectElement>('[aria-label="3D focal length"]');
  const image = host.querySelector<HTMLSelectElement>('[aria-label="3D render aspect ratio"]');
  if (!application || !area || !canvas || !camera || !lens || !image) {
    throw new Error("Missing 3D framing controls");
  }
  vi.spyOn(area, "getBoundingClientRect").mockImplementation(() =>
    application.classList.contains("focus-view")
      ? new DOMRect(0, 0, 900, 1200)
      : new DOMRect(0, 0, 1200, 800),
  );

  expect([...lens.options].map((option) => option.text)).toEqual([
    "Camera default",
    "16 mm",
    "24 mm",
    "35 mm",
    "50 mm",
    "70 mm",
    "85 mm",
  ]);
  expect([...image.options].map((option) => option.text)).toEqual([
    "Fill",
    "16:9",
    "3:2",
    "1:1",
    "2:3",
    "9:16",
  ]);

  await act(async () => {
    lens.value = "35";
    lens.dispatchEvent(new Event("change", { bubbles: true }));
    image.value = "1:1";
    image.dispatchEvent(new Event("change", { bubbles: true }));
    camera.value = "camera-1";
    camera.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(rendererMocks.setFocalLengthOverride).toHaveBeenLastCalledWith(35);
  expect(rendererMocks.selectCamera).toHaveBeenLastCalledWith("camera-1");
  expect(camera.value).toBe("camera-1");
  expect(lens.value).toBe("35");
  expect(image.value).toBe("1:1");
  expect(canvas.style.width).toBe("800px");
  expect(canvas.style.height).toBe("800px");
  expect(canvas.style.left).toBe("200px");
  expect(canvas.style.top).toBe("0px");
  expect(rendererMocks.resize).toHaveBeenLastCalledWith(800, 800, window.devicePixelRatio);

  await clickControl("Enter Focus view");
  expect(host.querySelector("canvas")).toBe(canvas);
  expect(camera.value).toBe("camera-1");
  expect(lens.value).toBe("35");
  expect(image.value).toBe("1:1");
  expect(canvas.style.width).toBe("900px");
  expect(canvas.style.height).toBe("900px");
  expect(canvas.style.left).toBe("0px");
  expect(canvas.style.top).toBe("150px");

  await clickControl("Exit Focus view");
  await act(async () => {
    lens.value = "";
    lens.dispatchEvent(new Event("change", { bubbles: true }));
    image.value = "fill";
    image.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(rendererMocks.setFocalLengthOverride).toHaveBeenLastCalledWith(null);
  expect(camera.value).toBe("camera-1");
  expect(lens.value).toBe("");
  expect(image.value).toBe("fill");
  expect(canvas.style.width).toBe("1200px");
  expect(canvas.style.height).toBe("800px");
  expect(canvas.style.left).toBe("0px");
  expect(canvas.style.top).toBe("0px");
});

it("offers Focus view for an invalid document with a 2D preview", async () => {
  await render();
  await pick([file(fixture("invalid/missing-cameras-group.svg"), "invalid.svg")]);
  const image = host.querySelector("img");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Invalid");
  expect(image).not.toBeNull();

  await clickControl("Enter Focus view");

  expect(host.querySelector(".application")?.classList.contains("focus-view")).toBe(true);
  expect(host.querySelector("img")).toBe(image);
  expect(host.querySelector<HTMLElement>("aside")?.hidden).toBe(true);
});

it("switches valid views without processing again, selects embedded cameras and cleans up", async () => {
  const process = vi.spyOn(processing, "processDocument");
  const svg = fixture("valid/minimal-semantic-schema.svg");
  const selectedFile = file(svg);
  const read = vi.spyOn(selectedFile, "text");
  await render();
  await pick([selectedFile]);
  expect(host.querySelector("canvas")).toBeNull();
  await clickView("3D");
  expect(host.querySelector("canvas")).not.toBeNull();
  expect(rendererMocks.setModel).toHaveBeenCalledWith(
    expect.objectContaining({ walls: expect.any(Array) }),
  );
  const select = host.querySelector("select");
  if (!select) throw new Error("Missing camera selector");
  expect([...select.options].map((option) => option.text)).toEqual([
    "Inspection / orbit",
    "camera-1",
  ]);
  await act(async () => {
    select.value = "camera-1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(rendererMocks.selectCamera).toHaveBeenLastCalledWith("camera-1");
  await act(async () => {
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(rendererMocks.selectCamera).toHaveBeenLastCalledWith(null);
  await clickView("2D");
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
  expect(host.querySelector("img")).not.toBeNull();
  await clickView("3D");
  expect(process).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(1);
  await pick([file(svg, "replacement.svg")]);
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(2);
  expect(host.querySelector("canvas")).toBeNull();
  expect(host.querySelector("img")).not.toBeNull();
  await pick([file('<svg xmlns="http://www.w3.org/2000/svg"/>')]);
  expect(host.querySelector('[aria-label="Apartment view"]')).toBeNull();
});
it("shows renderer initialization failure as an application failure", async () => {
  rendererMocks.initialize.mockRejectedValueOnce(new Error("No GPU backend"));
  await render();
  await pick([file()]);
  await clickView("3D");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("File / processing failure");
  expect(host.textContent).toContain("Unexpected renderer failure: No GPU backend");
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
  expect(host.querySelector("canvas")).toBeNull();
});
it("disposes immediately when leaving 3D during initialization and ignores late success", async () => {
  let finish = (): void => {};
  rendererMocks.initialize.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await render();
  await pick([file()]);
  await clickView("3D");
  await clickView("2D");
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(host.querySelector("canvas")).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Valid");
});

it("surfaces unexpected architectural construction errors before enabling 3D", async () => {
  vi.spyOn(model3D, "buildArchitecturalModel3D").mockImplementationOnce(() => {
    throw new Error("Architectural invariant failed");
  });
  await render();
  await pick([file()]);
  expect(host.textContent).toContain(
    "Unexpected processing failure: Architectural invariant failed",
  );
  expect(host.querySelector('[aria-label="Apartment view"]')).toBeNull();
});
