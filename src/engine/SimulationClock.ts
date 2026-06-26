export const DAY_LENGTH = 120;
export const HOURS_PER_DAY = 24;

export class SimulationClock {
  private _elapsed = 0;
  private _paused = false;
  private _speed = 1;

  get hours(): number {
    const total = (this.elapsed / DAY_LENGTH) * HOURS_PER_DAY;
    return total % HOURS_PER_DAY;
  }
  get day(): number {
    return Math.floor((this.elapsed / DAY_LENGTH) % 365) + 1;
  }
  get totalDays(): number {
    return this.day;
  }
  get timeString(): string {
    const h = Math.floor(this.hours);
    const m = Math.floor((this.hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  get isNight(): boolean {
    return this.hours < 7 || this.hours >= 22;
  }

  get speed() { return this._speed; }
  get paused() { return this._paused; }
  get elapsed() { return this._elapsed; }

  setSpeed(s: number) { this._speed = Math.max(0, Math.min(10, s)); }
  togglePause() { this._paused = !this._paused; }

  update(dt: number) {
    if (!this._paused) this._elapsed += dt * this._speed;
  }

  reset() { this._elapsed = 0; this._paused = false; this._speed = 1; }

  restore(data: { elapsed: number; paused: boolean; speed: number }) {
    this._elapsed = data.elapsed;
    this._paused = data.paused;
    this._speed = data.speed;
  }
}
