import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/app.js";
import type { DesignDocument } from "@planaxis/design";
import * as designApi from "@planaxis/design";
import type { RuntimeFinishOptions } from "@planaxis/renderer-three";

const renderer = vi.hoisted(() => ({
  onError: vi.fn<(error: unknown) => void>(),
  initialize: vi.fn<() => Promise<void>>(),
  setModel: vi.fn(),
  resize: vi.fn(),
  selectCamera: vi.fn(),
  selectWalk: vi.fn(),
  setFocalLengthOverride: vi.fn(),
  setPresentationSettings: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("@planaxis/renderer-three", async (original) => ({
  ...(await original<typeof import("@planaxis/renderer-three")>()),
  createApartmentRenderer: (_canvas: HTMLCanvasElement, onError: (error: unknown) => void) => {
    renderer.onError.mockImplementation(onError);
    return renderer;
  },
}));
const fixture = (path: string): string =>
  readFileSync(resolve(fileURLToPath(import.meta.url), "../../../../fixtures", path), "utf8");
const activeSource = fixture("valid/minimal-document-schema.svg");
const alternativeSource = fixture("valid/minimal-semantic-schema.svg");
const activePath = "architecture/existing.svg";
const alternativePath = "architecture/variants/alternative.svg";
const path = "designs/warm & bright.json";
const otherPath = "designs/other.json";
const baseline: DesignDocument = {
  schema: "planaxis-design/1.0",
  name: "Warm",
  architecture: alternativePath,
  finishes: [{ target: "floor", material: "assets/materials/not-yet-created" }],
  presentation: { toneMapping: "neutral", exposureEv: 6 },
};
let descriptors: Map<string, unknown>;
let sources: Map<string, string>;
let materials: Map<string, unknown>;
const materialPath = "assets/materials/paint.json";
const texturePath = "assets/materials/paint.png";
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const imageClose = vi.fn();
let saved: { path: string; method: string; document: DesignDocument }[];
const fetchMock = vi.fn<typeof fetch>();
let host: HTMLDivElement;
let root: Root;
async function server(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = new URL(String(url), "http://localhost");
  const resource = address.searchParams.get("path") ?? "";
  if (address.pathname === "/api/project")
    return Response.json({
      schema: "planaxis-project/1.0",
      name: "Renovation",
      architecture: { active: activePath },
    });
  if (address.pathname === "/api/project/architecture") return new Response(activeSource);
  if (address.pathname === "/api/project/material")
    return materials.has(resource)
      ? Response.json(materials.get(resource))
      : new Response("/private/missing", { status: 404 });
  if (address.pathname === "/api/project/material-texture") return new Response(pngBytes);
  if (address.pathname === "/api/project/designs")
    return Response.json({ designs: [...descriptors.keys()] });
  if (address.pathname === "/api/project/architecture-resource") {
    return sources.has(resource)
      ? new Response(sources.get(resource))
      : new Response("/private/project/missing.svg", { status: 404 });
  }
  if (address.pathname === "/api/project/design") {
    if (init?.method === "POST" || init?.method === "PUT") {
      const document = JSON.parse(String(init.body)) as DesignDocument;
      saved.push({ path: resource, method: init.method, document });
      descriptors.set(resource, document);
      return new Response(null, { status: init.method === "POST" ? 201 : 204 });
    }
    const value = descriptors.get(resource);
    return typeof value === "string" ? new Response(value) : Response.json(value);
  }
  throw new Error(`Unexpected request: ${String(url)}`);
}
beforeEach(() => {
  descriptors = new Map([
    [path, baseline],
    [otherPath, { ...baseline, name: "Other", architecture: activePath }],
  ]);
  sources = new Map([
    [activePath, activeSource],
    [alternativePath, alternativeSource],
  ]);
  saved = [];
  materials = new Map([
    [
      materialPath,
      {
        schema: "planaxis-material/1.0",
        name: "Paint",
        baseColor: [0.8, 0.6, 0.4],
        roughness: 0.7,
      },
    ],
  ]);
  imageClose.mockReset();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 2, height: 2, close: imageClose }),
  );
  fetchMock.mockReset().mockImplementation(server);
  for (const mock of Object.values(renderer)) mock.mockReset();
  renderer.initialize.mockResolvedValue();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount(): Promise<void> {
  await act(async () => root.render(<App />));
}
function control(label: string): HTMLInputElement | HTMLSelectElement {
  const element = host.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[aria-label="${label}"]`,
  );
  if (!element) throw new Error(`Missing ${label}`);
  return element;
}
async function change(label: string, value: string): Promise<void> {
  await act(async () => {
    const element = control(label);
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
async function click(label: string): Promise<void> {
  const button = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === label,
  );
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
}
async function submit(label: string): Promise<void> {
  const form = control(label).closest("form");
  if (!form) throw new Error("Missing form");
  await act(async () =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
async function select(value = path): Promise<void> {
  await change("Design scenario", value);
}
function status(): string | null | undefined {
  return host.querySelector('[role="status"]')?.textContent;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

it("discovers descriptor paths without loading or selecting a design and resets on remount", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  await mount();
  expect(control("Design scenario").value).toBe("");
  expect(
    [...control("Design scenario").querySelectorAll("option")].map((option) => option.textContent),
  ).toEqual(["No design", path, otherPath]);
  expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContainEqual(
    expect.stringContaining("/design?"),
  );
  await select();
  await act(async () => root.unmount());
  root = createRoot(host);
  await mount();
  expect(control("Design scenario").value).toBe("");
  expect(host.querySelector(".architecture-path")?.textContent).toContain(activePath);
  expect(storage).not.toHaveBeenCalled();
  expect(saved).toEqual([]);
});
it.each(["http", "transport", "malformed", "unsafe-path"])(
  "keeps the active workspace usable on %s discovery failure",
  async (failure) => {
    fetchMock.mockImplementation(async (url, init) => {
      if (url !== "/api/project/designs") return server(url, init);
      if (failure === "transport") throw new Error("/private/project/secret");
      if (failure === "malformed") return new Response("not JSON");
      if (failure === "unsafe-path")
        return Response.json({ designs: ["/private/project/secret.json"] });
      return new Response("/private/project/secret", { status: 500 });
    });
    await mount();
    expect(status()).toBe("Valid");
    expect(host.querySelector("img")).not.toBeNull();
    expect(host.textContent).toContain("Design discovery / API");
    expect(host.textContent).not.toContain("/private/project");
  },
);
it.each([activePath, alternativePath])(
  "loads and resolves the exact bound architecture %s",
  async (architecture) => {
    descriptors.set(path, { ...baseline, architecture });
    const resolveDesign = vi.spyOn(designApi, "resolveDesignArchitecture");
    await mount();
    await select();
    expect(host.textContent).toContain("Design resolved: Warm");
    expect(status()).toBe("Valid");
    expect(host.querySelector(".architecture-path")?.textContent).toContain(architecture);
    expect(resolveDesign).toHaveBeenCalledWith(
      expect.objectContaining({ path }),
      expect.objectContaining({
        path: architecture,
        finishTargets: expect.arrayContaining([expect.objectContaining({ id: "floor" })]),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/project/architecture-resource?${new URLSearchParams({ path: architecture })}`,
      expect.anything(),
    );
    await click("3D");
    expect(renderer.setModel).toHaveBeenCalledTimes(1);
    expect(renderer.setModel.mock.calls[0]).toHaveLength(1); // No runtime material assignments.
    expect(renderer.setModel.mock.calls[0]?.[0].cameras.length).toBe(
      architecture === activePath ? 0 : 1,
    );
    expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ toneMapping: "Neutral", exposureEv: 6 }),
    );
    expect(control("3D exposure (EV)").value).toBe("6");
    expect(control("3D tone mapping").disabled).toBe(true);
    expect(saved).toEqual([]);
  },
);
it.each([
  ["{", "DESIGN_INVALID_JSON"],
  [JSON.stringify({ ...baseline, schema: "planaxis-design/99" }), "DESIGN_UNSUPPORTED_SCHEMA"],
])(
  "reports malformed or unsupported descriptors as Design Format problems",
  async (descriptor, code) => {
    descriptors.set(path, descriptor);
    await mount();
    await select();
    expect(host.textContent).toContain(`Design Format: ${code}`);
    expect(status()).toBe("Design unavailable");
    expect(host.querySelector("img")).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("architecture-resource")),
    ).toBe(false);
  },
);
it("reports inaccessible bound architecture as a controlled resource problem and keeps the descriptor editable", async () => {
  sources.delete(alternativePath);
  await mount();
  await select();
  expect(host.textContent).toContain("Design project / API resource problem");
  expect(host.textContent).toContain("HTTP 404");
  expect(host.textContent).not.toContain("/private/project");
  expect(host.querySelector("img")).toBeNull();
  expect(control("Design name").value).toBe("Warm");
  await change("Design name", "Still editable");
  await submit("Design name");
  expect(saved[0]?.document.name).toBe("Still editable");
  expect(host.textContent).not.toContain("Design resolved:");
});
it("uses existing Apartment SVG diagnostics for invalid bound architecture", async () => {
  sources.set(alternativePath, fixture("invalid/missing-cameras-group.svg"));
  await mount();
  await select();
  expect(status()).toBe("Invalid");
  expect(host.textContent).toContain("Schema validation failed");
  expect(host.querySelector("img")).not.toBeNull();
  expect(host.querySelector('[aria-label="Apartment view"]')).toBeNull();
  expect(host.textContent).not.toContain("Design resolved:");
});
it("retains stale assignments, reports resolution errors and displays default appearance", async () => {
  const stale = { target: "wall:removed:side-positive", material: "assets/materials/opaque" };
  descriptors.set(path, { ...baseline, finishes: [stale] });
  await mount();
  await select();
  expect(host.textContent).toContain("DESIGN_UNRESOLVED_TARGET");
  expect(host.textContent).toContain(stale.target);
  expect(host.textContent).not.toContain("Design resolved:");
  await click("3D");
  expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({ toneMapping: "AgX", exposureEv: 0 }),
  );
  expect(renderer.setModel.mock.calls[0]).toHaveLength(1);
  await change("Design name", "Retained");
  await submit("Design name");
  expect(saved[0]?.document.finishes).toEqual([stale]);
  expect(host.textContent).toContain("DESIGN_UNRESOLVED_TARGET");
});
it("clears back to active architecture with default presentation and no writes", async () => {
  await mount();
  await select();
  await click("3D");
  await select("");
  expect(host.querySelector(".architecture-path")?.textContent).toContain(activePath);
  expect(host.querySelector("img")).not.toBeNull();
  await click("3D");
  expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({ toneMapping: "AgX", exposureEv: 0 }),
  );
  expect(control("3D tone mapping").disabled).toBe(false);
  expect(saved).toEqual([]);
});
it.each(["descriptor", "architecture"])(
  "ignores late %s responses after selecting another design or clearing",
  async (stage) => {
    const pending = deferred<Response>();
    fetchMock.mockImplementation((url, init) => {
      const address = new URL(String(url), "http://localhost");
      if (
        (stage === "descriptor" &&
          address.pathname === "/api/project/design" &&
          address.searchParams.get("path") === path) ||
        (stage === "architecture" &&
          address.pathname === "/api/project/architecture-resource" &&
          address.searchParams.get("path") === alternativePath)
      )
        return pending.promise;
      return server(url, init);
    });
    await mount();
    await select();
    await select(otherPath);
    expect(host.textContent).toContain("Design resolved: Other");
    await select("");
    await act(async () =>
      pending.resolve(
        stage === "descriptor" ? Response.json(baseline) : new Response(alternativeSource),
      ),
    );
    expect(control("Design scenario").value).toBe("");
    expect(status()).toBe("Valid");
    expect(host.querySelector(".architecture-path")?.textContent).toContain(activePath);
  },
);
it.each([false, true])(
  "creates required fields bound to the displayed architecture (selected=%s)",
  async (selected) => {
    await mount();
    if (selected) await select();
    await change("New design path", "designs/new.json");
    await change("New design name", "New scenario");
    await submit("New design name");
    expect(saved).toEqual([
      {
        method: "POST",
        path: "designs/new.json",
        document: {
          schema: "planaxis-design/1.0",
          name: "New scenario",
          architecture: selected ? alternativePath : activePath,
        },
      },
    ]);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/project/designs")).toHaveLength(2);
    expect(control("Design scenario").value).toBe("designs/new.json");
    expect(host.textContent).toContain("Design resolved: New scenario");
  },
);
it.each(["POST", "PUT"])(
  "preserves the loaded durable scenario after %s failure",
  async (method) => {
    await mount();
    await select();
    await click("3D");
    fetchMock.mockImplementation(async (url, init) =>
      init?.method === method
        ? new Response("/private/project/unsafe", { status: 409 })
        : server(url, init),
    );
    if (method === "POST") {
      await change("New design path", "designs/new.json");
      await change("New design name", "New");
      await submit("New design name");
    } else {
      await change("Design name", "Unsaved");
      await change("Design exposure (EV)", "3");
      await submit("Design name");
    }
    expect(host.textContent).toContain("HTTP 409");
    expect(host.textContent).not.toContain("/private/project");
    expect(host.textContent).toContain("Saved name: Warm");
    expect(control("Design scenario").value).toBe(path);
    expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ exposureEv: 6 }),
    );
    expect(saved).toEqual([]);
  },
);
it("edits optional overrides independently without changing architecture or finishes", async () => {
  descriptors.set(path, { ...baseline, presentation: undefined });
  // Serialized JSON omits undefined, as a descriptor with no presentation does.
  await mount();
  await select();
  await click("3D");
  await change("Design name", "Edited");
  await change("Design tone mapping", "aces-filmic");
  await submit("Design name");
  await change("Design exposure (EV)", "12.345");
  await submit("Design name");
  await change("Design tone mapping", "agx");
  await change("Design exposure (EV)", "-5.25");
  await submit("Design name");
  await change("Design tone mapping", "");
  await submit("Design name");
  await change("Design exposure (EV)", "");
  await submit("Design name");
  expect(saved.map((save) => save.document.presentation)).toEqual([
    { toneMapping: "aces-filmic" },
    { toneMapping: "aces-filmic", exposureEv: 12.345 },
    { toneMapping: "agx", exposureEv: -5.25 },
    { exposureEv: -5.25 },
    undefined,
  ]);
  for (const save of saved) {
    expect(save).toMatchObject({
      method: "PUT",
      path,
      document: { architecture: alternativePath, finishes: baseline.finishes, name: "Edited" },
    });
  }
  expect(saved[4]?.document).not.toHaveProperty("presentation");
  expect(renderer.setModel).toHaveBeenCalledTimes(1);
  expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({ toneMapping: "AgX", exposureEv: 0 }),
  );
});
it("keeps wide persisted exposure unchanged when renaming and excludes transient environment state", async () => {
  await mount();
  await select();
  await click("3D");
  await change("3D environment intensity", "2.5");
  await change("3D environment rotation (degrees)", "150");
  await change("Design name", "Renamed");
  await submit("Design name");
  expect(saved[0]?.document).toEqual({ ...baseline, name: "Renamed" });
  expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith({
    toneMapping: "Neutral",
    exposureEv: 6,
    environmentIntensity: 2.5,
    environmentRotationDegrees: 150,
  });
});
it("classifies renderer exposure limitations as renderer failure, retaining valid editable design data", async () => {
  descriptors.set(path, { ...baseline, presentation: { exposureEv: 1e308 } });
  await mount();
  await select();
  renderer.setPresentationSettings.mockImplementation(() => {
    throw new Error("/private/renderer/overflow");
  });
  await click("3D");
  expect(status()).toBe("Renderer failure");
  expect(host.textContent).not.toContain("Design Format:");
  expect(host.textContent).not.toContain("/private/renderer");
  expect(control("Design exposure (EV)").value).toBe("1e+308");
});
it.each(["POST", "PUT"])(
  "does not let late %s completion overwrite a later selection",
  async (method) => {
    await mount();
    await select();
    const pending = deferred<Response>();
    fetchMock.mockImplementation((url, init) =>
      init?.method === method ? pending.promise : server(url, init),
    );
    if (method === "POST") {
      await change("New design path", "designs/new.json");
      await change("New design name", "New");
      await submit("New design name");
    } else {
      await change("Design name", "Old save");
      await submit("Design name");
    }
    await select(otherPath);
    await act(async () =>
      pending.resolve(new Response(null, { status: method === "POST" ? 201 : 204 })),
    );
    expect(control("Design scenario").value).toBe(otherPath);
    expect(control("Design name").value).toBe("Other");
  },
);
it("selects a successfully created design even if the subsequent discovery refresh fails", async () => {
  await mount();
  fetchMock.mockImplementation(async (url, init) =>
    url === "/api/project/designs" ? new Response(null, { status: 500 }) : server(url, init),
  );
  await change("New design path", "designs/new.json");
  await change("New design name", "New");
  await submit("New design name");
  expect(control("Design scenario").value).toBe("designs/new.json");
  expect(host.textContent).toContain("Design resolved: New");
  expect(host.textContent).toContain("Design discovery / API");
});

it("recovers from an unsupported renderer exposure after saving a representable override", async () => {
  descriptors.set(path, { ...baseline, presentation: { exposureEv: 1e308 } });
  await mount();
  await select();
  renderer.setPresentationSettings.mockImplementation((settings: { exposureEv: number }) => {
    if (!Number.isFinite(2 ** settings.exposureEv)) throw new Error("Overflow");
  });
  await click("3D");
  expect(status()).toBe("Renderer failure");
  await change("Design exposure (EV)", "2");
  await submit("Design name");
  expect(status()).toBe("Valid");
  await click("3D");
  expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({ exposureEv: 2 }),
  );
});
it("rejects invalid create and edit drafts before requesting persistence", async () => {
  await mount();
  await select();
  await change("New design path", "../invalid.json");
  await change("New design name", "New");
  await submit("New design name");
  expect(host.textContent).toContain("DESIGN_INVALID_DESCRIPTOR_PATH");
  await change("Design name", "   ");
  await submit("Design name");
  expect(host.textContent).toContain("DESIGN_INVALID_NAME");
  expect(saved).toEqual([]);
});
it("ignores a late bound architecture response while the newer design remains selected", async () => {
  const pending = deferred<Response>();
  fetchMock.mockImplementation((url, init) =>
    String(url).includes("architecture-resource") &&
    new URL(String(url), "http://localhost").searchParams.get("path") === alternativePath
      ? pending.promise
      : server(url, init),
  );
  await mount();
  await select();
  await select(otherPath);
  await act(async () => pending.resolve(new Response(alternativeSource)));
  expect(control("Design scenario").value).toBe(otherPath);
  expect(host.textContent).toContain("Design resolved: Other");
  expect(host.querySelector(".architecture-path")?.textContent).toContain(activePath);
});

it("does not let delayed startup discovery hide a design created during discovery", async () => {
  const pending = deferred<Response>();
  let discoveries = 0;
  fetchMock.mockImplementation((url, init) => {
    if (url === "/api/project/designs" && ++discoveries === 1) return pending.promise;
    return server(url, init);
  });
  await mount();
  await change("New design path", "designs/new.json");
  await change("New design name", "New");
  await submit("New design name");
  await act(async () => pending.resolve(Response.json({ designs: [] })));
  expect(control("Design scenario").value).toBe("designs/new.json");
  expect(host.textContent).toContain("Design resolved: New");
});

function useMaterial(textured = false): void {
  descriptors.set(path, { ...baseline, finishes: [{ target: "floor", material: materialPath }] });
  if (textured)
    materials.set(materialPath, {
      schema: "planaxis-material/1.0",
      name: "Mapped",
      mapping: { widthCm: 30, heightCm: 60 },
      maps: { baseColor: texturePath, normal: texturePath },
    });
}
it("supplies resolved scalar assignments to setModel and preserves them while editing", async () => {
  useMaterial();
  await mount();
  await select();
  await click("3D");
  const finishes = renderer.setModel.mock.calls[0]?.[1] as RuntimeFinishOptions;
  expect(finishes.assignments?.get("floor")).toEqual({
    baseColor: [0.8, 0.6, 0.4],
    roughness: 0.7,
    metalness: 0,
    alpha: { mode: "opaque" },
  });
  expect(finishes.assignments?.has("ceiling")).toBe(false);
  await change("3D camera", "@walk");
  await change("Design name", "Renamed");
  await submit("Design name");
  expect(renderer.setModel).toHaveBeenCalledTimes(1);
  expect(saved[0]?.document.finishes).toEqual([{ target: "floor", material: materialPath }]);
});
it.each(["planaxis-material/1.0", "planaxis-material/1.1"])(
  "keeps all finishes neutral after a %s material fails and still applies presentation",
  async (schema) => {
    useMaterial();
    materials.set(materialPath, {
      schema,
      name: "AO compatibility",
      mapping: { widthCm: 30, heightCm: 60 },
      maps:
        schema === "planaxis-material/1.1"
          ? { ambientOcclusion: texturePath }
          : { baseColor: texturePath },
    });
    descriptors.set(path, {
      ...baseline,
      finishes: [
        { target: "floor", material: materialPath },
        { target: "ceiling", material: "assets/materials/missing.json" },
      ],
    });
    await mount();
    await select();
    expect(status()).toBe("Valid");
    expect(host.textContent).toContain("Material descriptor project / API resource failure");
    expect(host.textContent).toContain("Design resolved: Warm");
    expect(host.textContent).not.toContain("/private");
    await click("3D");
    expect(renderer.setModel.mock.calls[0]).toHaveLength(1);
    expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ toneMapping: "Neutral", exposureEv: 6 }),
    );
  },
);
it("passes selected-design Material 1.1 AO assignments to the renderer", async () => {
  useMaterial();
  materials.set(materialPath, {
    schema: "planaxis-material/1.1",
    name: "AO finish",
    ambientOcclusionStrength: 0.4,
    mapping: { widthCm: 30, heightCm: 60 },
    maps: { ambientOcclusion: texturePath },
  });
  await mount();
  await select();
  await click("3D");
  const finishes = renderer.setModel.mock.calls[0]?.[1] as RuntimeFinishOptions;
  expect(finishes.assignments?.get("floor")).toMatchObject({
    ambientOcclusionStrength: 0.4,
    textures: { ambientOcclusionMap: expect.any(Symbol) },
  });
  await select("");
  expect(imageClose).toHaveBeenCalledTimes(1);
});
it.each(["adaptation", "rendering"])(
  "falls back to neutral finishes after renderer %s failure",
  async (stage) => {
    useMaterial(true);
    await mount();
    await select();
    if (stage === "adaptation")
      renderer.setModel.mockImplementationOnce(() => {
        throw new Error("/private/adaptation");
      });
    await click("3D");
    if (stage === "rendering")
      await act(async () => renderer.onError(new Error("/private/rendering")));
    expect(status()).toBe("Valid");
    expect(host.textContent).toContain("Renderer material adaptation/rendering failed");
    expect(host.textContent).not.toContain("/private");
    expect(renderer.setModel.mock.lastCall).toHaveLength(1);
    expect(imageClose).toHaveBeenCalledTimes(1);
    expect(renderer.setPresentationSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ toneMapping: "Neutral", exposureEv: 6 }),
    );
  },
);
it.each(["replace", "clear", "unmount"])(
  "releases prepared source images on %s",
  async (action) => {
    useMaterial(true);
    await mount();
    await select();
    await click("3D");
    expect(imageClose).not.toHaveBeenCalled();
    if (action === "unmount") {
      await act(async () => root.unmount());
      root = createRoot(host);
    } else await select(action === "clear" ? "" : otherPath);
    expect(imageClose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalled();
  },
);
it.each(["material", "material-texture", "decode"])(
  "ignores late %s completion and cleans obsolete images",
  async (stage) => {
    useMaterial(true);
    const pending = deferred<Response>();
    const pendingImage = deferred<unknown>();
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((url, init) => {
      const address = new URL(String(url), "http://localhost");
      if (
        address.pathname === `/api/project/${stage}` &&
        [materialPath, texturePath].includes(address.searchParams.get("path") ?? "")
      ) {
        signal = init?.signal;
        return pending.promise;
      }
      return server(url, init);
    });
    if (stage === "decode") vi.stubGlobal("createImageBitmap", () => pendingImage.promise);
    await mount();
    await select();
    await select(otherPath);
    if (stage !== "decode") expect(signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve(
        stage === "material" ? Response.json(materials.get(materialPath)) : new Response(pngBytes),
      );
      pendingImage.resolve({ width: 1, height: 1, close: imageClose });
    });
    expect(host.textContent).toContain("Design resolved: Other");
    expect(host.querySelector(".architecture-path")?.textContent).toContain(activePath);
    expect(imageClose).toHaveBeenCalledTimes(stage === "decode" ? 1 : 0);
    await click("3D");
    expect(renderer.setModel.mock.lastCall).toHaveLength(1);
  },
);
it.each(["no-finishes", "stale", "invalid-svg"])(
  "does not request material resources for %s",
  async (kind) => {
    if (kind === "no-finishes") descriptors.set(path, { ...baseline, finishes: undefined });
    if (kind === "stale")
      descriptors.set(path, {
        ...baseline,
        finishes: [{ target: "wall:removed:side-positive", material: materialPath }],
      });
    if (kind === "invalid-svg")
      sources.set(alternativePath, fixture("invalid/missing-cameras-group.svg"));
    await mount();
    await select();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/material"))).toBe(false);
  },
);

it("retains prepared textures across 2D/3D switches without new fetches or decodes", async () => {
  useMaterial(true);
  await mount();
  await select();
  await click("3D");
  const fetchCount = fetchMock.mock.calls.length;
  const firstFinishes = renderer.setModel.mock.lastCall?.[1];
  await click("2D");
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
  expect(imageClose).not.toHaveBeenCalled();
  await click("3D");
  expect(renderer.setModel.mock.lastCall?.[1]).toBe(firstFinishes);
  expect(fetchMock).toHaveBeenCalledTimes(fetchCount);
  expect(createImageBitmap).toHaveBeenCalledTimes(1);
});
