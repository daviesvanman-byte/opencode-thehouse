import {
  AnimationMixer, AnimationClip, AnimationAction, LoopRepeat,
  Object3D, VectorKeyframeTrack,
} from 'three';

type AnimState = 'idle' | 'walking';

export class AnimationController {
  private mixer: AnimationMixer;
  private idleAction: AnimationAction;
  private walkAction: AnimationAction;
  private currentState: AnimState = 'idle';
  private transitionTime = 0.3;

  constructor(root: Object3D) {
    this.mixer = new AnimationMixer(root);

    this.idleAction = this.mixer.clipAction(this.createIdleClip(root));
    this.idleAction.setLoop(LoopRepeat, Infinity);
    this.idleAction.play();

    this.walkAction = this.mixer.clipAction(this.createWalkClip(root));
    this.walkAction.setLoop(LoopRepeat, Infinity);
    this.walkAction.stop();

    this.crossFade('idle', 0);
  }

  private createIdleClip(_root: Object3D): AnimationClip {
    const dur = 3.2;
    const times = [0, dur / 4, dur / 2, (3 * dur) / 4, dur];

    // Subtle breathing — Y-axis scale pulse
    const scaleY = [1, 1.003, 1, 0.997, 1];
    const scaleYTrack = new VectorKeyframeTrack('.scale[y]', times, scaleY);

    // Subtle body sway — Z rotation
    const rotZ = [0, 0.003, 0, -0.003, 0];
    const rotZTrack = new VectorKeyframeTrack('.rotation[z]', times, rotZ);

    // Micro Y bobbing
    const posY = [0, 0.002, 0, -0.002, 0];
    const posYTrack = new VectorKeyframeTrack('.position[y]', times, posY);

    return new AnimationClip('idle', dur, [scaleYTrack, rotZTrack, posYTrack]);
  }

  private createWalkClip(_root: Object3D): AnimationClip {
    const stepDur = 0.5;
    const dur = stepDur * 2;
    const times = [0, dur / 4, dur / 2, (3 * dur) / 4, dur];

    // Vertical bob — steps
    const posY = [0, 0.008, 0, 0.012, 0];
    const posYTrack = new VectorKeyframeTrack('.position[y]', times, posY);

    // Forward lean
    const rotX = [0.04, 0.05, 0.04, 0.06, 0.04];
    const rotXTrack = new VectorKeyframeTrack('.rotation[x]', times, rotX);

    // Side sway in rhythm with steps
    const rotZ = [0, 0.015, 0, -0.015, 0];
    const rotZTrack = new VectorKeyframeTrack('.rotation[z]', times, rotZ);

    return new AnimationClip('walk', dur, [posYTrack, rotXTrack, rotZTrack]);
  }

  setState(state: AnimState) {
    if (state === this.currentState) return;
    this.crossFade(state, this.transitionTime);
    this.currentState = state;
  }

  private crossFade(to: AnimState, duration: number) {
    const fromAction = this.currentState === 'walking' ? this.walkAction : this.idleAction;
    const toAction = to === 'walking' ? this.walkAction : this.idleAction;

    fromAction.fadeOut(duration);
    toAction.reset().fadeIn(duration).play();
  }

  update(dt: number) {
    this.mixer.update(dt);
  }

  stop() {
    this.idleAction.stop();
    this.walkAction.stop();
    this.mixer.stopAllAction();
  }

  dispose() {
    this.stop();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
