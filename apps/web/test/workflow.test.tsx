import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, StrictMode } from "react";
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
import { QUALITY_STORAGE_KEY, qualityPreset } from "../src/render-quality.js";

const rendererMocks = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>(),
  setModel: vi.fn(),
  resize: vi.fn(),
  selectCamera: vi.fn(),
  selectWalk: vi.fn(),
  setFocalLengthOverride: vi.fn(),
  setPresentationSettings: vi.fn(),
  setQualitySettings: vi.fn(),
  setLightingMode: vi.fn(),
  render: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("@planaxis/renderer-three", async (original) => ({
  ...(await original<typeof import("@planaxis/renderer-three")>()),
  createApartmentRenderer: () => rendererMocks,
  FULL_FRAME_FOCAL_LENGTHS: [16, 24, 35, 50, 70, 85],
  isFullFrameFocalLength: (value: number) => [16, 24, 35, 50, 70, 85].includes(value),
}));

const fixture = (path: string): string =>
  readFileSync(resolve(fileURLToPath(import.meta.url), "../../../../fixtures", path), "utf8");
const validSource = fixture("valid/minimal-document-schema.svg");
const metadata = {
  schema: "planaxis-project/1.0",
  name: "Renovation project",
  architecture: { active: "architecture/existing.svg" },
};
const fetchMock = vi.fn<typeof fetch>();
function serveProject(source = validSource): void {
  fetchMock.mockImplementation(async (url) => {
    if (url === "/api/project/designs") return Response.json({ designs: [] });
    if (url === "/api/project") return Response.json(metadata);
    if (url === "/api/project/architecture") return new Response(source);
    throw new Error(`Unexpected URL: ${String(url)}`);
  });
}
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let host: HTMLDivElement;
let root: Root;
let nextUrl = 0;
const createUrl = vi.fn((blob: Blob | MediaSource) => {
  void blob;
  return `blob:preview-${++nextUrl}`;
});
const revokeUrl = vi.fn();

let fullscreenElement: Element | null = null;
const originalRequestFullscreen = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "requestFullscreen",
);
const requestFullscreen = vi.fn((): Promise<void> => {
  fullscreenElement = host.querySelector(".three-render-area");
  document.dispatchEvent(new Event("fullscreenchange"));
  return Promise.resolve();
});
const exitFullscreen = vi.fn(async () => {
  fullscreenElement = null;
  document.dispatchEvent(new Event("fullscreenchange"));
});
async function browserExit(): Promise<void> {
  await act(async () => exitFullscreen());
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2024-06-21T08:00:00Z"));
  fullscreenElement = null;
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value: requestFullscreen,
  });
  window.localStorage.clear();
  rendererMocks.initialize.mockResolvedValue();
  fetchMock.mockReset();
  serveProject();
  vi.stubGlobal("fetch", fetchMock);
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
  for (const key of ["fullscreenElement", "fullscreenEnabled", "exitFullscreen"])
    Reflect.deleteProperty(document, key);
  if (originalRequestFullscreen)
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", originalRequestFullscreen);
  else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function render(element: ReactElement = <App />): Promise<void> {
  await act(async () => root.render(element));
}
async function mountProject(source = validSource): Promise<void> {
  serveProject(source);
  await render();
}
async function remountProject(source = validSource): Promise<void> {
  await act(async () => root.unmount());
  root = createRoot(host);
  await mountProject(source);
}

it("starts loading without local-file controls", async () => {
  fetchMock.mockReturnValue(new Promise<Response>(() => {}));
  await render();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading project");
  expect(host.querySelector('input[type="file"]')).toBeNull();
  expect(host.querySelector('[aria-label="Full screen"]')).toBeNull();
  expect(host.querySelector("img")).toBeNull();
  expect(host.textContent).not.toMatch(/Open SVG|Replace SVG|Browse files|Drop your floor plan/);
});

it("loads metadata then active architecture through fixed relative URLs", async () => {
  await render();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/api/project",
    "/api/project/architecture",
    "/api/project/designs",
  ]);
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Ready");
  expect(host.textContent).toContain("trusted 2D apartment model is ready");
  expect(host.textContent).toContain(metadata.name);
  expect(host.textContent).toContain(metadata.architecture.active);
  expect(host.querySelector("img")?.src).toMatch(/^blob:preview-/);
});

it("does not load dropped files or create drop overlays", async () => {
  await render();
  const image = host.querySelector("img");
  const dropped = new File(["<svg/>"], "dropped.svg");
  const read = vi.spyOn(dropped, "text");
  for (const type of ["dragenter", "dragover", "drop", "dragleave"]) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: [dropped] } });
    await act(async () => host.firstElementChild?.dispatchEvent(event));
  }
  expect(read).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(host.querySelector("img")).toBe(image);
  expect(host.querySelector(".drop-overlay")).toBeNull();
});

it("identifies architecture processing while its response is pending", async () => {
  const pending = deferred<Response>();
  fetchMock.mockResolvedValueOnce(Response.json(metadata)).mockReturnValueOnce(pending.promise);
  await render();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Processing");
  expect(host.textContent).toContain(metadata.name);
  expect(host.querySelector("img")).toBeNull();
  await act(async () => pending.resolve(new Response(validSource)));
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Ready");
});

it.each([
  null,
  [],
  {},
  { ...metadata, schema: "planaxis-project/2.0" },
  { ...metadata, name: 42 },
  { ...metadata, name: "  " },
  { ...metadata, architecture: null },
  { ...metadata, architecture: [] },
  { ...metadata, architecture: {} },
  { ...metadata, architecture: { active: 42 } },
])("rejects malformed or unsupported metadata: %j", async (value) => {
  fetchMock.mockResolvedValueOnce(Response.json(value));
  await render();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Project / API failure");
  expect(host.textContent).toContain("malformed or unsupported project metadata");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(host.querySelector("img, aside")).toBeNull();
});

it.each([
  "/private/project/architecture/a.svg",
  "C:/project/a.svg",
  "architecture/../a.svg",
  "architecture//a.svg",
  "architecture/./a.svg",
  "architecture/a.txt",
  "architecture/a\\b.svg",
  "architecture/a\0.svg",
])("rejects unsafe display paths: %s", async (active) => {
  fetchMock.mockResolvedValueOnce(Response.json({ ...metadata, architecture: { active } }));
  await render();
  expect(host.textContent).toContain("invalid active architecture path");
  expect(host.textContent).not.toContain(active);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(["metadata", "architecture"])(
  "keeps %s HTTP failures separate from SVG failures",
  async (stage) => {
    if (stage === "architecture") fetchMock.mockResolvedValueOnce(Response.json(metadata));
    fetchMock.mockResolvedValueOnce(
      new Response("Internal error at /private/project", { status: 500 }),
    );
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Project / API failure");
    expect(host.textContent).toContain("HTTP 500");
    expect(host.textContent).not.toContain("/private/project");
    expect(host.querySelector("img, canvas, aside")).toBeNull();
  },
);

it.each(["metadata", "architecture"])("sanitizes %s network errors", async (stage) => {
  if (stage === "architecture") fetchMock.mockResolvedValueOnce(Response.json(metadata));
  fetchMock.mockRejectedValueOnce(new Error("Network error at /private/project"));
  await render();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Project / API failure");
  expect(host.textContent).toContain("Unable to load");
  expect(host.textContent).not.toContain("/private/project");
});

it("rejects malformed JSON without exposing its contents", async () => {
  fetchMock.mockResolvedValueOnce(new Response("invalid /private/project"));
  await render();
  expect(host.textContent).toContain("unreadable project metadata");
  expect(host.textContent).not.toContain("/private/project");
});

it("does not retain a previous workspace when a fresh mount fails", async () => {
  await render();
  await clickView("3D");
  await act(async () => root.unmount());
  root = createRoot(host);
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  await render();
  expect(host.querySelector("img, canvas")).toBeNull();
  expect(host.textContent).not.toContain(metadata.name);
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
});

it.each(["metadata", "architecture", "body"])(
  "ignores late %s completion after unmount",
  async (stage) => {
    const pending = deferred<Response>();
    const body = deferred<string>();
    if (stage !== "metadata") fetchMock.mockResolvedValueOnce(Response.json(metadata));
    if (stage === "body") {
      const response = new Response();
      vi.spyOn(response, "text").mockReturnValue(body.promise);
      fetchMock.mockResolvedValueOnce(response);
    } else fetchMock.mockReturnValueOnce(pending.promise);
    const process = vi.spyOn(processing, "processDocument");
    await render();
    const signal = fetchMock.mock.calls.at(-1)?.[1]?.signal;
    await act(async () => root.unmount());
    expect(signal?.aborted).toBe(true);
    root = createRoot(host);
    await act(async () => {
      pending.resolve(stage === "metadata" ? Response.json(metadata) : new Response(validSource));
      body.resolve(validSource);
    });
    expect(process).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(stage === "metadata" ? 1 : 3);
    expect(host.textContent).toBe("");
  },
);

it.each(["success", "failure"])(
  "ignores obsolete StrictMode metadata %s after newer startup succeeds",
  async (outcome) => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    await render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Ready");
    await act(async () => {
      if (outcome === "success")
        pending.resolve(Response.json({ ...metadata, name: "Stale project" }));
      else pending.reject(new Error("late failure"));
    });
    expect(host.textContent).toContain(metadata.name);
    expect(host.textContent).not.toContain("Stale project");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Ready");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  },
);

it("retains the trusted model after server acquisition", async () => {
  let state: DocumentState = { status: "loading" };
  const currentState = (): DocumentState => state;
  function Probe(): ReactElement {
    state = useDocument().document;
    return <span>{state.status}</span>;
  }
  await render(<Probe />);
  const trusted = currentState();
  if (trusted.status !== "valid") throw new Error("Expected retained model");
  expect(trusted.model.footprint).toBe(
    trusted.model.semanticElementsById.get("apartment-footprint"),
  );
  expect(trusted.model.metadata.level.defaultCeilingHeight.toString()).toBe("242");
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
      await mountProject(fixture(path));
      expect(host.querySelector("img")).not.toBeNull();
      expect(host.querySelector('[aria-label="Apartment view"]')).toBeNull();
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
  const firstUrl = host.querySelector("img")?.src;
  const invalid =
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><script>window.bad = true</script><rect width="100" height="100"/></svg>';
  await remountProject(invalid);
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
  await act(async () => {
    host.querySelector("img")?.dispatchEvent(new Event("error"));
  });
  expect(host.textContent).toContain("Preview unavailable");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Ready");
  await clickControl("Diagnostics status");
  expect(host.querySelector<HTMLElement>("#diagnostics-panel")?.hidden).toBe(false);
  await clickControl("Close Diagnostics");
  expect(host.querySelector("aside")).toBeNull();
  expect(
    host.querySelector('[aria-label="Diagnostics status"]')?.getAttribute("aria-expanded"),
  ).toBe("false");
});

it("keeps source available after unexpected processing failure", async () => {
  vi.spyOn(processing, "processDocument").mockImplementation(() => {
    throw new Error("Internal invariant failed");
  });
  await render();
  expect(host.textContent).toContain("Unexpected processing failure: Internal invariant failed");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Processing failure");
  expect(host.querySelector("img")).not.toBeNull();
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

it("opens overlay details without remounting or resetting the 2D viewport", async () => {
  await render();
  const surface = host.querySelector<HTMLDivElement>(".drawing-surface");
  const image = host.querySelector<HTMLImageElement>("img");
  if (!surface || !image) throw new Error("Missing loaded 2D workspace");
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 848, 648));
  Object.defineProperties(image, { naturalWidth: { value: 400 }, naturalHeight: { value: 200 } });
  await act(async () => image.dispatchEvent(new Event("load")));
  await clickControl("Zoom in");
  const transform = image.style.transform;
  const previewUrlCalls = createUrl.mock.calls.length;
  expect(host.querySelector<HTMLElement>("#diagnostics-panel")?.hidden).toBe(true);
  expect(host.querySelector("aside")).toBeNull();
  await clickControl("Diagnostics status");
  expect(host.querySelector<HTMLElement>("#diagnostics-panel")?.hidden).toBe(false);
  expect(host.querySelector("img")).toBe(image);
  await clickControl("Close Diagnostics");
  expect(host.querySelector<HTMLElement>("#diagnostics-panel")?.hidden).toBe(true);
  expect(image.style.transform).toBe(transform);
  expect(createUrl).toHaveBeenCalledTimes(previewUrlCalls);
  expect(host.querySelector('[aria-label="Full screen"]')).toBeNull();
});

it("tracks browser fullscreen entry and native Escape exit without resetting the renderer", async () => {
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickView("3D");
  const canvas = host.querySelector("canvas");
  await selectQuality("3D camera", "camera-1");
  await clickControl("Full screen");
  const area = host.querySelector(".three-render-area");
  expect(document.fullscreenElement).toBe(area);
  expect(requestFullscreen).toHaveBeenCalledTimes(1);
  expect(requestFullscreen.mock.contexts[0]).toBe(area);
  expect([...area!.children].map((element) => element.tagName)).toEqual(["CANVAS", "BUTTON"]);
  expect(area?.querySelector("button")?.textContent).toBe("×");
  const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  await act(async () => window.dispatchEvent(escape));
  expect(escape.defaultPrevented).toBe(false);
  await browserExit();
  expect(host.querySelector('[aria-label="Exit full screen"]')).toBeNull();
  expect(host.querySelector("canvas")).toBe(canvas);
  expect(qualityControl("3D camera").value).toBe("camera-1");
  expect(rendererMocks.setModel).toHaveBeenCalledTimes(1);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
});

it("keeps camera, lens, and fitted image selections independent through full screen", async () => {
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
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
    document.fullscreenElement === area
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
  expect(lens.value).toBe("");
  expect(image.value).toBe("1:1");
  expect(canvas.style.width).toBe("800px");
  expect(canvas.style.height).toBe("800px");
  expect(canvas.style.left).toBe("200px");
  expect(canvas.style.top).toBe("0px");
  expect(rendererMocks.resize).toHaveBeenLastCalledWith(800, 800);

  await clickControl("Full screen");
  expect(host.querySelector("canvas")).toBe(canvas);
  expect(camera.value).toBe("camera-1");
  expect(lens.value).toBe("");
  expect(image.value).toBe("1:1");
  expect(canvas.style.width).toBe("900px");
  expect(canvas.style.height).toBe("900px");
  expect(canvas.style.left).toBe("0px");
  expect(canvas.style.top).toBe("150px");

  await clickControl("Exit full screen");
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

it("keeps fullscreen unavailable for invalid documents with 2D previews", async () => {
  await mountProject(fixture("invalid/missing-cameras-group.svg"));
  expect(host.querySelector("img")).not.toBeNull();
  expect(host.querySelector('[aria-label="Full screen"]')).toBeNull();
  expect(host.querySelector<HTMLElement>("#diagnostics-panel")?.hidden).toBe(true);
  await clickView("View details");
  expect(host.querySelector<HTMLElement>("#diagnostics-panel")?.hidden).toBe(false);
  expect(host.querySelector("#diagnostics-panel")?.textContent).toContain(
    "Schema validation failed",
  );
});

it("switches valid views without processing again, selects embedded cameras and cleans up", async () => {
  const process = vi.spyOn(processing, "processDocument");
  const svg = fixture("valid/minimal-semantic-schema.svg");
  await mountProject(svg);
  expect(host.querySelector("canvas")).toBeNull();
  await clickView("3D");
  expect(host.querySelector("canvas")).not.toBeNull();
  expect(rendererMocks.setModel).toHaveBeenCalledWith(
    expect.objectContaining({ walls: expect.any(Array) }),
  );
  const select = host.querySelector<HTMLSelectElement>('[aria-label="3D camera"]');
  if (!select) throw new Error("Missing camera selector");
  expect([...select.options].map((option) => option.text)).toEqual([
    "Inspection",
    "Walk",
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
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await remountProject(svg);
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(2);
  expect(host.querySelector("canvas")).toBeNull();
  expect(host.querySelector("img")).not.toBeNull();
  await remountProject('<svg xmlns="http://www.w3.org/2000/svg"/>');
  expect(host.querySelector('[aria-label="Apartment view"]')).toBeNull();
});
it("shows renderer initialization failure as an application failure", async () => {
  rendererMocks.initialize.mockRejectedValueOnce(new Error("No GPU backend"));
  await render();
  await clickView("3D");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Renderer failure");
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
  await clickView("3D");
  await clickView("2D");
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(host.querySelector("canvas")).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Ready");
});

it("surfaces unexpected architectural construction errors before enabling 3D", async () => {
  vi.spyOn(model3D, "buildArchitecturalModel3D").mockImplementationOnce(() => {
    throw new Error("Architectural invariant failed");
  });
  await render();
  expect(host.textContent).toContain(
    "Unexpected processing failure: Architectural invariant failed",
  );
  expect(host.querySelector('[aria-label="Apartment view"]')).toBeNull();
});

it("disables Walk without source cameras and explains the requirement", async () => {
  await render();
  await clickView("3D");
  const camera = host.querySelector<HTMLSelectElement>('[aria-label="3D camera"]');
  const walk = [...(camera?.options ?? [])].find((option) => option.text === "Walk");
  if (!camera || !walk) throw new Error("Missing Walk choice");
  expect(walk.disabled).toBe(true);
  expect(camera.disabled).toBe(false);
  expect(camera.value).toBe("");
  expect(host.textContent).toContain(
    "Free walk requires at least one camera in the Apartment SVG.",
  );
  await act(async () => {
    camera.value = walk.value;
    camera.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(rendererMocks.selectWalk).not.toHaveBeenCalled();
});

it("selects Walk independently of embedded IDs, lens, aspect ratio, and full screen", async () => {
  await mountProject(
    fixture("valid/minimal-semantic-schema.svg").replace('id="camera-1"', 'id="walk"'),
  );
  await clickView("3D");
  const camera = host.querySelector<HTMLSelectElement>('[aria-label="3D camera"]');
  const lens = host.querySelector<HTMLSelectElement>('[aria-label="3D focal length"]');
  const aspect = host.querySelector<HTMLSelectElement>('[aria-label="3D render aspect ratio"]');
  const canvas = host.querySelector("canvas");
  const area = host.querySelector<HTMLElement>(".three-render-area");
  if (!camera || !lens || !aspect || !canvas || !area) throw new Error("Missing 3D controls");
  const walk = [...camera.options].find((option) => option.text === "Walk");
  if (!walk) throw new Error("Missing Walk choice");
  expect(walk.disabled).toBe(false);
  expect(canvas.tabIndex).toBe(0);
  vi.spyOn(area, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 800));
  async function choose(select: HTMLSelectElement, value: string): Promise<void> {
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await choose(lens, "35");
  await choose(aspect, "1:1");
  await choose(camera, walk.value);
  expect(rendererMocks.selectWalk).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("WASD / arrows to walk");
  expect(host.textContent).toContain("Left-drag to look");
  expect(host.textContent).toContain("Option (Mac) / Space (Windows, Linux): slow");
  expect(canvas.style.width).toBe("800px");
  await clickControl("Full screen");
  await browserExit();
  expect(host.querySelector("canvas")).toBe(canvas);
  expect(camera.value).toBe(walk.value);
  expect(rendererMocks.selectWalk).toHaveBeenCalledTimes(1);
  expect(rendererMocks.setModel).toHaveBeenCalledTimes(1);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
  for (const id of ["walk", ""]) {
    await choose(camera, id);
    expect(rendererMocks.selectCamera).toHaveBeenLastCalledWith(id || null);
    await choose(camera, walk.value);
    expect(lens.value).toBe("");
    expect(aspect.value).toBe("1:1");
  }
  await choose(lens, "");
  expect(rendererMocks.setFocalLengthOverride).toHaveBeenLastCalledWith(null);
  expect(camera.value).toBe(walk.value);
  await remountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickView("3D");
  expect(host.querySelector<HTMLSelectElement>('[aria-label="3D camera"]')?.value).toBe("");
  expect(host.querySelector<HTMLSelectElement>('[aria-label="3D focal length"]')?.value).toBe("");
  expect(
    host.querySelector<HTMLSelectElement>('[aria-label="3D render aspect ratio"]')?.value,
  ).toBe("fill");
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
});

it("labels presentation controls, waits for readiness, and applies each transient setting immediately", async () => {
  const startup = deferred<void>();
  rendererMocks.initialize.mockReturnValueOnce(startup.promise);
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickView("3D");
  function control(label: string): HTMLInputElement | HTMLSelectElement {
    const element = host.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[aria-label="${label}"]`,
    );
    if (!element) throw new Error(`Missing ${label}`);
    return element;
  }
  const tone = control("3D tone mapping");
  const exposure = control("3D exposure (EV)");
  const intensity = control("3D environment intensity");
  const rotation = control("3D environment rotation (degrees)");
  const controls = [tone, exposure, intensity, rotation];
  for (const element of controls) expect(element.disabled).toBe(true);
  expect(tone.value).toBe("AgX");
  expect(exposure.value).toBe("0");
  expect(intensity.value).toBe("1");
  expect(rotation.value).toBe("0");
  expect([...tone.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
    "AgX",
    "ACES Filmic",
    "Neutral",
  ]);
  expect([
    exposure.getAttribute("min"),
    exposure.getAttribute("max"),
    exposure.getAttribute("step"),
  ]).toEqual(["-4", "4", "0.1"]);
  expect([
    intensity.getAttribute("min"),
    intensity.getAttribute("max"),
    intensity.getAttribute("step"),
  ]).toEqual(["0", "4", "0.1"]);
  expect([
    rotation.getAttribute("min"),
    rotation.getAttribute("max"),
    rotation.getAttribute("step"),
  ]).toEqual(["0", "360", "1"]);
  await act(async () => startup.resolve());
  for (const element of controls) expect(element.disabled).toBe(false);
  async function change(
    element: HTMLInputElement | HTMLSelectElement,
    value: string,
  ): Promise<void> {
    await act(async () => {
      // Bypass React's input tracker to simulate a native slider interaction.
      if (element instanceof HTMLInputElement) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
          element,
          value,
        );
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        element.value = value;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  await change(tone, "ACES Filmic");
  expect(rendererMocks.setPresentationSettings).toHaveBeenLastCalledWith({
    environmentIntensity: 1,
    environmentRotationDegrees: 0,
    toneMapping: "ACES Filmic",
    exposureEv: 0,
  });
  await change(exposure, "-1.5");
  expect(rendererMocks.setPresentationSettings).toHaveBeenLastCalledWith({
    environmentIntensity: 1,
    environmentRotationDegrees: 0,
    toneMapping: "ACES Filmic",
    exposureEv: -1.5,
  });
  await change(intensity, "2.4");
  expect(rendererMocks.setPresentationSettings).toHaveBeenLastCalledWith({
    environmentIntensity: 2.4,
    environmentRotationDegrees: 0,
    toneMapping: "ACES Filmic",
    exposureEv: -1.5,
  });
  await change(rotation, "135");
  await change(tone, "Neutral");
  expect(rendererMocks.setPresentationSettings).toHaveBeenLastCalledWith({
    environmentIntensity: 2.4,
    environmentRotationDegrees: 135,
    toneMapping: "Neutral",
    exposureEv: -1.5,
  });
  const calls = rendererMocks.setPresentationSettings.mock.calls.length;
  await change(control("3D camera"), "camera-1");
  await change(control("3D camera"), "@walk");
  await change(control("3D focal length"), "35");
  await change(control("3D render aspect ratio"), "1:1");
  await clickControl("Full screen");
  expect(document.fullscreenElement).toBe(host.querySelector(".three-render-area"));
  await browserExit();
  expect(controls.map((element) => element.value)).toEqual(["Neutral", "-1.5", "2.4", "135"]);
  expect(rendererMocks.setPresentationSettings).toHaveBeenCalledTimes(calls);
  expect(rendererMocks.setModel).toHaveBeenCalledTimes(1);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("reports a presentation API failure through the existing renderer failure workflow", async () => {
  await render();
  await clickView("3D");
  rendererMocks.setPresentationSettings.mockImplementationOnce(() => {
    throw new Error("Presentation update failed");
  });
  const tone = host.querySelector<HTMLSelectElement>('[aria-label="3D tone mapping"]');
  if (!tone) throw new Error("Missing tone mapping");
  await act(async () => {
    tone.value = "Neutral";
    tone.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.textContent).toContain("Unexpected renderer failure: Presentation update failed");
  expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
});

function qualityControl(label: string): HTMLSelectElement {
  const element = host.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`);
  if (!element) throw new Error(`Missing ${label}`);
  return element;
}
async function selectQuality(label: string, value: string): Promise<void> {
  await act(async () => {
    const element = qualityControl(label);
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("applies presets and manual quality edits immediately without rebuilding or changing presentation", async () => {
  vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(2.5);
  const startup = deferred<void>();
  rendererMocks.initialize.mockReturnValueOnce(startup.promise);
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickView("3D");
  const labels = [
    "3D quality preset",
    "3D pixel ratio",
    "3D shadow quality",
    "3D environment lighting",
    "3D fill light",
  ];
  for (const label of labels) expect(qualityControl(label).disabled).toBe(true);
  expect([...qualityControl("3D pixel ratio").options].map((option) => option.value)).toEqual([
    "1",
    "2",
    "2.5",
  ]);
  expect(rendererMocks.setQualitySettings).toHaveBeenLastCalledWith(
    qualityPreset("Balanced", 2.5).settings,
  );
  await act(async () => startup.resolve());
  for (const label of labels) expect(qualityControl(label).disabled).toBe(false);
  const presentationCalls = rendererMocks.setPresentationSettings.mock.calls.length;
  for (const preset of ["Performance", "High", "Balanced"] as const) {
    await selectQuality("3D quality preset", preset);
    expect(rendererMocks.setQualitySettings).toHaveBeenLastCalledWith(
      qualityPreset(preset, 2.5).settings,
    );
    expect(qualityControl("3D quality preset").value).toBe(preset);
    for (const label of labels) expect(qualityControl(label).disabled).toBe(false);
  }
  await selectQuality("3D pixel ratio", "1");
  expect(qualityControl("3D quality preset").value).toBe("Custom");
  await selectQuality("3D shadow quality", "Low");
  await selectQuality("3D fill light", "High");
  const environment = host.querySelector<HTMLInputElement>(
    '[aria-label="3D environment lighting"]',
  );
  if (!environment) throw new Error("Missing environment control");
  await act(async () => environment.click());
  const custom = {
    pixelRatio: 1,
    shadowQuality: "Low",
    environmentLightingEnabled: false,
    fillLightLevel: "High",
  };
  expect(rendererMocks.setQualitySettings).toHaveBeenLastCalledWith(custom);
  expect(JSON.parse(window.localStorage.getItem(QUALITY_STORAGE_KEY) ?? "null")).toEqual({
    version: 1,
    preset: "Custom",
    settings: custom,
  });
  await selectQuality("3D camera", "@walk");
  await selectQuality("3D focal length", "35");
  await selectQuality("3D render aspect ratio", "1:1");
  await clickControl("Full screen");
  expect(rendererMocks.setQualitySettings).toHaveBeenLastCalledWith(custom);
  expect(rendererMocks.setPresentationSettings).toHaveBeenCalledTimes(presentationCalls);
  expect(rendererMocks.setModel).toHaveBeenCalledTimes(1);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("restores quality across page initialization while leaving camera and presentation transient", async () => {
  vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickView("3D");
  await selectQuality("3D quality preset", "High");
  await selectQuality("3D fill light", "Low");
  await selectQuality("3D camera", "@walk");
  await selectQuality("3D tone mapping", "Neutral");
  vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(1.25);
  await remountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickView("3D");
  expect(qualityControl("3D quality preset").value).toBe("Custom");
  expect(qualityControl("3D pixel ratio").value).toBe("1.25");
  expect(qualityControl("3D fill light").value).toBe("Low");
  expect(rendererMocks.setQualitySettings).toHaveBeenLastCalledWith({
    ...qualityPreset("High", 1.25).settings,
    fillLightLevel: "Low",
  });
  expect(qualityControl("3D camera").value).toBe("");
  expect(qualityControl("3D tone mapping").value).toBe("AgX");
});

it("adapts quality options to a live DPR change without recreating the renderer", async () => {
  const dpr = vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);
  await render();
  await clickView("3D");
  await selectQuality("3D quality preset", "High");
  dpr.mockReturnValue(1.25);
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });
  expect([...qualityControl("3D pixel ratio").options].map((option) => option.value)).toEqual([
    "1",
    "1.25",
  ]);
  expect(rendererMocks.setQualitySettings).toHaveBeenLastCalledWith(
    qualityPreset("High", 1.25).settings,
  );
  expect(rendererMocks.setModel).toHaveBeenCalledTimes(1);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
});

it("renders and accepts quality changes when storage fails", async () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("Storage denied");
  });
  await render();
  await clickView("3D");
  expect(qualityControl("3D quality preset").value).toBe("Balanced");
  await selectQuality("3D quality preset", "Performance");
  expect(rendererMocks.setQualitySettings).toHaveBeenLastCalledWith(
    qualityPreset("Performance", window.devicePixelRatio).settings,
  );
  expect(qualityControl("3D quality preset").value).toBe("Performance");
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
});

it("exposes primary actions in one toolbar and keeps secondary settings transient", async () => {
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  const toolbar = host.querySelector('[aria-label="Workspace toolbar"]');
  expect(toolbar?.querySelector('[aria-label="Design scenario"]')).not.toBeNull();
  expect(toolbar?.querySelector('[aria-label="Apartment view"]')).not.toBeNull();
  expect(host.querySelector<HTMLElement>("#design-panel")?.hidden).toBe(true);
  await clickControl("Create or edit a design");
  expect(host.querySelector<HTMLElement>("#design-panel")?.hidden).toBe(false);
  await clickView("3D");
  for (const label of [
    "3D camera",
    "Rendering",
    "Full screen",
    "Diagnostics status",
    "Information and help",
  ]) {
    expect(toolbar?.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
  }
  expect(host.querySelectorAll(".primary-toolbar")).toHaveLength(1);
  expect(host.querySelector<HTMLElement>("#rendering-panel")?.hidden).toBe(true);
  await clickControl("Rendering");
  const rendering = host.querySelector<HTMLElement>("#rendering-panel");
  expect(rendering?.hidden).toBe(false);
  expect(rendering?.querySelectorAll("input, select")).toHaveLength(10);
  await clickControl("Camera settings");
  expect(rendering?.hidden).toBe(true);
  expect(host.querySelector<HTMLElement>("#camera-panel")?.hidden).toBe(false);
  expect(host.querySelector("#camera-panel")?.textContent).toContain(
    "Inspection: 50 mm · Walk: 16 mm",
  );
});

it("dismisses a problem toast while retaining warning status and structured overlay details", async () => {
  await mountProject(fixture("invalid/multiple-broken-wall-references.svg"));
  expect(host.querySelector(".problem-toast")?.textContent).toContain(
    "Reference validation failed",
  );
  await clickControl("Dismiss notification");
  expect(host.querySelector(".problem-toast")).toBeNull();
  expect(host.querySelector('[aria-label="Diagnostics status"]')?.textContent).toBe("Invalid");
  expect(host.querySelector(".overflow-toggle")?.classList.contains("has-problem")).toBe(true);
  await clickControl("Diagnostics status");
  const details = host.querySelector<HTMLElement>("#diagnostics-panel");
  expect(details?.hidden).toBe(false);
  expect(details?.querySelectorAll(".diagnostic").length).toBeGreaterThan(1);
  expect(details?.querySelector("dl")).not.toBeNull();
  await clickControl("Close Diagnostics");
  expect(details?.hidden).toBe(true);
});

it("automatically expires a toast without clearing diagnostics", async () => {
  vi.useFakeTimers();
  try {
    await mountProject(fixture("invalid/missing-cameras-group.svg"));
    expect(host.querySelector(".problem-toast")).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(7000));
    expect(host.querySelector(".problem-toast")).toBeNull();
    expect(host.querySelector('[aria-label="Diagnostics status"]')?.textContent).toBe("Invalid");
    await clickControl("Diagnostics status");
    expect(host.querySelector("#diagnostics-panel")?.textContent).toContain("APSVG-");
  } finally {
    vi.useRealTimers();
  }
});

async function key(
  key: string,
  options: KeyboardEventInit = {},
  target: EventTarget = window,
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
  await act(async () => target.dispatchEvent(event));
  return event;
}

it("supports view and camera shortcuts while leaving active Walk W handling authoritative", async () => {
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  await key("w");
  await key("i");
  expect(rendererMocks.selectWalk).not.toHaveBeenCalled();
  expect(rendererMocks.selectCamera).not.toHaveBeenCalled();
  await key("3");
  expect(host.querySelector("canvas")).not.toBeNull();
  await key("W");
  expect(rendererMocks.selectWalk).toHaveBeenCalledTimes(1);
  const movement = await key("w", {}, host.querySelector("canvas")!);
  expect(movement.defaultPrevented).toBe(false);
  expect(rendererMocks.selectWalk).toHaveBeenCalledTimes(1);
  await selectQuality("3D focal length", "85");
  await key("I");
  expect(rendererMocks.selectCamera).toHaveBeenLastCalledWith(null);
  expect(qualityControl("3D focal length").value).toBe("");
  await key("2");
  expect(host.querySelector("canvas")).toBeNull();
  expect(host.querySelector("img")).not.toBeNull();
});

it.each(["input", "textarea", "select", "editable", "textbox", "combobox"])(
  "suppresses shortcuts in %s controls",
  async (kind) => {
    await mountProject(fixture("valid/minimal-semantic-schema.svg"));
    await clickView("3D");
    const element = document.createElement(
      ["input", "textarea", "select"].includes(kind) ? kind : "div",
    );
    if (kind === "editable") element.setAttribute("contenteditable", "true");
    if (kind === "textbox" || kind === "combobox") element.setAttribute("role", kind);
    host.append(element);
    for (const value of ["2", "3", "w", "i"])
      expect((await key(value, {}, element)).defaultPrevented).toBe(false);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(rendererMocks.selectWalk).not.toHaveBeenCalled();
    expect(rendererMocks.selectCamera).not.toHaveBeenCalled();
    element.remove();
  },
);

it.each(["ctrlKey", "metaKey", "altKey", "isComposing", "repeat"])(
  "suppresses ordinary shortcuts with %s",
  async (modifier) => {
    await mountProject(fixture("valid/minimal-semantic-schema.svg"));
    await clickView("3D");
    for (const value of ["2", "3", "w", "i"])
      expect((await key(value, { [modifier]: true })).defaultPrevented).toBe(false);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(rendererMocks.selectWalk).not.toHaveBeenCalled();
    expect(rendererMocks.selectCamera).not.toHaveBeenCalled();
  },
);

it("offers contextual help and closes panels with Escape without changing navigation", async () => {
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickControl("Information and help");
  expect(host.querySelector<HTMLElement>("#help-panel")?.hidden).toBe(false);
  expect(host.querySelector("#help-panel")?.textContent).toContain("Drag to pan");
  await key("Escape");
  await clickView("3D");
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Information and help"]')!;
  trigger.focus();
  await clickControl("Information and help");
  expect(host.querySelector("#help-panel")?.textContent).toContain("Drag to orbit");
  expect((await key("Escape")).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(trigger);
  await key("w");
  await clickControl("Information and help");
  expect(host.querySelector("#help-panel")?.textContent).toContain("WASD / arrows");
  expect(host.querySelector("#help-panel")?.textContent).toContain("Option (Mac) / Space");
  expect(host.querySelector("#help-panel")?.textContent).toContain("I: Inspection");
  await key("Escape");
  expect(rendererMocks.selectWalk).toHaveBeenCalledTimes(1);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
  expect(qualityControl("3D camera").value).toBe("@walk");
});

it("keeps overflow actions keyboard accessible and closes them with Escape", async () => {
  await render();
  await clickControl("More workspace controls");
  const overflow = host.querySelector("#workspace-overflow");
  expect(overflow?.classList.contains("is-open")).toBe(true);
  expect(overflow?.contains(document.activeElement)).toBe(true);
  await key("Escape");
  expect(overflow?.classList.contains("is-open")).toBe(false);
  await clickControl("More workspace controls");
  await clickControl("Diagnostics status");
  expect(host.querySelector<HTMLElement>("#diagnostics-panel")?.hidden).toBe(false);
  expect(overflow?.classList.contains("is-open")).toBe(false);
});

it.each(["unavailable", "rejected"])(
  "handles %s fullscreen without stale state or renderer replacement",
  async (failure) => {
    await render();
    await clickView("3D");
    const canvas = host.querySelector("canvas");
    if (failure === "unavailable")
      Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    else requestFullscreen.mockRejectedValueOnce(new Error("denied"));
    await clickControl("Full screen");
    expect(host.querySelector('[aria-label="Exit full screen"]')).toBeNull();
    expect(document.fullscreenElement).toBeNull();
    expect(host.textContent).toContain(
      failure === "unavailable" ? "Full screen is unavailable" : "Unable to enter full screen",
    );
    expect(host.querySelector("canvas")).toBe(canvas);
    expect(rendererMocks.dispose).not.toHaveBeenCalled();
  },
);

it("uses fullscreenchange as the source of truth and exits through the close button", async () => {
  await mountProject(fixture("valid/minimal-semantic-schema.svg"));
  await clickView("3D");
  requestFullscreen.mockResolvedValueOnce();
  await clickControl("Full screen");
  expect(host.querySelector('[aria-label="Exit full screen"]')).toBeNull();
  fullscreenElement = host.querySelector(".three-render-area");
  await act(async () => document.dispatchEvent(new Event("fullscreenchange")));
  expect(host.querySelector('[aria-label="Exit full screen"]')).not.toBeNull();
  expect((await key("2")).defaultPrevented).toBe(false);
  expect(host.querySelector("canvas")).not.toBeNull();
  await clickControl("Exit full screen");
  expect(exitFullscreen).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[aria-label="Exit full screen"]')).toBeNull();
});

it("requires SVG location for Physical lighting and keeps Studio as the default", async () => {
  await mountProject();
  await clickView("3D");
  const control = qualityControl("3D lighting mode");
  expect(control.value).toBe("studio");
  expect(control.querySelector<HTMLOptionElement>('[value="physical"]')?.disabled).toBe(true);
  expect(host.textContent).toContain(
    "Physical lighting requires geographic location and north orientation",
  );
  await selectQuality("3D lighting mode", "physical");
  expect(rendererMocks.setLightingMode).not.toHaveBeenCalledWith("physical", expect.anything());
});

it("uses one transient instant and changes lighting without model, camera, or navigation resets", async () => {
  const instant = Date.parse("2024-06-21T08:00:00Z");
  vi.spyOn(Date, "now").mockReturnValue(instant);
  const source = fixture("valid/minimal-semantic-schema.svg").replace(
    '"level":',
    '"location": {"latitude": 47.4979, "longitude": 19.0402, "northHeading": 270}, "level":',
  );
  const build = vi.spyOn(model3D, "buildArchitecturalModel3D");
  await mountProject(source);
  await clickView("3D");
  expect(qualityControl("3D lighting mode").value).toBe("studio");
  expect(
    qualityControl("3D lighting mode").querySelector<HTMLOptionElement>('[value="physical"]')
      ?.disabled,
  ).toBe(false);
  await selectQuality("3D camera", "@walk");
  const modelCalls = rendererMocks.setModel.mock.calls.length;
  const buildCalls = build.mock.calls.length;
  const cameraCalls = rendererMocks.selectCamera.mock.calls.length;
  const walkCalls = rendererMocks.selectWalk.mock.calls.length;
  vi.mocked(Date.now).mockReturnValue(instant + 86400000);
  await selectQuality("3D lighting mode", "physical");
  expect(rendererMocks.setLightingMode).toHaveBeenLastCalledWith("physical", instant, "sunny");
  expect(qualityControl("3D camera").value).toBe("@walk");
  await selectQuality("3D quality preset", "Performance");
  expect(qualityControl("3D shadow quality").value).toBe("Low");
  expect(qualityControl("3D fill light").disabled).toBe(true);
  expect(qualityControl("3D environment lighting").disabled).toBe(true);
  await selectQuality("3D lighting mode", "studio");
  expect(rendererMocks.setLightingMode).toHaveBeenLastCalledWith("studio", instant, "sunny");
  expect(qualityControl("3D shadow quality").value).toBe("Off");
  expect(qualityControl("3D fill light").value).toBe("Medium");
  expect(rendererMocks.setModel).toHaveBeenCalledTimes(modelCalls);
  expect(build).toHaveBeenCalledTimes(buildCalls);
  expect(rendererMocks.selectCamera).toHaveBeenCalledTimes(cameraCalls);
  expect(rendererMocks.selectWalk).toHaveBeenCalledTimes(walkCalls);
  expect(rendererMocks.dispose).not.toHaveBeenCalled();
  expect(window.localStorage.getItem(QUALITY_STORAGE_KEY)).not.toMatch(/physical|studio|instant/i);
});

async function slideDaylight(label: string, value: string): Promise<void> {
  const element = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (!element) throw new Error(`Missing ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it.each([undefined, "Europe/Budapest"])(
  "edits stacked calendar sliders in %s and restores transient daylight across modes and views",
  async (timeZone) => {
    const location = { latitude: 47.4979, longitude: 19.0402, northHeading: 270, timeZone };
    const source = fixture("valid/minimal-semantic-schema.svg").replace(
      '"level":',
      `"location": ${JSON.stringify(location)}, "level":`,
    );
    const build = vi.spyOn(model3D, "buildArchitecturalModel3D");
    await mountProject(source);
    await clickView("3D");
    await selectQuality("3D lighting mode", "physical");
    expect(qualityControl("Physical weather").value).toBe("sunny");
    expect([...qualityControl("Physical weather").options].map((option) => option.text)).toEqual([
      "Sunny",
      "Overcast",
    ]);
    expect(host.textContent).toContain(timeZone ?? "UTC (no time zone declared)");
    const sliders = [...host.querySelectorAll<HTMLInputElement>(".daylight-controls input")];
    expect(sliders.map((slider) => slider.getAttribute("aria-label"))).toEqual([
      "Physical date",
      "Physical time",
    ]);
    expect(sliders.map((slider) => [slider.type, slider.min, slider.max, slider.step])).toEqual([
      ["range", "1", "366", "1"],
      ["range", "0", "1439", "1"],
    ]);
    const modelCalls = rendererMocks.setModel.mock.calls.length;
    const buildCalls = build.mock.calls.length;
    await selectQuality("3D camera", "@walk");
    const walkCalls = rendererMocks.selectWalk.mock.calls.length;
    await slideDaylight("Physical date", "60");
    expect(host.textContent).toContain("2024-02-29");
    expect(host.textContent).toContain(timeZone ? "10:00" : "08:00");
    await slideDaylight("Physical time", "1439");
    expect(host.textContent).toContain("2024-02-29");
    expect(host.textContent).toContain("23:59");
    const instant = Date.parse(timeZone ? "2024-02-29T22:59:00Z" : "2024-02-29T23:59:00Z");
    expect(rendererMocks.setLightingMode).toHaveBeenLastCalledWith("physical", instant, "sunny");
    await selectQuality("Physical weather", "overcast");
    await selectQuality("3D lighting mode", "studio");
    expect(host.querySelector('[aria-label="Physical time"]')).toBeNull();
    await selectQuality("3D quality preset", "Performance");
    await selectQuality("3D lighting mode", "physical");
    expect(rendererMocks.setLightingMode).toHaveBeenLastCalledWith("physical", instant, "overcast");
    expect(qualityControl("3D camera").value).toBe("@walk");
    expect(rendererMocks.setModel).toHaveBeenCalledTimes(modelCalls);
    expect(build).toHaveBeenCalledTimes(buildCalls);
    expect(rendererMocks.selectWalk).toHaveBeenCalledTimes(walkCalls);
    await clickControl("Full screen");
    await browserExit();
    await clickView("2D");
    await clickView("3D");
    expect(rendererMocks.setLightingMode).toHaveBeenLastCalledWith("physical", instant, "overcast");
    expect(host.textContent).toContain("2024-02-29");
    expect(host.textContent).toContain("23:59");
    expect(qualityControl("Physical weather").value).toBe("overcast");
    expect(window.localStorage.getItem(QUALITY_STORAGE_KEY)).not.toMatch(
      /weather|instant|sunny|overcast/i,
    );
  },
);
it("explains DST gaps without changing the instant and reports repeated minutes", async () => {
  const source = fixture("valid/minimal-semantic-schema.svg").replace(
    '"level":',
    '"location": {"latitude": 47.5, "longitude": 19, "northHeading": 270, "timeZone": "Europe/Budapest"}, "level":',
  );
  await mountProject(source);
  await clickView("3D");
  await selectQuality("3D lighting mode", "physical");
  await slideDaylight("Physical date", "91");
  const calls = rendererMocks.setLightingMode.mock.calls.length;
  await slideDaylight("Physical time", "150");
  expect(rendererMocks.setLightingMode).toHaveBeenCalledTimes(calls);
  expect(host.textContent).toContain("does not exist");
  expect(host.textContent).toContain("10:00");
  await slideDaylight("Physical date", "301");
  await slideDaylight("Physical time", "150");
  expect(host.textContent).toContain("using the earlier occurrence");
  expect(rendererMocks.setLightingMode).toHaveBeenLastCalledWith(
    "physical",
    Date.parse("2024-10-27T00:30:00Z"),
    "sunny",
  );
});
