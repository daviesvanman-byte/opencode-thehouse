import { PerspectiveCamera, Vector3, type Camera } from 'three';

export interface CameraFeed {
  name: string;
  room: string;
  camera: PerspectiveCamera;
}

interface CameraConfig {
  name: string;
  room: string;
  pos: [number, number, number];
  target: [number, number, number];
}

export class SurveillanceSystem {
  private feeds: CameraFeed[] = [];
  private _activeIndex = -1;
  private _tvMode = false;
  private tvTimer = 0;
  private tvInterval = 4;
  private transitioning = false;
  private transitionProgress = 0;
  private fromFeed: CameraFeed | null = null;
  private toFeed: CameraFeed | null = null;
  private posStart = new Vector3();
  private posEnd = new Vector3();
  private targetStart = new Vector3();
  private targetEnd = new Vector3();
  private focusNpcName = '';
  private focusTargetPos = new Vector3(0, 0.5, 0);
  private focusFeeds: number[] = [];
  private focusFeedIndex = 0;

  private camConfigs: CameraConfig[] = [
    // Living Room (center: 0,0  w:7  d:5.5) — two corner angles
    { name: 'Cam 1 — Living Room', room: 'Living Room', pos: [-2.8, 2.8, 2.0], target: [0, 0.8, 0] },
    { name: 'Cam 2 — Living Room', room: 'Living Room', pos: [2.8, 2.8, -1.8], target: [0, 0.8, 0] },
    // Kitchen (center: 0,4  w:5  d:3)
    { name: 'Cam 3 — Kitchen', room: 'Kitchen', pos: [2.0, 2.8, 5.2], target: [0, 0.8, 4] },
    { name: 'Cam 4 — Kitchen', room: 'Kitchen', pos: [-2.0, 2.8, 3.2], target: [0, 0.8, 4] },
    // Dining Room (center: -3,4  w:3  d:3)
    { name: 'Cam 5 — Dining Room', room: 'Dining Room', pos: [-4.2, 2.8, 5.2], target: [-3, 0.8, 4] },
    // Bedroom 1 (center: 4,-2  w:3.5  d:3.5)
    { name: 'Cam 6 — Bedroom 1', room: 'Bedroom 1', pos: [5.5, 2.8, -3.5], target: [4, 0.8, -2] },
    { name: 'Cam 7 — Bedroom 1', room: 'Bedroom 1', pos: [3.0, 2.8, -0.5], target: [4, 0.8, -2] },
    // Bedroom 2 (center: -4,-2  w:3.5  d:3.5)
    { name: 'Cam 8 — Bedroom 2', room: 'Bedroom 2', pos: [-5.5, 2.8, -0.5], target: [-4, 0.8, -2] },
    // Bedroom 3 (center: 4,2  w:3  d:3)
    { name: 'Cam 9 — Bedroom 3', room: 'Bedroom 3', pos: [5.2, 2.8, 0.8], target: [4, 0.8, 2] },
    // Bathroom (center: -4,2  w:2.5  d:2.5)
    { name: 'Cam 10 — Bathroom', room: 'Bathroom', pos: [-5.0, 2.8, 3.0], target: [-4, 0.8, 2] },
    // Garden (center: 0,-5.5  w:8  d:3)
    { name: 'Cam 11 — Garden', room: 'Garden', pos: [0, 4.0, -4.2], target: [0, 0.5, -6] },
    { name: 'Cam 12 — Garden', room: 'Garden', pos: [-3, 3.0, -6.5], target: [0, 0.5, -5.5] },
    // Diary Room (center: 0,-3.5  w:2.5  d:2)
    { name: 'Cam 13 — Diary Room', room: 'Diary Room', pos: [0.8, 2.5, -2.8], target: [0, 1.0, -3.5] },
    // Store Room (center: -3.5,-3  w:2  d:2)
    { name: 'Cam 14 — Store Room', room: 'Store Room', pos: [-4.2, 2.5, -2.5], target: [-3.5, 0.8, -3] },
  ];

  constructor() {
    this.setupCameras();
  }

  get visible() { return this._activeIndex >= 0; }
  get tvMode() { return this._tvMode; }

  get activeCamera(): Camera | null {
    return this._activeIndex >= 0 ? this.feeds[this._activeIndex]?.camera ?? null : null;
  }

  get activeFeedName(): string {
    return this._activeIndex >= 0 ? this.feeds[this._activeIndex].name : '';
  }

  private setupCameras() {
    for (const cfg of this.camConfigs) {
      const cam = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 40);
      cam.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      cam.lookAt(cfg.target[0], cfg.target[1], cfg.target[2]);
      this.feeds.push({ name: cfg.name, room: cfg.room, camera: cam });
    }
  }

  toggle() {
    if (this._tvMode) this._tvMode = false;
    this._activeIndex = this._activeIndex >= 0 ? -1 : 0;
    this.transitioning = false;
  }

  toggleTVMode() {
    if (this._activeIndex < 0) this._activeIndex = 0;
    this._tvMode = !this._tvMode;
    this.tvTimer = 0;
    this.transitioning = false;
  }

  setFocus(npcName: string, room: string, targetPos: Vector3) {
    this.focusNpcName = npcName;
    this.focusTargetPos.copy(targetPos);
    // Build list of feeds in the focus room
    this.focusFeeds = this.feeds
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.room === room)
      .map(({ i }) => i);
    this.focusFeedIndex = 0;
    // If TV mode is on, jump to first camera in the focus room
    if (this._tvMode && this.focusFeeds.length > 0) {
      this.transitionTo(this.focusFeeds[0]);
    }
  }

  clearFocus() {
    this.focusNpcName = '';
    this.focusFeeds = [];
    this.focusFeedIndex = 0;
  }

  updateFocusPos(pos: Vector3) {
    this.focusTargetPos.copy(pos);
  }

  nextCamera() {
    if (this._activeIndex < 0) return;
    const next = (this._activeIndex + 1) % this.feeds.length;
    this.transitionTo(next);
  }

  prevCamera() {
    if (this._activeIndex < 0) return;
    const prev = (this._activeIndex - 1 + this.feeds.length) % this.feeds.length;
    this.transitionTo(prev);
  }

  private transitionTo(index: number) {
    if (index === this._activeIndex) return;
    this.fromFeed = this.feeds[this._activeIndex];
    this.toFeed = this.feeds[index];
    if (this.fromFeed && this.toFeed) {
      this.posStart.copy(this.fromFeed.camera.position);
      this.posEnd.copy(this.toFeed.camera.position);
      // Compute target lookAt positions
      this.targetStart.set(0, 0.5, 0);
      this.targetEnd.set(0, 0.5, 0);
      this.transitioning = true;
      this.transitionProgress = 0;
    }
    this._activeIndex = index;
  }

  update(dt: number) {
    // Smooth transition lerp
    if (this.transitioning) {
      this.transitionProgress += dt * 2;
      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.transitioning = false;
      }
      const t = this.smoothstep(this.transitionProgress);
      const cam = this.feeds[this._activeIndex]?.camera;
      if (cam) {
        cam.position.lerpVectors(this.posStart, this.posEnd, t);
        const target = new Vector3().lerpVectors(this.targetStart, this.targetEnd, t);
        cam.lookAt(target);
      }
      return;
    }

    // TV mode auto-cycling with focus on task NPCs
    if (this._tvMode && this._activeIndex >= 0) {
      this.tvTimer += dt;
      if (this.tvTimer >= this.tvInterval) {
        this.tvTimer = 0;
        this.updateActiveCamera(true);
      }
      // Update look-at every frame when tracking a focus target
      if (this.focusNpcName) {
        const cam = this.feeds[this._activeIndex]?.camera;
        if (cam && !this.transitioning) {
          cam.lookAt(this.focusTargetPos);
        }
      }
      return;
    }

    // Static camera look-at (only when not in TV mode)
    this.updateActiveCamera(false);
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private getNextCamera(): number {
    if (this.focusFeeds.length > 1) {
      this.focusFeedIndex = (this.focusFeedIndex + 1) % this.focusFeeds.length;
      return this.focusFeeds[this.focusFeedIndex];
    }
    if (this.focusFeeds.length === 1) return this.focusFeeds[0];
    return (this._activeIndex + 1) % this.feeds.length;
  }

  updateActiveCamera(random = false) {
    if (random && this._tvMode) {
      const newIdx = this.getNextCamera();
      this.transitionTo(newIdx);
      return;
    }
    const idx = this._activeIndex;
    if (idx < 0) return;
    const feed = this.feeds[idx];
    if (!feed) return;
    // If focusing on a task NPC, look at their position
    if (this.focusNpcName) {
      feed.camera.lookAt(this.focusTargetPos);
    } else {
      const cfg = this.camConfigs[idx];
      if (!cfg) return;
      feed.camera.lookAt(cfg.target[0], cfg.target[1], cfg.target[2]);
    }
  }

  handleClick(x: number, _y: number): number {
    if (this._activeIndex < 0) return -1;
    if (this._tvMode) {
      this._tvMode = false;
      return this._activeIndex;
    }
    const halfW = window.innerWidth / 2;
    if (x < halfW) this.prevCamera();
    else this.nextCamera();
    return this._activeIndex;
  }

  getFeeds() { return this.feeds; }

  updateAspect(w: number, h: number) {
    for (const feed of this.feeds) {
      feed.camera.aspect = w / h;
      feed.camera.updateProjectionMatrix();
    }
  }

  dispose() {}
}
