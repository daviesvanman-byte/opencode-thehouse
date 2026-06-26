import {
  AnimationMixer, AnimationClip, AnimationAction, LoopRepeat,
  Object3D, QuaternionKeyframeTrack, SkinnedMesh,
} from 'three';

type AnimState = 'idle' | 'walking';

/**
 * Creates procedural animation clips for a Mixamo-compatible humanoid skeleton
 * (bones: Hips, Spine, Spine1, Spine2, Neck, Head, LeftArm, LeftForeArm,
 *  RightArm, RightForeArm, LeftUpLeg, LeftLeg, RightUpLeg, RightLeg, etc.)
 * and drives them via AnimationMixer.
 */
export class SkeletalAnimator {
  private mixer: AnimationMixer;
  private idleAction: AnimationAction;
  private walkAction: AnimationAction;
  private currentState: AnimState = 'idle';
  private transitionTime = 0.3;

  /** Find Hips bone from a loaded GLB scene and create the animator */
  static fromScene(scene: Object3D): SkeletalAnimator | null {
    const hips = SkeletalAnimator.findBone(scene, 'Hips');
    if (!hips) return null;
    return new SkeletalAnimator(hips);
  }

  /** Recursively search for a bone by name */
  static findBone(root: Object3D, name: string): Object3D | null {
    if (root.name === name) return root;
    for (const child of root.children) {
      const found = SkeletalAnimator.findBone(child, name);
      if (found) return found;
    }
    // Also check SkinnedMesh skeletons
    if (root instanceof SkinnedMesh && root.skeleton) {
      for (const bone of root.skeleton.bones) {
        if (bone.name === name) return bone;
      }
    }
    return null;
  }

  /** Build a path from root bone to the target bone */
  private static bonePath(root: Object3D, target: string, prefix = ''): string | null {
    if (root.name === target) return prefix;
    for (const child of root.children) {
      const p = SkeletalAnimator.bonePath(child, target, prefix ? `${prefix}/${child.name}` : child.name);
      if (p !== null) return p;
    }
    return null;
  }

  private constructor(rootBone: Object3D) {
    this.mixer = new AnimationMixer(rootBone);

    this.idleAction = this.mixer.clipAction(this.createIdleClip(rootBone));
    this.idleAction.setLoop(LoopRepeat, Infinity);
    this.idleAction.play();

    this.walkAction = this.mixer.clipAction(this.createWalkClip(rootBone));
    this.walkAction.setLoop(LoopRepeat, Infinity);
    this.walkAction.stop();

    this.crossFade('idle', 0);
  }

  private boneQTrack(
    root: Object3D, name: string,
    times: number[], keyframes: [number, number, number, number][],
  ): QuaternionKeyframeTrack | null {
    const path = SkeletalAnimator.bonePath(root, name);
    if (!path) return null;
    const values: number[] = [];
    for (const q of keyframes) { values.push(q[0], q[1], q[2], q[3]); }
    return new QuaternionKeyframeTrack(`${path}.quaternion`, times, values);
  }

  /** Subtle idle breathing and micro-movements */
  private createIdleClip(root: Object3D): AnimationClip {
    const dur = 3.2;
    const times = [0, dur / 4, dur / 2, (3 * dur) / 4, dur];

    interface BoneAnim { name: string; keyframes: [number, number, number, number][]; }
    const boneAnims: BoneAnim[] = [
      { name: 'Spine', keyframes: [
        [0, 0, 0, 1], [0.003, 0, 0, 1], [0, 0, 0, 1], [-0.003, 0, 0, 1], [0, 0, 0, 1],
      ]},
      { name: 'Spine1', keyframes: [
        [0, 0, 0, 1], [0.003, 0.002, 0, 1], [0, 0, 0, 1], [-0.003, -0.002, 0, 1], [0, 0, 0, 1],
      ]},
      { name: 'Spine2', keyframes: [
        [0, 0, 0, 1], [-0.002, 0.001, 0, 1], [0, 0, 0, 1], [0.002, -0.001, 0, 1], [0, 0, 0, 1],
      ]},
      { name: 'Head', keyframes: [
        [0, 0, 0, 1], [0.005, 0, 0.01, 1], [0, 0, 0, 1], [-0.005, 0, -0.01, 1], [0, 0, 0, 1],
      ]},
    ];

    const tracks: QuaternionKeyframeTrack[] = [];
    for (const ba of boneAnims) {
      const t = this.boneQTrack(root, ba.name, times, ba.keyframes);
      if (t) tracks.push(t);
    }
    return new AnimationClip('idle', dur, tracks);
  }

  /** Walk cycle: alternating legs, arm swing, hip sway, vertical bounce */
  private createWalkClip(root: Object3D): AnimationClip {
    const step = 0.5;
    const dur = step * 2;
    const times = [0, dur / 4, dur / 2, (3 * dur) / 4, dur];

    // Helper: euler angles → quaternion [x, y, z, w]
    function euler(x: number, y: number, z: number): [number, number, number, number] {
      const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
      const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
      const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
      return [
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz,
      ];
    }

    interface BoneAnim { name: string; keyframes: [number, number, number, number][]; }
    const boneAnims: BoneAnim[] = [
      // Hips — slight rotation and bounce
      { name: 'Hips', keyframes: [
        euler(0.02, 0, 0.04), euler(0.04, 0, 0), euler(0.02, 0, -0.04), euler(0.04, 0, 0), euler(0.02, 0, 0.04),
      ]},
      // Spine — compensating twist
      { name: 'Spine', keyframes: [
        euler(0, 0, -0.02), euler(0.01, 0, 0), euler(0, 0, 0.02), euler(0.01, 0, 0), euler(0, 0, -0.02),
      ]},
      { name: 'Spine1', keyframes: [
        euler(-0.01, 0, -0.015), euler(0, 0, 0), euler(-0.01, 0, 0.015), euler(0, 0, 0), euler(-0.01, 0, -0.015),
      ]},
      // Right leg — forward in first half, back in second
      { name: 'RightUpLeg', keyframes: [
        euler(-0.15, 0, 0), euler(0.2, 0, 0), euler(0.35, 0, 0), euler(0.2, 0, 0), euler(-0.15, 0, 0),
      ]},
      { name: 'RightLeg', keyframes: [
        euler(0.05, 0, 0), euler(-0.1, 0, 0), euler(-0.2, 0, 0), euler(-0.1, 0, 0), euler(0.05, 0, 0),
      ]},
      { name: 'RightFoot', keyframes: [
        euler(0.05, 0, 0), euler(0, 0, 0), euler(-0.02, 0, 0), euler(0, 0, 0), euler(0.05, 0, 0),
      ]},
      // Left leg — opposite timing
      { name: 'LeftUpLeg', keyframes: [
        euler(0.35, 0, 0), euler(0.2, 0, 0), euler(-0.15, 0, 0), euler(0.2, 0, 0), euler(0.35, 0, 0),
      ]},
      { name: 'LeftLeg', keyframes: [
        euler(-0.2, 0, 0), euler(-0.1, 0, 0), euler(0.05, 0, 0), euler(-0.1, 0, 0), euler(-0.2, 0, 0),
      ]},
      { name: 'LeftFoot', keyframes: [
        euler(-0.02, 0, 0), euler(0, 0, 0), euler(0.05, 0, 0), euler(0, 0, 0), euler(-0.02, 0, 0),
      ]},
      // Right arm — swings opposite to legs
      { name: 'RightArm', keyframes: [
        euler(0.12, 0, 0.03), euler(-0.05, 0, 0), euler(-0.2, 0, -0.03), euler(-0.05, 0, 0), euler(0.12, 0, 0.03),
      ]},
      { name: 'RightForeArm', keyframes: [
        euler(0.03, 0, 0), euler(0, 0, 0), euler(-0.05, 0, 0), euler(0, 0, 0), euler(0.03, 0, 0),
      ]},
      // Left arm — opposite to right arm
      { name: 'LeftArm', keyframes: [
        euler(-0.2, 0, -0.03), euler(-0.05, 0, 0), euler(0.12, 0, 0.03), euler(-0.05, 0, 0), euler(-0.2, 0, -0.03),
      ]},
      { name: 'LeftForeArm', keyframes: [
        euler(-0.05, 0, 0), euler(0, 0, 0), euler(0.03, 0, 0), euler(0, 0, 0), euler(-0.05, 0, 0),
      ]},
    ];

    const tracks: QuaternionKeyframeTrack[] = [];
    for (const ba of boneAnims) {
      const t = this.boneQTrack(root, ba.name, times, ba.keyframes);
      if (t) tracks.push(t);
    }
    return new AnimationClip('walk', dur, tracks);
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

  dispose() {
    this.idleAction.stop();
    this.walkAction.stop();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
