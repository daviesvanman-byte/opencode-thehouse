import {
  Group, type Object3D,
  Mesh, MeshStandardMaterial, BoxGeometry, CylinderGeometry, SphereGeometry,
  AnimationMixer, AnimationClip, type AnimationAction,
  LoopRepeat,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { type ClothingState } from './ClothingState';
import { generateSkinTexture, generateClothTexture } from './ProceduralTexture';

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(draco);

const avatarCache = new Map<string, GLTF>();

export interface AvatarLayers {
  body: Group | null;
  dressed: Group | null;
  sleepwear: Group | null;
  towel: Group | null;
  swimwear: Group | null;
}

export class AvatarSystem {
  private mixers: Map<symbol, AnimationMixer> = new Map();
  private avatarIds: Map<symbol, AvatarLayers> = new Map();
  private activeClothing: Map<symbol, ClothingState> = new Map();
  private groupCache = new Map<string, Group>();

  async loadAvatar(id: symbol, basePath: string, npcColor?: string, variant = 0): Promise<AvatarLayers> {
    const layers: AvatarLayers = { body: null, dressed: null, sleepwear: null, towel: null, swimwear: null };

    try {
      const gltf = await this.loadGLTF(`${basePath}/body.glb`);
      layers.body = gltf.scene.clone(true) as Group;
    } catch {
      layers.body = this.genBody(npcColor ?? '#888888', variant);
    }

    const layerGens: Record<string, (c: string, v: number) => Group> = {
      dressed: this.genDressed.bind(this),
      sleepwear: this.genSleepwear.bind(this),
      towel: this.genTowel.bind(this),
      swimwear: this.genSwimwear.bind(this),
    };
    for (const layer of ['dressed', 'sleepwear', 'towel', 'swimwear'] as const) {
      try {
        const gltf = await this.loadGLTF(`${basePath}/${layer}.glb`);
        layers[layer] = gltf.scene.clone(true) as Group;
      } catch {
        layers[layer] = layerGens[layer](npcColor ?? '#888888', variant);
      }
    }

    this.avatarIds.set(id, layers);
    this.activeClothing.set(id, 'dressed');
    return layers;
  }

  async loadGLTF(path: string): Promise<GLTF> {
    if (avatarCache.has(path)) return avatarCache.get(path)!;
    const gltf = await gltfLoader.loadAsync(path);
    avatarCache.set(path, gltf);
    return gltf;
  }

  getAvatarGroup(id: symbol, npcRef?: unknown): Group | null {
    const layers = this.avatarIds.get(id);
    if (!layers) return null;
    const state = this.activeClothing.get(id) ?? 'dressed';

    const cacheKey = `${String(id)}:${state}`;
    const cached = this.groupCache.get(cacheKey);
    if (cached) return cached;

    const cloneWithRef = (src: Object3D): Group => {
      const cloned = src.clone(true);
      cloned.traverse(child => { if (npcRef) child.userData._npc = npcRef; });
      return cloned as Group;
    };

    let result: Group | null = null;

    if (state === 'nude' || state === 'changing') {
      result = layers.body ? cloneWithRef(layers.body) : null;
    } else if (state === 'towel' && layers.towel) {
      result = cloneWithRef(layers.towel);
    } else if (state === 'sleepwear' && layers.sleepwear) {
      result = cloneWithRef(layers.sleepwear);
    } else if (state === 'swimwear' && layers.swimwear) {
      result = cloneWithRef(layers.swimwear);
    } else if (layers.body && layers.dressed) {
      const group = new Group();
      [layers.body, layers.dressed].forEach(src => {
        const c = src.clone(true);
        c.traverse(child => { if (npcRef) child.userData._npc = npcRef; });
        group.add(c);
      });
      result = group;
    } else {
      result = layers.dressed ? cloneWithRef(layers.dressed) : layers.body ? cloneWithRef(layers.body) : null;
    }

    if (result) this.groupCache.set(cacheKey, result);
    return result;
  }

  invalidateCache(id: symbol) {
    for (const [key] of this.groupCache) {
      if (key.startsWith(String(id))) this.groupCache.delete(key);
    }
  }

  setClothing(id: symbol, state: ClothingState) {
    this.activeClothing.set(id, state);
    this.invalidateCache(id);
  }

  getClothing(id: symbol): ClothingState {
    return this.activeClothing.get(id) ?? 'dressed';
  }

  private textureCache = new Map<string, ReturnType<typeof generateSkinTexture>>();

  private skinMat(variant: number, color = '#f0d0b0') {
    const key = `${color}:${variant}`;
    if (!this.textureCache.has(key)) {
      this.textureCache.set(key, generateSkinTexture(512, 512, color, variant));
    }
    const { map, normalMap } = this.textureCache.get(key)!;
    return new MeshStandardMaterial({ map, normalMap, roughness: 0.3, metalness: 0 });
  }

  private clothMat(color: string, roughness = 0.6) {
    return new MeshStandardMaterial({ map: generateClothTexture(256, 256, color), roughness, metalness: 0.05 });
  }

  genBody(_color: string, variant = 0): Group {
    const g = new Group();
    const rng = mulberry32(variant);
    const heightMod = 0.85 + rng() * 0.3;
    const widthMod = 0.9 + rng() * 0.2;
    const isMale = variant % 2 === 0;
    const skinTone = isMale ? `rgb(${220 + Math.floor(rng() * 30)},${190 + Math.floor(rng() * 30)},${165 + Math.floor(rng() * 25)})`
      : `rgb(${235 + Math.floor(rng() * 20)},${205 + Math.floor(rng() * 25)},${180 + Math.floor(rng() * 20)})`;
    const skin = this.skinMat(variant, skinTone);
    const seg = 20; // high segment count for smoothness

    // Torso — tapered cylinder, higher resolution
    const torsoTopR = 0.22 * widthMod;
    const torsoBotR = 0.19 * widthMod;
    const torsoH = 0.55 * heightMod;
    const torso = new Mesh(new CylinderGeometry(torsoTopR, torsoBotR, torsoH, seg, seg), skin);
    torso.position.y = 0.78 * heightMod;
    torso.castShadow = true;
    g.add(torso);

    // Shoulders — larger, smoother spheres
    for (const side of [-1, 1]) {
      const shoulder = new Mesh(new SphereGeometry(0.10 * widthMod, seg, seg), skin);
      shoulder.position.set(side * 0.26 * widthMod, 1.02 * heightMod, 0);
      shoulder.scale.set(1, 0.8, 0.9);
      g.add(shoulder);
    }

    // Chest pecs (for males — subtle bulge)
    if (isMale) {
      const chestMat = this.skinMat(variant, skinTone);
      for (const side of [-1, 1]) {
        const pec = new Mesh(new SphereGeometry(0.07 * widthMod, 12, 12), chestMat);
        pec.position.set(side * 0.10 * widthMod, 0.95 * heightMod, 0.15 * widthMod);
        pec.scale.set(1, 0.7, 0.5);
        g.add(pec);
      }
    } else {
      // Breasts for females
      const bustMat = this.skinMat(variant, skinTone);
      for (const side of [-1, 1]) {
        const breast = new Mesh(new SphereGeometry(0.08 * widthMod, 14, 14), bustMat);
        breast.position.set(side * 0.09 * widthMod, 0.90 * heightMod, 0.14 * widthMod);
        breast.scale.set(1, 0.75, 0.6);
        g.add(breast);
      }
    }

    // Head — smooth sphere with subtle oval
    const headR = 0.16 * widthMod;
    const head = new Mesh(new SphereGeometry(headR, seg, seg), skin);
    head.position.y = 1.22 * heightMod;
    head.scale.y = 1.08;
    head.castShadow = true;
    g.add(head);

    // Ears
    const earMat = this.skinMat(variant, skinTone);
    for (const side of [-1, 1]) {
      const ear = new Mesh(new SphereGeometry(0.025, 8, 8), earMat);
      ear.position.set(side * 0.16 * widthMod, 1.2 * heightMod, 0);
      ear.scale.set(0.4, 0.7, 0.2);
      g.add(ear);
    }

    // Eyes — more detailed
    const eyeWhite = new MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.05, metalness: 0 });
    const eyePupil = new MeshStandardMaterial({ color: isMale ? 0x443322 : 0x334455, roughness: 0.1 });
    const irisMat = new MeshStandardMaterial({ color: isMale ? 0x886644 : 0x667788, roughness: 0.3 });
    for (const side of [-1, 1]) {
      const white = new Mesh(new SphereGeometry(0.035, 12, 12), eyeWhite);
      white.position.set(side * 0.07 * widthMod, 1.27 * heightMod, 0.16 * widthMod);
      g.add(white);
      const iris = new Mesh(new SphereGeometry(0.022, 10, 10), irisMat);
      iris.position.set(side * 0.07 * widthMod, 1.27 * heightMod, 0.175 * widthMod);
      iris.scale.z = 0.5;
      g.add(iris);
      const pupil = new Mesh(new SphereGeometry(0.012, 8, 8), eyePupil);
      pupil.position.set(side * 0.07 * widthMod, 1.27 * heightMod, 0.185 * widthMod);
      pupil.scale.z = 0.3;
      g.add(pupil);
    }

    // Eyebrows
    const browMat = new MeshStandardMaterial({ color: isMale ? 0x3a2a1a : 0x4a3a2a, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const brow = new Mesh(new BoxGeometry(0.045, 0.008, 0.015), browMat);
      brow.position.set(side * 0.06 * widthMod, 1.32 * heightMod, 0.18 * widthMod);
      brow.rotation.x = -0.15;
      g.add(brow);
    }

    // Mouth — more detailed
    const lipMat = new MeshStandardMaterial({ color: isMale ? 0x995555 : 0xcc6666, roughness: 0.4 });
    const upperLip = new Mesh(new BoxGeometry(0.06, 0.012, 0.02), lipMat);
    upperLip.position.set(0, 1.12 * heightMod, 0.165 * widthMod);
    g.add(upperLip);
    const lowerLip = new Mesh(new BoxGeometry(0.055, 0.01, 0.018), lipMat);
    lowerLip.position.set(0, 1.105 * heightMod, 0.165 * widthMod);
    g.add(lowerLip);

    // Nose — more defined
    const nose = new Mesh(new SphereGeometry(0.022, 10, 10), skin);
    nose.position.set(0, 1.2 * heightMod, 0.18 * widthMod);
    nose.scale.set(1, 0.65, 0.8);
    g.add(nose);
    // Nostrils
    const nostrilMat = new MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const nostril = new Mesh(new SphereGeometry(0.006, 6, 6), nostrilMat);
      nostril.position.set(side * 0.015 * widthMod, 1.175 * heightMod, 0.19 * widthMod);
      g.add(nostril);
    }

    // Neck — smoother
    const neck = new Mesh(new CylinderGeometry(0.07, 0.08, 0.08, seg), skin);
    neck.position.y = 1.0 * heightMod;
    g.add(neck);

    // Legs — smoother with more detail
    for (const side of [-1, 1]) {
      const legTopR = 0.09 * widthMod;
      const legBotR = 0.055 * widthMod;
      const legH = 0.45 * heightMod;
      const leg = new Mesh(new CylinderGeometry(legTopR, legBotR, legH, seg, seg), skin);
      leg.position.set(side * 0.13 * widthMod, 0.32 * heightMod, 0);
      leg.castShadow = true;
      g.add(leg);
      // Feet — more detailed
      const foot = new Mesh(new BoxGeometry(0.08, 0.04, 0.14, 2, 1, 2), skin);
      foot.position.set(side * 0.13 * widthMod, 0.04, 0.04);
      g.add(foot);
      // Toes
      for (const ts of [-1, 0, 1]) {
        const toe = new Mesh(new SphereGeometry(0.012, 4, 4), skin);
        toe.position.set(side * 0.13 * widthMod + ts * 0.02, 0.02, 0.10);
        toe.scale.set(1, 0.5, 0.7);
        g.add(toe);
      }
    }

    // Arms — smoother
    for (const side of [-1, 1]) {
      const armTopR = 0.05 * widthMod;
      const armBotR = 0.035 * widthMod;
      const armH = 0.45 * heightMod;
      const arm = new Mesh(new CylinderGeometry(armTopR, armBotR, armH, seg, seg), skin);
      arm.position.set(side * 0.30 * widthMod, 0.8 * heightMod, 0);
      arm.castShadow = true;
      g.add(arm);
      // Hands — more detailed
      const hand = new Mesh(new SphereGeometry(0.03, 10, 10), skin);
      hand.position.set(side * 0.30 * widthMod, 0.55 * heightMod, 0);
      hand.scale.set(1, 0.55, 0.75);
      g.add(hand);
      // Fingers
      for (let fi = 0; fi < 4; fi++) {
        const finger = new Mesh(new CylinderGeometry(0.006, 0.008, 0.025, 4), skin);
        finger.position.set(side * 0.30 * widthMod + (fi - 1.5) * 0.01, 0.535 * heightMod, 0.015);
        finger.rotation.x = 0.3;
        g.add(finger);
      }
    }

    return g;
  }

  genDressed(color: string, _variant = 0): Group {
    const g = new Group();
    const cloth = this.clothMat(color, 0.7);
    const pantsMat = this.clothMat('#4a5568', 0.8);

    // Shirt — slightly more fitted
    const shirt = new Mesh(new CylinderGeometry(0.28, 0.24, 0.32, 8), cloth);
    shirt.position.y = 0.85;
    shirt.castShadow = true;
    g.add(shirt);

    // Collar
    const collarMat = this.clothMat(color, 0.6);
    const collar = new Mesh(new BoxGeometry(0.08, 0.03, 0.04), collarMat);
    collar.position.set(0, 1.0, 0.06);
    g.add(collar);

    // Pants
    for (const side of [-1, 1]) {
      const leg = new Mesh(new CylinderGeometry(0.09, 0.08, 0.32, 8), pantsMat);
      leg.position.set(side * 0.12, 0.28, 0);
      leg.castShadow = true;
      g.add(leg);
    }

    // Belt
    const beltMat = this.clothMat('#3a3a3a', 0.9);
    const belt = new Mesh(new CylinderGeometry(0.24, 0.24, 0.02, 8), beltMat);
    belt.position.y = 0.5;
    g.add(belt);

    // Shoes
    const shoeMat = new MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.1 });
    for (const side of [-1, 1]) {
      const shoe = new Mesh(new BoxGeometry(0.08, 0.04, 0.12), shoeMat);
      shoe.position.set(side * 0.12, 0.04, 0.04);
      g.add(shoe);
    }

    return g;
  }

  genSleepwear(_color: string, _variant = 0): Group {
    const g = new Group();
    const mat = this.clothMat('#6b8e9b', 0.9);

    // Tank top
    const top = new Mesh(new CylinderGeometry(0.24, 0.22, 0.28, 8), mat);
    top.position.y = 0.82;
    top.castShadow = true;
    g.add(top);

    // Shorts
    const shorts = new Mesh(new BoxGeometry(0.28, 0.14, 0.2), mat);
    shorts.position.y = 0.42;
    shorts.castShadow = true;
    g.add(shorts);

    // Slippers
    const slipperMat = this.clothMat('#8a7a6a', 0.8);
    for (const side of [-1, 1]) {
      const slipper = new Mesh(new BoxGeometry(0.08, 0.02, 0.1), slipperMat);
      slipper.position.set(side * 0.12, 0.02, 0.04);
      g.add(slipper);
    }

    return g;
  }

  genTowel(_color: string, _variant = 0): Group {
    const g = new Group();
    const mat = this.clothMat('#ffffff', 0.95);

    // Chest wrap — angled cylinder
    const wrap = new Mesh(new CylinderGeometry(0.26, 0.28, 0.32, 8), mat);
    wrap.position.y = 0.78;
    wrap.castShadow = true;
    g.add(wrap);

    // Hip wrap
    const skirt = new Mesh(new CylinderGeometry(0.27, 0.32, 0.2, 8), mat);
    skirt.position.y = 0.45;
    skirt.castShadow = true;
    g.add(skirt);

    // Towel fold detail
    const fold = new Mesh(new BoxGeometry(0.02, 0.15, 0.2), this.clothMat('#e8e8e8', 0.95));
    fold.position.set(0.25, 0.6, 0);
    g.add(fold);

    return g;
  }

  genSwimwear(_color: string, _variant = 0): Group {
    const g = new Group();
    const mat = this.clothMat('#334466', 0.5);

    // Top
    const top = new Mesh(new BoxGeometry(0.18, 0.06, 0.18), mat);
    top.position.y = 0.88;
    top.castShadow = true;
    g.add(top);

    // Bottom
    const bottom = new Mesh(new BoxGeometry(0.18, 0.06, 0.16), mat);
    bottom.position.y = 0.50;
    bottom.castShadow = true;
    g.add(bottom);

    // Sandals
    const sandalMat = new MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const sandal = new Mesh(new BoxGeometry(0.07, 0.02, 0.1), sandalMat);
      sandal.position.set(side * 0.12, 0.02, 0.04);
      g.add(sandal);
    }

    return g;
  }

  createMixer(id: symbol, root: Object3D): AnimationMixer | null {
    const mixer = new AnimationMixer(root);
    this.mixers.set(id, mixer);
    return mixer;
  }

  playAnimation(id: symbol, clip: AnimationClip, root: Object3D): AnimationAction | null {
    let mixer = this.mixers.get(id);
    if (!mixer) {
      mixer = new AnimationMixer(root);
      this.mixers.set(id, mixer);
    }
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity);
    action.play();
    return action;
  }

  updateMixers(dt: number) {
    for (const mixer of this.mixers.values()) {
      mixer.update(dt);
    }
  }

  dispose() {
    avatarCache.clear();
    this.mixers.clear();
    this.avatarIds.clear();
    this.activeClothing.clear();
    this.groupCache.clear();
  }
}

function mulberry32(a: number): () => number {
  return () => { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
