import type { Group, MeshStandardMaterial } from 'three';

const DB_NAME = 'TheHouseAssets';
const DB_VERSION = 1;
const STORE = 'assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class AssetCache {
  private ready: Promise<IDBDatabase>;

  constructor() {
    this.ready = openDB();
  }

  async store(key: string, data: ArrayBuffer | Blob): Promise<void> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async retrieve(key: string): Promise<ArrayBuffer | Blob | null> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async exists(key: string): Promise<boolean> {
    const data = await this.retrieve(key);
    return data !== null;
  }

  async storeJSON(key: string, value: unknown): Promise<void> {
    const blob = new Blob([JSON.stringify(value)], { type: 'application/json' });
    return this.store(key, blob);
  }

  async retrieveJSON<T>(key: string): Promise<T | null> {
    const blob = await this.retrieve(key);
    if (!blob) return null;
    const text = await (blob as Blob).text();
    return JSON.parse(text) as T;
  }

  /** On first run, generate and cache procedural avatar GLBs using GLTFExporter */
  async ensureAvatars(): Promise<boolean> {
    if (await this.exists('avatars_generated')) return true;

    try {
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      const THREE = await import('three');
      const exporter = new GLTFExporter();
      const serialize = (scene: Group): Promise<ArrayBuffer> =>
        new Promise((resolve, reject) => exporter.parse(scene, (gltf: ArrayBuffer | { [key: string]: unknown }) => {
          if (gltf instanceof ArrayBuffer) resolve(gltf);
          else reject(new Error('GLTFExporter returned non-binary result'));
        }, reject, { binary: true }));

      const names = ['alex', 'jordan', 'sam'];
      for (const name of names) {
        const layers: [string, Group][] = [
          ['body', this.genBody(THREE)],
          ['dressed', this.genDressed(THREE, name === 'alex' ? '#4488cc' : name === 'jordan' ? '#cc6644' : '#44cc88')],
          ['sleepwear', this.genSleepwear(THREE)],
          ['towel', this.genTowel(THREE)],
          ['swimwear', this.genSwimwear(THREE)],
        ];
        for (const [layer, group] of layers) {
          const buf = await serialize(group);
          await this.store(`avatar:${name}:${layer}`, buf);
        }
      }

      await this.store('avatars_generated', new Blob(['1'], { type: 'text/plain' }));
      console.log('AssetCache: procedural avatars generated and cached.');
      return true;
    } catch (err) {
      console.warn('AssetCache: avatar generation skipped:', err);
      return false;
    }
  }

  async getAvatarGLB(name: string, layer: string): Promise<ArrayBuffer | null> {
    const data = await this.retrieve(`avatar:${name}:${layer}`);
    return data instanceof ArrayBuffer ? data : data ? await (data as Blob).arrayBuffer() : null;
  }

  /** Download and cache CC0 textures from a reliable source */
  async ensureTextures(): Promise<boolean> {
    if (await this.exists('textures_cached')) return true;

    const TEXTURES: Record<string, string> = {
      floor: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
      wall:  'https://threejs.org/examples/textures/brick_diffuse.jpg',
    };

    for (const [name, url] of Object.entries(TEXTURES)) {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        await this.store(`texture:${name}`, buf);
      } catch (err) {
        console.warn(`AssetCache: failed to download ${name} texture:`, err);
      }
    }

    await this.store('textures_cached', new Blob(['1'], { type: 'text/plain' }));
    return true;
  }

  // ── Procedural avatar generators (same as AvatarSystem, self-contained) ──

  private skinMat(THREE: typeof import('three'), color: string, roughness = 0.6): MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness });
  }

  private genBody(THREE: typeof import('three')): Group {
    const g = new THREE.Group();
    const skin = this.skinMat(THREE, '#f0d0b0');
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), skin);
    torso.position.y = 0.8; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), skin);
    head.position.y = 1.35; g.add(head);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5), skin);
      leg.position.set(side * 0.13, 0.35, 0); g.add(leg);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5), skin);
      arm.position.set(side * 0.38, 0.85, 0); g.add(arm);
    }
    return g;
  }

  private genDressed(THREE: typeof import('three'), color: string): Group {
    const g = new THREE.Group();
    const cloth = this.skinMat(THREE, color, 0.7);
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.35, 0.32), cloth);
    shirt.position.y = 0.9; g.add(shirt);
    const pantsMat = this.skinMat(THREE, '#4a5568', 0.8);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.35), pantsMat);
      leg.position.set(side * 0.13, 0.3, 0); g.add(leg);
    }
    return g;
  }

  private genSleepwear(THREE: typeof import('three')): Group {
    const g = new THREE.Group();
    const mat = this.skinMat(THREE, '#6b8e9b', 0.9);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.28), mat);
    top.position.y = 0.85; g.add(top);
    const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.2), mat);
    shorts.position.y = 0.45; g.add(shorts);
    return g;
  }

  private genTowel(THREE: typeof import('three')): Group {
    const g = new THREE.Group();
    const mat = this.skinMat(THREE, '#ffffff', 0.95);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.35), mat);
    wrap.position.y = 0.8; g.add(wrap);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.25), mat);
    skirt.position.y = 0.45; g.add(skirt);
    return g;
  }

  private genSwimwear(THREE: typeof import('three')): Group {
    const g = new THREE.Group();
    const mat = this.skinMat(THREE, '#334466', 0.5);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), mat);
    top.position.y = 0.92; g.add(top);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.18), mat);
    bottom.position.y = 0.52; g.add(bottom);
    return g;
  }
}
