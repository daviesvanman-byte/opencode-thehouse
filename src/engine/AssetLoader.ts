import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Mesh, type Object3D } from 'three';

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(draco);

const cache = new Map<string, GLTF>();

export async function loadGLTF(path: string): Promise<GLTF> {
  if (cache.has(path)) return cache.get(path)!;
  const gltf = await gltfLoader.loadAsync(path);
  cache.set(path, gltf);
  return gltf;
}

export function cloneModel(gltf: GLTF): Object3D {
  return gltf.scene.clone(true);
}

export function disposeGLTF(path: string) {
  const gltf = cache.get(path);
  if (gltf) {
    gltf.scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    cache.delete(path);
  }
}
