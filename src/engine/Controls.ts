import { PerspectiveCamera, Vector3 } from 'three';
import { type PhysicsWorld } from './Physics';
import type { TouchState } from './MobileControls';

export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.3;
export const PLAYER_SPEED = 6;
export const PLAYER_SPRINT = 10;
export const MOUSE_SENSITIVITY = 0.002;

export class Controls {
  private euler = { yaw: Math.PI, pitch: 0 };
  private move = { fwd: false, bkwd: false, left: false, right: false, sprint: false };
  private locked = false;
  private playerId = {};
  private touchActive = false;

  constructor(
    private camera: PerspectiveCamera,
    private physics?: PhysicsWorld,
  ) {
    camera.position.set(0, PLAYER_HEIGHT, -6); // spawn in Garden
    if (physics) {
      const body = physics.addSphere([0, 0.8, 0], PLAYER_RADIUS, 1);
      body.fixedRotation = true;
      body.updateMassProperties();
      physics.register(this.playerId, body);
    }
    this.bind();
  }

  get isLocked() { return this.locked || this.touchActive; }
  get isMoving() {
    return this.move.fwd || this.move.bkwd || this.move.left || this.move.right;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': this.move.fwd = true; break;
      case 'KeyS': this.move.bkwd = true; break;
      case 'KeyA': this.move.left = true; break;
      case 'KeyD': this.move.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.move.sprint = true; break;
      case 'KeyM': this.toggleNoClip(); break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': this.move.fwd = false; break;
      case 'KeyS': this.move.bkwd = false; break;
      case 'KeyA': this.move.left = false; break;
      case 'KeyD': this.move.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.move.sprint = false; break;
    }
  };

  private _noClip = false;

  toggleNoClip() {
    this._noClip = !this._noClip;
    return this._noClip;
  }

  private onMouse = (e: MouseEvent) => {
    if (!this.locked) return;
    this.euler.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.euler.pitch -= e.movementY * MOUSE_SENSITIVITY;
    this.euler.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.pitch));
  };

  private bind() {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouse);
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement !== null;
    });
  }

  lock() { document.body.requestPointerLock(); }

  feedTouch(state: TouchState) {
    this.touchActive = state.active;
    this.move.fwd = state.moveFwd;
    this.move.bkwd = state.moveBkwd;
    this.move.left = state.moveLeft;
    this.move.right = state.moveRight;
    this.euler.yaw += state.yawDelta;
    this.euler.pitch += state.pitchDelta;
    this.euler.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.pitch));
  }

  update(dt: number) {
    if (!this.locked && !this.touchActive) return;
    const speed = this.move.sprint ? PLAYER_SPRINT : PLAYER_SPEED;
    const fwd = new Vector3(-Math.sin(this.euler.yaw), 0, -Math.cos(this.euler.yaw));
    const right = new Vector3(fwd.z, 0, -fwd.x);
    const dir = new Vector3();
    if (this.move.fwd) dir.add(fwd);
    if (this.move.bkwd) dir.sub(fwd);
    if (this.move.right) dir.add(right);
    if (this.move.left) dir.sub(right);

    if (this.physics && !this._noClip) {
      const body = this.physics.getBody(this.playerId);
      if (body) {
        if (dir.lengthSq() > 0) {
          dir.normalize().multiplyScalar(speed);
          body.velocity.x = dir.x;
          body.velocity.z = dir.z;
        } else {
          body.velocity.x *= 0.85;
          body.velocity.z *= 0.85;
        }
        body.velocity.y = 0;
        this.camera.position.x = body.position.x;
        this.camera.position.z = body.position.z;
      }
    } else {
      if (dir.lengthSq() > 0) {
        dir.normalize().multiplyScalar(speed * dt);
        this.camera.position.add(dir);
      }
    }

    this.camera.position.y = PLAYER_HEIGHT;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.euler.yaw;
    this.camera.rotation.x = this.euler.pitch;
  }

  getPosition() { return this.camera.position.clone(); }
  getYaw() { return this.euler.yaw; }

  setPosition(x: number, z: number) {
    this.camera.position.set(x, PLAYER_HEIGHT, z);
    if (this.physics) {
      this.physics.setPosition(this.playerId, x, 0.8, z);
    }
  }

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouse);
  }
}
