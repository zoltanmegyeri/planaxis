import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseDesignDescriptor } from "@planaxis/design";
import { loadMaterials } from "../src/load-materials.js";

const first = "assets/materials/first.json";
const second = "assets/materials/second.json";
const texturePath = "assets/materials/shared & packed.png";
const scalar = { schema: "planaxis-material/1.0", name: "Paint" };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const mapped = {
  ...scalar,
  metalness: 1,
  mapping: { widthCm: 25.5, heightCm: 40 },
  maps: {
    baseColor: texturePath,
    roughness: texturePath,
    metalness: texturePath,
    normal: texturePath,
  },
};
const aoMapped = {
  ...mapped,
  schema: "planaxis-material/1.1",
  maps: { ...mapped.maps, ambientOcclusion: texturePath },
};
const fetchMock = vi.fn<typeof fetch>();
const decode = vi.fn();
let resources: Map<string, string | Uint8Array>;
let images: { width: number; height: number; close: ReturnType<typeof vi.fn> }[];
function design(finishes?: { target: string; material: string }[]) {
  const result = parseDesignDescriptor(
    JSON.stringify({
      schema: "planaxis-design/1.0",
      name: "Test",
      architecture: "architecture/a.svg",
      finishes,
    }),
    "designs/test.json",
  );
  if (!result.ok) throw new Error("Invalid test design");
  return result.value;
}
const selection = () =>
  design([
    { target: "floor", material: first },
    { target: "ceiling", material: second },
  ]);
beforeEach(() => {
  resources = new Map<string, string | Uint8Array>([
    [first, JSON.stringify(mapped)],
    [second, JSON.stringify(mapped)],
    [texturePath, png],
  ]);
  images = [];
  decode.mockReset().mockImplementation(async () => {
    const image = { width: 2, height: 2, close: vi.fn() };
    images.push(image);
    return image;
  });
  fetchMock.mockReset().mockImplementation(async (url) => {
    const path = new URL(String(url), "http://localhost").searchParams.get("path") ?? "";
    const value = resources.get(path);
    return value === undefined
      ? new Response("/private/project/secret", { status: 404 })
      : new Response(typeof value === "string" ? value : new Uint8Array(value).buffer);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", decode);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("does not request resources for a design without finishes", async () => {
  expect(await loadMaterials(design(), new AbortController().signal)).toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(decode).not.toHaveBeenCalled();
});

it.each([
  [undefined, { mode: "opaque" }],
  [{ mode: "opaque" }, { mode: "opaque" }],
  [
    { mode: "mask", cutoff: 0.5 },
    { mode: "mask", cutoff: 0.5, opacity: 1 },
  ],
  [
    { mode: "blend", opacity: 0.3 },
    { mode: "blend", opacity: 0.3 },
  ],
])(
  "translates scalar defaults and alpha %j without requesting textures",
  async (alpha, expected) => {
    resources.set(first, JSON.stringify({ ...scalar, alpha }));
    const loaded = await loadMaterials(
      design([{ target: "floor", material: first }]),
      new AbortController().signal,
    );
    expect(loaded?.finishes.assignments?.get("floor")).toEqual({
      baseColor: [1, 1, 1],
      roughness: 1,
      metalness: 0,
      alpha: expected,
    });
    expect(loaded?.finishes.assignments?.has("ceiling")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(decode).not.toHaveBeenCalled();
    loaded?.dispose();
  },
);

it("deduplicates descriptors and packed textures while preserving all map roles and physical size", async () => {
  const loaded = await loadMaterials(
    design([
      { target: "floor", material: first },
      { target: "ceiling", material: first },
      { target: "space:living:floor", material: second },
    ]),
    new AbortController().signal,
  );
  expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
    `/api/project/material?${new URLSearchParams({ path: first })}`,
    `/api/project/material?${new URLSearchParams({ path: second })}`,
    `/api/project/material-texture?${new URLSearchParams({ path: texturePath })}`,
  ]);
  expect(decode).toHaveBeenCalledTimes(1);
  const assignments = loaded?.finishes.assignments;
  expect(assignments?.get("floor")).toBe(assignments?.get("ceiling"));
  const textures = assignments?.get("floor")?.textures;
  expect(textures?.widthCm.toString()).toBe("25.5");
  expect(textures?.heightCm.toString()).toBe("40");
  const reference = textures?.baseColorMap;
  expect(typeof reference).toBe("symbol");
  expect(textures).toMatchObject({
    roughnessMap: reference,
    metalnessMap: reference,
    normalMap: reference,
  });
  expect(assignments?.get("space:living:floor")?.textures?.baseColorMap).toBe(reference);
  loaded?.dispose();
  expect(images[0]?.close).toHaveBeenCalledTimes(1);
});

it.each([
  ["descriptor", "Material descriptor project / API resource failure"],
  ["json", "MATERIAL_INVALID_JSON"],
  ["format", "MATERIAL_UNSUPPORTED_SCHEMA"],
  ["texture", "Texture project / API resource failure"],
  ["content", "Unsupported or mismatched texture content"],
  ["decode", "Texture image decode/loading failed"],
])("keeps %s failures distinct and safe", async (failure, diagnostic) => {
  if (failure === "descriptor") resources.delete(second);
  if (failure === "json") resources.set(second, "{");
  if (failure === "format") resources.set(second, JSON.stringify({ ...scalar, schema: "private" }));
  if (failure === "texture") resources.delete(texturePath);
  if (failure === "content") resources.set(texturePath, new Uint8Array([255, 216, 255]));
  if (failure === "decode") decode.mockRejectedValue(new Error("/private/project/secret"));
  await expect(loadMaterials(selection(), new AbortController().signal)).rejects.toThrow(
    diagnostic,
  );
  expect(images).toEqual([]);
});

it.each(["material", "material-texture"])(
  "sanitizes transport exceptions in %s requests",
  async (kind) => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes(`/${kind}?`)) throw new Error("/private/secret");
      return new Response(JSON.stringify(mapped));
    });
    const promise = loadMaterials(selection(), new AbortController().signal);
    await expect(promise).rejects.toThrow("project / API resource failure");
    await expect(promise).rejects.not.toThrow("/private");
  },
);

it("cleans up a decoded image when a later texture fails", async () => {
  const other = "assets/materials/other.png";
  resources.set(second, JSON.stringify({ ...mapped, maps: { normal: other } }));
  resources.set(other, png);
  decode
    .mockImplementationOnce(async () => {
      const image = { width: 1, height: 1, close: vi.fn() };
      images.push(image);
      return image;
    })
    .mockRejectedValueOnce(new Error("decode"));
  await expect(loadMaterials(selection(), new AbortController().signal)).rejects.toThrow(
    "decode/loading",
  );
  expect(images[0]?.close).toHaveBeenCalledTimes(1);
});

it.each([undefined, 0, 0.4, 1])(
  "translates AO strength %s and deduplicates packed ORM across materials",
  async (strength) => {
    resources.set(first, JSON.stringify({ ...aoMapped, ambientOcclusionStrength: strength }));
    resources.set(second, JSON.stringify(aoMapped));
    const loaded = await loadMaterials(selection(), new AbortController().signal);
    const floor = loaded?.finishes.assignments?.get("floor");
    const ceiling = loaded?.finishes.assignments?.get("ceiling");
    expect(floor?.ambientOcclusionStrength).toBe(strength ?? 1);
    expect(ceiling?.ambientOcclusionStrength).toBe(1);
    const textures = floor?.textures;
    const reference = textures?.ambientOcclusionMap;
    expect(typeof reference).toBe("symbol");
    expect(textures).toMatchObject({ roughnessMap: reference, metalnessMap: reference });
    expect(ceiling?.textures?.ambientOcclusionMap).toBe(reference);
    expect(textures?.widthCm.toString()).toBe("25.5");
    expect(textures?.heightCm.toString()).toBe("40");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode.mock.calls[0]?.[1]).toEqual({
      imageOrientation: "flipY",
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
    });
    loaded?.dispose();
    loaded?.dispose();
    expect(images[0]?.close).toHaveBeenCalledTimes(1);
  },
);

it("cleans prepared textures when a later AO texture fails to decode", async () => {
  const aoPath = "assets/materials/ao.png";
  resources.set(second, JSON.stringify({ ...aoMapped, maps: { ambientOcclusion: aoPath } }));
  resources.set(aoPath, png);
  decode
    .mockImplementationOnce(async () => {
      const image = { width: 1, height: 1, close: vi.fn() };
      images.push(image);
      return image;
    })
    .mockRejectedValueOnce(new Error("AO decode failed"));
  await expect(loadMaterials(selection(), new AbortController().signal)).rejects.toThrow(
    "decode/loading",
  );
  expect(images[0]?.close).toHaveBeenCalledTimes(1);
});

it("closes a late AO decode after cancellation without returning assignments", async () => {
  resources.set(first, JSON.stringify(aoMapped));
  const controller = new AbortController();
  const image = { width: 1, height: 1, close: vi.fn() };
  decode.mockImplementationOnce(async () => {
    controller.abort();
    return image;
  });
  await expect(loadMaterials(selection(), controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(image.close).toHaveBeenCalledTimes(1);
});
