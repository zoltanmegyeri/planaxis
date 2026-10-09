/** Owns only a bounded refinement burst; interaction can restart it, idle cannot. */
export class TemporalConvergence {
  private frame: number | undefined;
  private remaining = 0;

  constructor(
    private readonly view:
      Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame"> | null | undefined,
    private readonly draw: () => boolean,
  ) {}

  restart(additionalFrames: number): void {
    this.cancel();
    this.remaining = additionalFrames;
    this.schedule();
  }

  cancel(): void {
    if (this.frame !== undefined) this.view?.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.remaining = 0;
  }

  private schedule(): void {
    if (!this.view || this.remaining <= 0) return;
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = undefined;
      this.remaining--;
      if (this.draw()) this.schedule();
      else this.cancel();
    });
  }
}
