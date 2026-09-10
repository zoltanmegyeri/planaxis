/** Minimal DOM event/animation boundary for deterministic, GPU-free navigation tests. */
export function navigationSurface(platform = "Linux x86_64") {
  let time = 0;
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const window = Object.assign(new EventTarget(), {
    navigator: { platform },
    performance: { now: () => time },
    requestAnimationFrame(callback: FrameRequestCallback): number {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id: number): void {
      frames.delete(id);
    },
  });
  const document = Object.assign(new EventTarget(), {
    defaultView: window,
    visibilityState: "visible",
  });
  const canvas = Object.assign(new EventTarget(), {
    ownerDocument: document,
    focus: () => undefined,
  }) as unknown as HTMLCanvasElement;
  function dispatch(target: EventTarget, type: string, properties: object = {}): Event {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, properties);
    target.dispatchEvent(event);
    return event;
  }
  return {
    canvas,
    window,
    document,
    frames,
    dispatch,
    key(type: "keydown" | "keyup", code: string, properties: object = {}): Event {
      return dispatch(type === "keydown" ? canvas : window, type, {
        code,
        repeat: false,
        ...properties,
      });
    },
    pointer(type: string, x = 0, y = 0, properties: object = {}): Event {
      return dispatch(canvas, type, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1,
        ...properties,
      });
    },
    elapse(milliseconds: number): void {
      time += milliseconds;
    },
    frame(milliseconds: number): void {
      time += milliseconds;
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    },
  };
}
