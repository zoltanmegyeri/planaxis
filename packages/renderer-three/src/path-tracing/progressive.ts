/** Explicit exception to event-driven rendering, owned only by the active tracer. */
export class ProgressiveAccumulator {
  samples = 0;
  paused = false;
  private active = false;
  private disposed = false;
  private frame: number | undefined;
  private inputs = "";

  constructor(
    private readonly view: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">,
    private readonly draw: (sample: number) => void,
    private readonly changed: () => void,
    private readonly failed: (error: unknown) => void,
  ) {}

  setInputs(key: string): boolean {
    if (this.inputs === key) return false;
    this.inputs = key;
    this.samples = 0;
    this.changed();
    return true;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.cancel();
    else this.schedule();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.cancel();
    else this.schedule();
    this.changed();
  }

  private schedule(): void {
    if (!this.active || this.paused || this.disposed || this.frame !== undefined) return;
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.active || this.paused || this.disposed) return;
      try {
        this.draw(this.samples);
        this.samples++;
        if (this.samples === 1 || this.samples % 16 === 0) this.changed();
        this.schedule();
      } catch (error) {
        this.active = false;
        this.failed(error);
      }
    });
  }

  private cancel(): void {
    if (this.frame !== undefined) this.view.cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.active = false;
    this.cancel();
  }
}
