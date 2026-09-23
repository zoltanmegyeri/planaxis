import { afterEach, expect, it, vi } from "vitest";
import { createDecimal } from "@planaxis/geometry";
import {
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three/webgpu";
import { buildApartmentScene, prepareRuntimeTextures } from "../src/index.js";
import { modelFixture } from "./model-fixture.js";

const png = [137, 80, 78, 71, 13, 10, 26, 10];
const resource = (path = "assets/materials/a.png", bytes = png) => ({
  path,
  bytes: new Uint8Array(bytes).buffer,
});
const bitmap = () => ({ width: 2, height: 2, close: vi.fn() });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["a.png", png, "image/png"],
  ["a.jpg", [255, 216, 255], "image/jpeg"],
  ["a.jpeg", [255, 216, 255], "image/jpeg"],
  ["a.webp", [82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80], "image/webp"],
] as const)(
  "checks %s bytes then decodes with explicit orientation and raw channels",
  async (path, bytes, type) => {
    const image = bitmap();
    const decode = vi.fn().mockResolvedValue(image);
    vi.stubGlobal("createImageBitmap", decode);
    const reference = Symbol();
    const prepared = await prepareRuntimeTextures(
      new Map([[reference, resource(path, [...bytes])]]),
      new AbortController().signal,
    );
    expect(decode).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type }), {
      imageOrientation: "flipY",
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
    });
    const source = prepared.resolveTexture(reference);
    expect(source.image).toBe(image);
    expect(source.flipY).toBe(false);
    expect(source.premultiplyAlpha).toBe(false);
    const dispose = vi.spyOn(source, "dispose");
    prepared.dispose();
    prepared.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(image.close).toHaveBeenCalledTimes(1);
    expect(() => prepared.resolveTexture(reference)).toThrow("preparation");
  },
);

it.each([
  ["a.jpg", png],
  ["a.png", [255, 216, 255]],
  ["a.png", [71, 73, 70]],
  ["a.gif", png],
  ["a.webp", [82, 73, 70, 70]],
  ["a.png", []],
])("rejects unsupported/mismatched %s content before invoking a decoder", async (path, bytes) => {
  const decode = vi.fn();
  vi.stubGlobal("createImageBitmap", decode);
  await expect(
    prepareRuntimeTextures(
      new Map([[Symbol(), resource(path, bytes)]]),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ kind: "content" });
  expect(decode).not.toHaveBeenCalled();
});

it.each(["content", "decode", "renderer", "abort"])(
  "releases partial preparation on %s failure",
  async (failure) => {
    const first = bitmap(),
      second = bitmap();
    const controller = new AbortController();
    const decode = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(async () => {
        if (failure === "abort") controller.abort();
        if (failure === "decode") throw new Error("private decoder details");
        return second;
      });
    vi.stubGlobal("createImageBitmap", decode);
    const dispose = vi.spyOn(Texture.prototype, "dispose");
    if (failure === "renderer")
      vi.spyOn(Texture.prototype, "needsUpdate", "set").mockImplementationOnce(() => {
        throw new Error("GPU details");
      });
    const prepared = prepareRuntimeTextures(
      new Map([
        [Symbol(), resource()],
        [Symbol(), resource("second.png", failure === "content" ? [] : png)],
      ]),
      controller.signal,
    );
    await expect(prepared).rejects.toMatchObject(
      failure === "abort" ? { name: "AbortError" } : { kind: failure },
    );
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(failure === "abort" ? 1 : 0);
  },
);

it("ignores an already aborted preparation and closes a late decoded image", async () => {
  const controller = new AbortController();
  let finish!: (value: unknown) => void;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const pending = prepareRuntimeTextures(new Map([[Symbol(), resource()]]), controller.signal);
  controller.abort();
  const image = bitmap();
  finish(image);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(image.close).toHaveBeenCalledTimes(1);
  await expect(prepareRuntimeTextures(new Map(), controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});

it("shares prepared pixels across map roles while owning separate configured clones", async () => {
  const image = bitmap();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(image));
  const reference = Symbol();
  const prepared = await prepareRuntimeTextures(
    new Map([[reference, resource()]]),
    new AbortController().signal,
  );
  const source = prepared.resolveTexture(reference);
  const sourceDisposal = vi.spyOn(source, "dispose");
  const scene = buildApartmentScene(modelFixture(), {
    resolveTexture: prepared.resolveTexture,
    assignments: new Map([
      [
        "floor",
        {
          baseColor: [1, 1, 1],
          roughness: 1,
          metalness: 1,
          textures: {
            widthCm: createDecimal("25"),
            heightCm: createDecimal("50"),
            baseColorMap: reference,
            roughnessMap: reference,
            metalnessMap: reference,
            normalMap: reference,
          },
        },
      ],
    ]),
  });
  const floor = scene.group.getObjectByName("floor");
  if (!(floor instanceof Mesh) || !(floor.material instanceof MeshStandardMaterial))
    throw new Error("Expected floor material");
  expect(floor.material.normalScale.toArray()).toEqual([1, 1]);
  const clones = [
    floor.material.map,
    floor.material.roughnessMap,
    floor.material.metalnessMap,
    floor.material.normalMap,
  ];
  const disposals = clones.map((map, index) => {
    if (!map) throw new Error("Expected map");
    expect(map.image).toBe(image);
    expect(map.flipY).toBe(false);
    expect(map.colorSpace).toBe(index === 0 ? SRGBColorSpace : NoColorSpace);
    expect([map.wrapS, map.wrapT]).toEqual([RepeatWrapping, RepeatWrapping]);
    expect(map.repeat.toArray()).toEqual([1, 1]);
    return vi.spyOn(map, "dispose");
  });
  expect(new Set(clones).size).toBe(4);
  scene.dispose();
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  expect(sourceDisposal).not.toHaveBeenCalled();
  expect(image.close).not.toHaveBeenCalled();
  prepared.dispose();
  expect(sourceDisposal).toHaveBeenCalledTimes(1);
  expect(image.close).toHaveBeenCalledTimes(1);
});

it("releases completed sources immediately on abort while another decode is pending", async () => {
  const first = bitmap(),
    late = bitmap();
  let finish!: (value: unknown) => void;
  const decode = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  vi.stubGlobal("createImageBitmap", decode);
  const controller = new AbortController();
  const pending = prepareRuntimeTextures(
    new Map([
      [Symbol(), resource()],
      [Symbol(), resource("second.png")],
    ]),
    controller.signal,
  );
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
  controller.abort();
  expect(first.close).toHaveBeenCalledTimes(1);
  finish(late);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(first.close).toHaveBeenCalledTimes(1);
  expect(late.close).toHaveBeenCalledTimes(1);
});
