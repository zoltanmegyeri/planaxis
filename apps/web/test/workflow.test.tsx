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
import * as processing from "../src/process-document.js";

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
