import {
  Raycaster, Vector2, Camera, type Object3D,
} from 'three';
import { NPC } from './NPC';

export interface InteractionTarget {
  npc: NPC;
  distance: number;
}

export class InteractionSystem {
  private raycaster = new Raycaster();
  private mouse = new Vector2();
  private onClickListeners: Array<(target: InteractionTarget | null) => void> = [];

  constructor(private camera: Camera, private npcGroup: Object3D) {
    this.bind();
  }

  private bind() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    canvas.addEventListener('click', (e: MouseEvent) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      const target = this.cast();
      for (const cb of this.onClickListeners) cb(target);
    });
    canvas.addEventListener('touchend', (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      this.mouse.x = (t.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
      const target = this.cast();
      for (const cb of this.onClickListeners) cb(target);
    });
  }

  private cast(): InteractionTarget | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes: Object3D[] = [];
    this.npcGroup.traverse((child) => meshes.push(child));
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      let obj: Object3D | null = hits[0].object;
      while (obj) {
        const npcRef = obj.userData._npc as NPC | undefined;
        if (npcRef) {
          return { npc: npcRef, distance: hits[0].distance };
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  onClick(cb: (target: InteractionTarget | null) => void) {
    this.onClickListeners.push(cb);
  }

  tick() {
    this.mouse.x = (window.innerWidth / 2) / window.innerWidth * 2 - 1;
    this.mouse.y = -(window.innerHeight / 2) / window.innerHeight * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const target = this.cast();
    return target;
  }
}
