import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import { MathUtils, PerspectiveCamera, Vector3 } from "three/webgpu";
import { rendererPoint } from "./coordinates.js";
import {
  WALK_EYE_HEIGHT_CM,
  WALK_LOOK_RADIANS_PER_PIXEL,
  WALK_PITCH_LIMIT_DEGREES,
  WALK_SPEED_METERS_PER_SECOND,
} from "./navigation-constants.js";

const FORWARD_KEYS = ["KeyW", "ArrowUp"];
const BACKWARD_KEYS = ["KeyS", "ArrowDown"];
const LEFT_KEYS = ["KeyA", "ArrowLeft"];
const RIGHT_KEYS = ["KeyD", "ArrowRight"];
const FAST_KEYS = ["ShiftLeft", "ShiftRight"];

/** Owns one model's transient Walk pose and focused-canvas input lifecycle. */
export class WalkControls {
  private readonly position: Vector3;
  private heading: number;
  private pitch = 0;
  private readonly held = new Set<string>();
  private readonly window: Window;
  private readonly document: Document;
  private readonly slowKeys: string[];
  private readonly handledKeys: Set<string>;
  private active = false;
  private disposed = false;
  private frame: number | undefined;
  private previousTime: number | undefined;
  private drag: { pointerId: number; x: number; y: number } | undefined;

  constructor(
    model: ArchitecturalModel3D,
    private readonly camera: PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly onChange: () => void,
  ) {
    const source = model.cameras[0];
    if (!source) throw new Error("Free walk requires at least one camera in the Apartment SVG.");
    this.position = rendererPoint({
      ...source.position,
      z: model.floor.z.plus(WALK_EYE_HEIGHT_CM),
    });
    this.heading = MathUtils.degToRad(source.heading.toNumber());
    this.document = canvas.ownerDocument;
    const view = this.document.defaultView;
    if (!view) throw new Error("Walk controls require a browser window.");
    this.window = view;
    this.slowKeys = /Mac/i.test(view.navigator.platform) ? ["AltLeft", "AltRight"] : ["Space"];
    this.handledKeys = new Set([
      ...FORWARD_KEYS,
      ...BACKWARD_KEYS,
      ...LEFT_KEYS,
      ...RIGHT_KEYS,
      ...FAST_KEYS,
      ...this.slowKeys,
    ]);
  }

  activate(): void {
    if (this.disposed || this.active) return;
    this.active = true;
    this.applyPose();
    this.canvas.addEventListener("keydown", this.keyDown);
    this.window.addEventListener("keyup", this.keyUp);
    this.canvas.addEventListener("pointerdown", this.pointerDown);
    this.canvas.addEventListener("pointermove", this.pointerMove);
    this.canvas.addEventListener("pointerup", this.pointerUp);
    this.canvas.addEventListener("pointerleave", this.resetInput);
    this.canvas.addEventListener("pointercancel", this.resetInput);
    this.canvas.addEventListener("blur", this.resetInput);
    this.window.addEventListener("blur", this.resetInput);
    this.document.addEventListener("visibilitychange", this.visibilityChange);
    this.canvas.focus({ preventScroll: true });
  }

  deactivate(): void {
    this.active = false;
    this.resetInput();
    this.canvas.removeEventListener("keydown", this.keyDown);
    this.window.removeEventListener("keyup", this.keyUp);
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointerleave", this.resetInput);
    this.canvas.removeEventListener("pointercancel", this.resetInput);
    this.canvas.removeEventListener("blur", this.resetInput);
    this.window.removeEventListener("blur", this.resetInput);
    this.document.removeEventListener("visibilitychange", this.visibilityChange);
  }

  dispose(): void {
    this.deactivate();
    this.disposed = true;
  }

  private hasAny(keys: readonly string[]): boolean {
    return keys.some((key) => this.held.has(key));
  }

  private movement(): { forward: number; right: number; speed: number } {
    const forward = Number(this.hasAny(FORWARD_KEYS)) - Number(this.hasAny(BACKWARD_KEYS));
    const right = Number(this.hasAny(RIGHT_KEYS)) - Number(this.hasAny(LEFT_KEYS));
    const length = Math.hypot(forward, right) || 1;
    const fast = this.hasAny(FAST_KEYS);
    const slow = this.hasAny(this.slowKeys);
    const multiplier = fast === slow ? 1 : fast ? 2 : 0.5;
    return {
      forward: forward / length,
      right: right / length,
      speed: multiplier * WALK_SPEED_METERS_PER_SECOND,
    };
  }

  private advance(time: number): void {
    if (this.previousTime === undefined) return;
    // Input may have already advanced beyond the current animation frame's timestamp.
    if (time <= this.previousTime) return;
    const seconds = (time - this.previousTime) / 1000;
    this.previousTime = time;
    const { forward, right, speed } = this.movement();
    if (forward === 0 && right === 0) return;
    // Three.js Y is vertical; pitch never contributes to horizontal translation.
    this.position.x +=
      (forward * Math.cos(this.heading) - right * Math.sin(this.heading)) * speed * seconds;
    this.position.z +=
      (forward * Math.sin(this.heading) + right * Math.cos(this.heading)) * speed * seconds;
    this.applyPose();
    this.onChange();
  }

  private synchronizeLoop(): void {
    const { forward, right } = this.movement();
    if (!this.active || (forward === 0 && right === 0)) {
      if (this.frame !== undefined) this.window.cancelAnimationFrame(this.frame);
      this.frame = undefined;
      this.previousTime = undefined;
    } else if (this.frame === undefined) {
      this.previousTime ??= this.window.performance.now();
      this.frame = this.window.requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (time: number): void => {
    this.frame = undefined;
    if (!this.active) return;
    this.advance(time);
    this.synchronizeLoop();
  };

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey) {
      this.resetInput();
      return;
    }
    if (!this.handledKeys.has(event.code)) return;
    event.preventDefault();
    // A repeat after blur/leave is not fresh input and must not restart movement.
    if (event.repeat) return;
    this.advance(this.window.performance.now());
    this.held.add(event.code);
    this.synchronizeLoop();
  };

  private readonly keyUp = (event: KeyboardEvent): void => {
    if (!this.held.has(event.code)) return;
    event.preventDefault();
    this.advance(this.window.performance.now());
    this.held.delete(event.code);
    this.synchronizeLoop();
  };

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    event.preventDefault();
    this.canvas.focus({ preventScroll: true });
    this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if ((event.buttons & 1) === 0) {
      this.drag = undefined;
      return;
    }
    this.advance(this.window.performance.now());
    this.heading += (event.clientX - drag.x) * WALK_LOOK_RADIANS_PER_PIXEL;
    const limit = MathUtils.degToRad(WALK_PITCH_LIMIT_DEGREES);
    this.pitch = MathUtils.clamp(
      this.pitch + (event.clientY - drag.y) * WALK_LOOK_RADIANS_PER_PIXEL,
      -limit,
      limit,
    );
    this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    this.applyPose();
    this.onChange();
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.drag?.pointerId) this.drag = undefined;
  };

  private readonly visibilityChange = (): void => {
    if (this.document.visibilityState === "hidden") this.resetInput();
  };

  private readonly resetInput = (): void => {
    this.held.clear();
    this.drag = undefined;
    this.synchronizeLoop();
  };

  private applyPose(): void {
    this.camera.position.copy(this.position);
    this.camera.up.set(0, 1, 0);
    const direction = new Vector3(
      Math.cos(this.pitch) * Math.cos(this.heading),
      -Math.sin(this.pitch),
      Math.cos(this.pitch) * Math.sin(this.heading),
    );
    this.camera.lookAt(this.position.clone().add(direction));
  }
}
