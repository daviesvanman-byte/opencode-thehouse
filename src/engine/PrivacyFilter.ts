export class PrivacyFilter {
  private overlay: HTMLElement | null = null;
  private _enabled = true;
  private targetBlur = 0;
  private currentBlur = 0;

  constructor() {
    this.overlay = document.getElementById('privacy-overlay');
  }

  get enabled() { return this._enabled; }

  setEnabled(v: boolean) {
    this._enabled = v;
    if (!v) this.targetBlur = 0;
  }

  requestBlur(intensity = 1) {
    this.targetBlur = intensity;
  }

  clearBlur() {
    this.targetBlur = 0;
  }

  update(_dt: number) {
    if (!this._enabled || !this.overlay) return;
    const speed = 3;
    if (this.currentBlur < this.targetBlur) {
      this.currentBlur = Math.min(this.currentBlur + speed * _dt, this.targetBlur);
    } else if (this.currentBlur > this.targetBlur) {
      this.currentBlur = Math.max(this.currentBlur - speed * _dt, this.targetBlur);
    }
    const px = Math.round(this.currentBlur * 8);
    this.overlay.style.backdropFilter = `blur(${px}px)`;
    (this.overlay.style as { webkitBackdropFilter?: string }).webkitBackdropFilter = `blur(${px}px)`;
  }

  /** No-op — kept for API compatibility with existing main.ts calls */
  applyPostProcess() {}
}
