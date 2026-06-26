/**
 * MobileControls translates touch input into movement + look controls.
 * Left half = virtual joystick (movement), right half = drag to look.
 * Feeds into Controls' move flags and euler angles via a shared state object.
 */
export interface TouchState {
  moveFwd: boolean;
  moveBkwd: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  yawDelta: number;
  pitchDelta: number;
  active: boolean;
}

export class MobileControls {
  private state: TouchState = { moveFwd: false, moveBkwd: false, moveLeft: false, moveRight: false, yawDelta: 0, pitchDelta: 0, active: false };
  private touches: Map<number, { id: number; sx: number; sy: number; cx: number; cy: number; zone: 'left' | 'right' }> = new Map();
  private joystickCenter: { x: number; y: number } | null = null;
  private readonly DEAD_ZONE = 0.15;

  constructor(container: HTMLElement) {
    container.addEventListener('touchstart', this.onStart, { passive: true });
    container.addEventListener('touchmove', this.onMove, { passive: true });
    container.addEventListener('touchend', this.onEnd, { passive: true });
    container.addEventListener('touchcancel', this.onEnd, { passive: true });
    this.state.active = true;
  }

  private onStart = (e: TouchEvent) => {
    // Don't prevent default — allow click to fire for tap interactions
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const cx = t.clientX;
      const cy = t.clientY;
      const halfW = window.innerWidth / 2;
      const zone: 'left' | 'right' = cx < halfW ? 'left' : 'right';
      this.touches.set(t.identifier, { id: t.identifier, sx: cx, sy: cy, cx, cy, zone });
      if (zone === 'left') {
        this.joystickCenter = { x: cx, y: cy };
      }
    }
  };

  private onMove = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const existing = this.touches.get(t.identifier);
      if (existing) {
        existing.cx = t.clientX;
        existing.cy = t.clientY;
      }
    }
    this.updateState();
  };

  private onEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.touches.delete(e.changedTouches[i].identifier);
    }
    // If no left-zone touches remain, clear movement
    const leftTouch = Array.from(this.touches.values()).find(t => t.zone === 'left');
    if (!leftTouch) {
      this.joystickCenter = null;
      this.state.moveFwd = false;
      this.state.moveBkwd = false;
      this.state.moveLeft = false;
      this.state.moveRight = false;
    }
    this.state.yawDelta = 0;
    this.state.pitchDelta = 0;
  };

  private updateState() {
    this.state.yawDelta = 0;
    this.state.pitchDelta = 0;

    // Right-zone touches = camera look
    const rightTouches = Array.from(this.touches.values()).filter(t => t.zone === 'right');
    for (const t of rightTouches) {
      const dx = t.cx - t.sx;
      const dy = t.cy - t.sy;
      this.state.yawDelta = -dx * 0.005;  // drag right = look right
      this.state.pitchDelta = -dy * 0.005;  // reversed: drag down = look up
      // Update start position for continuous drag
      t.sx = t.cx;
      t.sy = t.cy;
    }

    // Left-zone touches = joystick movement
    const leftTouch = Array.from(this.touches.values()).find(t => t.zone === 'left');
    if (leftTouch && this.joystickCenter) {
      const dx = leftTouch.cx - this.joystickCenter.x;
      const dy = leftTouch.cy - this.joystickCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.min(window.innerWidth, window.innerHeight) * 0.15;
      const norm = Math.min(dist / maxDist, 1);

      if (norm > this.DEAD_ZONE) {
        const angle = Math.atan2(dx, dy); // angle relative to forward
        this.state.moveFwd = Math.cos(angle) < -0.3;
        this.state.moveBkwd = Math.cos(angle) > 0.3;
        this.state.moveLeft = Math.sin(angle) < -0.3;
        this.state.moveRight = Math.sin(angle) > 0.3;
      } else {
        this.state.moveFwd = false;
        this.state.moveBkwd = false;
        this.state.moveLeft = false;
        this.state.moveRight = false;
      }
    }
  }

  getState(): Readonly<TouchState> {
    return this.state;
  }

  dispose() {
    const container = document.body;
    container.removeEventListener('touchstart', this.onStart);
    container.removeEventListener('touchmove', this.onMove);
    container.removeEventListener('touchend', this.onEnd);
    container.removeEventListener('touchcancel', this.onEnd);
    this.touches.clear();
  }
}
