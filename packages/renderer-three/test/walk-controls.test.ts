import { createDecimal as decimal } from "@planaxis/geometry";
import { PerspectiveCamera, Vector3 } from "three/webgpu";
import { afterEach, expect, it, vi } from "vitest";
import { WalkControls } from "../src/walk-controls.js";
import { modelFixture } from "./model-fixture.js";
import { navigationSurface } from "./navigation-surface.js";

const controllers: WalkControls[] = [];
afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.length = 0;
});

function setup(platform = "Linux x86_64", heading = "0") {
  const model = modelFixture();
  const source = model.cameras[0];
  if (!source) throw new Error("Missing camera fixture");
  const surface = navigationSurface(platform);
  const camera = new PerspectiveCamera();
  const render = vi.fn();
  const controls = new WalkControls(
    { ...model, cameras: [{ ...source, heading: decimal(heading) }] },
    camera,
    surface.canvas,
    render,
  );
  controllers.push(controls);
  controls.activate();
  const start = camera.position.clone();
  return { ...surface, camera, render, controls, start };
}

it.each([
  ["KeyW", [1.5, 0, 0]],
  ["ArrowUp", [1.5, 0, 0]],
  ["KeyS", [-1.5, 0, 0]],
  ["ArrowDown", [-1.5, 0, 0]],
  ["KeyA", [0, 0, -1.5]],
  ["ArrowLeft", [0, 0, -1.5]],
  ["KeyD", [0, 0, 1.5]],
  ["ArrowRight", [0, 0, 1.5]],
])("moves immediately with held %s without keyboard repeat", (key, expected) => {
  const walk = setup();
  expect(walk.key("keydown", key).defaultPrevented).toBe(true);
  expect(walk.frames.size).toBe(1);
  walk.frame(10);
  expect(walk.camera.position.distanceTo(walk.start)).toBeCloseTo(0.015);
  walk.frame(990);
  expect(walk.camera.position.clone().sub(walk.start).toArray()).toEqual(expected);
  walk.key("keyup", key);
  const renders = walk.render.mock.calls.length;
  expect(walk.frames.size).toBe(0);
  walk.frame(1000);
  expect(walk.render).toHaveBeenCalledTimes(renders);
});

it("integrates elapsed time across frames and input changes", () => {
  for (const frames of [1, 30, 144]) {
    const walk = setup();
    walk.key("keydown", "KeyW");
    for (let i = 0; i < frames; i++) walk.frame(1000 / frames);
    expect(walk.camera.position.x - walk.start.x).toBeCloseTo(1.5);
    walk.elapse(100);
    walk.key("keyup", "KeyW");
    expect(walk.camera.position.x - walk.start.x).toBeCloseTo(1.65);
  }
});

it("does not count elapsed input time twice when a frame carries an earlier timestamp", () => {
  const walk = setup();
  walk.key("keydown", "KeyW");
  walk.elapse(100);
  walk.key("keydown", "ShiftLeft");
  const pending = [...walk.frames.values()];
  walk.frames.clear();
  for (const callback of pending) callback(90);
  walk.frame(100);
  expect(walk.camera.position.x - walk.start.x).toBeCloseTo(0.15 + 0.3);
});

it("resolves opposing axes independently and resumes on release", () => {
  const walk = setup();
  for (const key of ["KeyW", "KeyS", "KeyA", "KeyD"]) walk.key("keydown", key);
  expect(walk.frames.size).toBe(0);
  walk.frame(1000);
  expect(walk.camera.position).toEqual(walk.start);
  walk.key("keyup", "KeyS");
  expect(walk.frames.size).toBe(1);
  walk.frame(1000);
  expect(walk.camera.position.clone().sub(walk.start).toArray()).toEqual([1.5, 0, 0]);
  walk.key("keydown", "ArrowDown");
  expect(walk.frames.size).toBe(0);
  walk.key("keyup", "KeyA");
  walk.frame(1000);
  expect(walk.camera.position.clone().sub(walk.start).toArray()).toEqual([1.5, 0, 1.5]);
});

it("normalizes diagonal movement and treats aliases as the same direction", () => {
  const walk = setup();
  for (const key of ["KeyW", "ArrowUp", "KeyD"]) walk.key("keydown", key);
  walk.frame(1000);
  expect(walk.camera.position.distanceTo(walk.start)).toBeCloseTo(1.5);
  expect(walk.camera.position.x - walk.start.x).toBeCloseTo(1.5 / Math.sqrt(2));
  expect(walk.camera.position.z - walk.start.z).toBeCloseTo(1.5 / Math.sqrt(2));
  walk.key("keyup", "KeyW");
  walk.key("keyup", "KeyD");
  const position = walk.camera.position.clone();
  walk.frame(1000);
  expect(walk.camera.position.x - position.x).toBeCloseTo(1.5);
  expect(walk.camera.position.z).toBe(position.z);
});

it.each(["MacIntel", "Win32", "Linux x86_64"])(
  "resolves fast, slow, and conflicting modifiers on %s",
  (platform) => {
    const slowKeys = platform === "MacIntel" ? ["AltLeft", "AltRight"] : ["Space"];
    for (const [keys, speed] of [
      [[], 1.5],
      [["ShiftLeft"], 3],
      [["ShiftRight"], 3],
      [["ShiftLeft", "ShiftRight"], 3],
      [slowKeys, 0.75],
      [["ShiftRight", ...slowKeys], 1.5],
    ] as const) {
      const walk = setup(platform);
      for (const key of keys) expect(walk.key("keydown", key).defaultPrevented).toBe(true);
      expect(walk.frames.size).toBe(0);
      walk.key("keydown", "KeyW");
      walk.frame(1000);
      expect(walk.camera.position.x - walk.start.x).toBeCloseTo(speed);
    }
  },
);

it("changes modifier categories immediately and retains a category until both keys are released", () => {
  const walk = setup("MacIntel");
  walk.key("keydown", "KeyW");
  for (const key of ["ShiftLeft", "ShiftRight", "AltLeft", "AltRight"]) walk.key("keydown", key);
  walk.frame(1000);
  walk.key("keyup", "ShiftLeft");
  walk.frame(1000);
  expect(walk.camera.position.x - walk.start.x).toBeCloseTo(3);
  walk.key("keyup", "ShiftRight");
  walk.frame(1000);
  walk.key("keyup", "AltLeft");
  walk.frame(1000);
  expect(walk.camera.position.x - walk.start.x).toBeCloseTo(4.5);
  walk.key("keyup", "AltRight");
  walk.frame(1000);
  expect(walk.camera.position.x - walk.start.x).toBeCloseTo(6);
});

it.each(["MacIntel", "Win32", "Linux x86_64"])(
  "leaves unrelated keys and browser shortcuts alone on %s",
  (platform) => {
    const walk = setup(platform);
    const unrelated = platform === "MacIntel" ? "Space" : "AltLeft";
    expect(walk.key("keydown", unrelated).defaultPrevented).toBe(false);
    expect(walk.key("keydown", "Escape").defaultPrevented).toBe(false);
    expect(walk.key("keydown", "KeyW", { metaKey: true }).defaultPrevented).toBe(false);
    expect(walk.key("keydown", "KeyW", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(walk.frames.size).toBe(0);
    walk.controls.deactivate();
    expect(walk.key("keydown", "ArrowUp").defaultPrevented).toBe(false);
  },
);

it("looks while moving with multiple keys and uses yaw alone for horizontal speed", () => {
  const walk = setup();
  for (const key of ["KeyW", "KeyD", "ShiftLeft"]) walk.key("keydown", key);
  walk.pointer("pointerdown");
  walk.pointer("pointermove", Math.PI / 2 / 0.003, Math.PI / 3 / 0.003);
  walk.frame(1000);
  expect(walk.camera.position.distanceTo(walk.start)).toBeCloseTo(3);
  expect(walk.camera.position.y).toBe(walk.start.y);
  expect(walk.camera.position.x - walk.start.x).toBeCloseTo(-3 / Math.sqrt(2));
  expect(walk.camera.position.z - walk.start.z).toBeCloseTo(3 / Math.sqrt(2));
  expect(walk.camera.getWorldDirection(new Vector3()).toArray()).toEqual([
    expect.closeTo(0),
    expect.closeTo(-Math.sqrt(3) / 2),
    expect.closeTo(0.5),
  ]);
  walk.pointer("pointerup");
  const direction = walk.camera.quaternion.clone();
  walk.pointer("pointermove", 2000, 2000);
  expect(walk.camera.quaternion.toArray()).toEqual(direction.toArray());
  expect(walk.frames.size).toBe(1);
});

it("clamps pitch below vertical with zero roll and renders mouse-only look without a loop", () => {
  const walk = setup();
  walk.pointer("pointerdown");
  for (const y of [100000, -100000]) {
    walk.pointer("pointermove", 200, y);
    expect(walk.camera.getWorldDirection(new Vector3()).y).toBeCloseTo(
      -Math.sign(y) * Math.sin((89 * Math.PI) / 180),
    );
    const cameraRight = new Vector3(1, 0, 0).applyQuaternion(walk.camera.quaternion);
    expect(cameraRight.y).toBeCloseTo(0);
    expect(walk.camera.up.toArray()).toEqual([0, 1, 0]);
    expect(walk.frames.size).toBe(0);
  }
  expect(walk.render).toHaveBeenCalledTimes(2);
});

it.each([
  "pointerleave",
  "pointercancel",
  "canvas blur",
  "window blur",
  "hidden",
  "deactivate",
  "dispose",
])(
  "clears movement, modifiers, and drag on %s without resuming from repeat events",
  (interruption) => {
    const walk = setup();
    walk.key("keydown", "ShiftRight");
    walk.key("keydown", "KeyW");
    walk.pointer("pointerdown");
    walk.frame(100);
    if (interruption === "canvas blur") walk.dispatch(walk.canvas, "blur");
    else if (interruption === "window blur") walk.dispatch(walk.window, "blur");
    else if (interruption === "hidden") {
      walk.document.visibilityState = "hidden";
      walk.dispatch(walk.document, "visibilitychange");
      walk.document.visibilityState = "visible";
      walk.dispatch(walk.document, "visibilitychange");
    } else if (interruption === "deactivate") {
      walk.controls.deactivate();
      walk.controls.activate();
    } else if (interruption === "dispose") {
      walk.controls.dispose();
      walk.controls.activate();
    } else walk.pointer(interruption);
    const position = walk.camera.position.clone();
    const orientation = walk.camera.quaternion.clone();
    walk.key("keydown", "KeyW", { repeat: true });
    walk.pointer("pointermove", 500, 500);
    walk.frame(1000);
    expect(walk.frames.size).toBe(0);
    expect(walk.camera.position).toEqual(position);
    expect(walk.camera.quaternion.toArray()).toEqual(orientation.toArray());
    walk.key("keyup", "KeyW");
    walk.key("keydown", "KeyW");
    walk.frame(1000);
    expect(walk.camera.position.distanceTo(position)).toBeCloseTo(
      interruption === "dispose" ? 0 : 1.5,
    );
  },
);

it("ignores touch and non-left drags and stops look when the left button is no longer held", () => {
  const walk = setup();
  const orientation = walk.camera.quaternion.clone();
  for (const properties of [{ pointerType: "touch" }, { button: 2 }]) {
    walk.pointer("pointerdown", 0, 0, properties);
    walk.pointer("pointermove", 100, 100);
    expect(walk.camera.quaternion.toArray()).toEqual(orientation.toArray());
  }
  walk.pointer("pointerdown");
  walk.pointer("pointermove", 100, 100, { buttons: 0 });
  walk.pointer("pointermove", 200, 200);
  expect(walk.camera.quaternion.toArray()).toEqual(orientation.toArray());
});
