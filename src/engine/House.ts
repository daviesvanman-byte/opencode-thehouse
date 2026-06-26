import {
  Group, Mesh, MeshStandardMaterial, BoxGeometry,
  PlaneGeometry, DoubleSide, CylinderGeometry, SphereGeometry,
  Object3D,
} from 'three';
import { type PhysicsWorld } from './Physics';
import { generatePlasterTexture, generateTileTexture, generateWoodTexture, generateGrassTexture, generateFabricTexture, generateMarbleTexture, generateTerracottaTexture, generateCheckerboardTexture, generateNormalMapFromCanvas } from './ProceduralTexture';
import { loadGLTF } from './AssetLoader';

export interface RoomDef {
  name: string;
  x: number; z: number;
  w: number; d: number;
  color: number;
}

const ROOMS: RoomDef[] = [
  { name: 'Living Room',  x: 0,  z: 0,   w: 7,  d: 5.5, color: 0x5a6a7a },
  { name: 'Kitchen',      x: 0,  z: 4,   w: 5,  d: 3,   color: 0x6a5a4a },
  { name: 'Dining Room',  x: -3, z: 4,   w: 3,  d: 3,   color: 0x6a4a3a },
  { name: 'Bedroom 1',    x: 4,  z: -2,  w: 3.5,d: 3.5, color: 0x4a5a6a },
  { name: 'Bedroom 2',    x: -4, z: -2,  w: 3.5,d: 3.5, color: 0x6a4a5a },
  { name: 'Bedroom 3',    x: 4,  z: 2,   w: 3,  d: 3,   color: 0x4a4a5a },
  { name: 'Bathroom',     x: -4, z: 2,   w: 2.5,d: 2.5, color: 0x5a6a6a },
  { name: 'Diary Room',   x: 0,  z: -3.5,w: 2.5,d: 2,   color: 0x3a3a4a },
  { name: 'Store Room',   x: -3.5,z: -3,w: 2,  d: 2,   color: 0x4a4a4a },
  { name: 'Garden',       x: 0,  z: -5.5,w: 8,  d: 3,   color: 0x2a5a2a },
];

const WALL_H = 2.8;
const WALL_T = 0.12;

export class House extends Group {
  rooms: RoomDef[] = ROOMS;
  private textureCache = new Map<string, MeshStandardMaterial>();

  private plasterMat(color = '#7a7a7a', res = 1024): MeshStandardMaterial {
    const key = `plaster:${color}:${res}`;
    if (!this.textureCache.has(key)) {
      const map = generatePlasterTexture(res, res, color);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 1.5);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 0.75, metalness: 0 }));
    }
    return this.textureCache.get(key)!;
  }

  private tileMat(color = '#5a5a5a', tileSize = 32, res = 1024): MeshStandardMaterial {
    const key = `tile:${color}:${tileSize}:${res}`;
    if (!this.textureCache.has(key)) {
      const map = generateTileTexture(res, res, color, tileSize);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 2.0);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 0.6, metalness: 0.05 }));
    }
    return this.textureCache.get(key)!;
  }

  private woodMat(color = '#8a7a6a', res = 1024): MeshStandardMaterial {
    const key = `wood:${color}:${res}`;
    if (!this.textureCache.has(key)) {
      const map = generateWoodTexture(res, res, color);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 2.5);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 0.4, metalness: 0.05 }));
    }
    return this.textureCache.get(key)!;
  }

  private grassMat(): MeshStandardMaterial {
    const key = 'grass';
    if (!this.textureCache.has(key)) {
      const map = generateGrassTexture(1024, 1024);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 1.0);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 1, metalness: 0 }));
    }
    return this.textureCache.get(key)!;
  }

  private fabricMat(color = '#5a6a7a', res = 512): MeshStandardMaterial {
    const key = `fabric:${color}:${res}`;
    if (!this.textureCache.has(key)) {
      const map = generateFabricTexture(res, res, color);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 1.5);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 0.85, metalness: 0 }));
    }
    return this.textureCache.get(key)!;
  }

  private marbleMat(color = '#c8c8c8', res = 1024): MeshStandardMaterial {
    const key = `marble:${color}:${res}`;
    if (!this.textureCache.has(key)) {
      const map = generateMarbleTexture(res, res, color);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 4.0);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 0.15, metalness: 0.1 }));
    }
    return this.textureCache.get(key)!;
  }

  private terracottaMat(): MeshStandardMaterial {
    const key = 'terracotta';
    if (!this.textureCache.has(key)) {
      const map = generateTerracottaTexture(1024, 1024);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 2.0);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 0.7, metalness: 0 }));
    }
    return this.textureCache.get(key)!;
  }

  private checkerboardMat(color1 = '#e8d0d8', color2 = '#d0b0c0', tileSize = 32, res = 1024): MeshStandardMaterial {
    const key = `checker:${color1}:${color2}:${tileSize}:${res}`;
    if (!this.textureCache.has(key)) {
      const map = generateCheckerboardTexture(res, res, color1, color2, tileSize);
      const normalMap = generateNormalMapFromCanvas(map.image as HTMLCanvasElement, 3.0);
      this.textureCache.set(key, new MeshStandardMaterial({ map, normalMap, roughness: 0.5, metalness: 0.05 }));
    }
    return this.textureCache.get(key)!;
  }

  constructor(private physics?: PhysicsWorld) {
    super();
    this.build();
  }

  private build() {
    this.buildFloor();
    this.buildWalls();
    this.buildBaseboards();
    this.buildFurniture();
    this.buildCeiling();
    this.buildGardenDetails();
    this.buildWallArt();
    this.buildEyeballDecor();
  }

  private buildEyeballDecor() {
    // Scatter eyeball ornaments on shelves and surfaces throughout the house — BB 2025 signature
    const spots: { room: string; dx: number; dz: number; y: number; s: number }[] = [
      { room: 'Living Room', dx: 1.2, dz: -1.2, y: 0.8, s: 0.05 },
      { room: 'Living Room', dx: -1.8, dz: 1.0, y: 0.85, s: 0.06 },
      { room: 'Kitchen', dx: -1.2, dz: 0.5, y: 0.75, s: 0.05 },
      { room: 'Dining Room', dx: 0.3, dz: 0.3, y: 0.75, s: 0.07 },
      { room: 'Bedroom 1', dx: 1.2, dz: 0.8, y: 0.8, s: 0.05 },
      { room: 'Bedroom 2', dx: 1.2, dz: -0.4, y: 0.8, s: 0.05 },
      { room: 'Bedroom 3', dx: -1.0, dz: 0.5, y: 0.8, s: 0.05 },
      { room: 'Bathroom', dx: 0.3, dz: -0.3, y: 0.75, s: 0.05 },
      { room: 'Diary Room', dx: 0.4, dz: -0.3, y: 0.8, s: 0.06 },
      { room: 'Store Room', dx: 0.3, dz: 0.3, y: 0.9, s: 0.05 },
    ];
    for (const spot of spots) {
      const room = ROOMS.find(r => r.name === spot.room);
      if (!room) continue;
      this.addEyeball(room.x + spot.dx, spot.y, room.z + spot.dz, spot.s, Math.random() * Math.PI * 2);
    }
  }

  private buildFloor() {
    const geo = new PlaneGeometry(20, 20);
    const mat = new MeshStandardMaterial({ map: generateTileTexture(512, 512, '#4a4a4a', 48), roughness: 0.9, metalness: 0 });
    const floor = new Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    this.add(floor);
    if (this.physics) this.physics.addBox([0, -0.5, 0], [20, 1, 20], true);
  }

  private buildRoomWalls(room: RoomDef) {
    const { x, z, w, d } = room;
    const cx = x, cz = z, hw = w / 2, hd = d / 2;

    const walls: { w: number; px: number; pz: number; ry: number }[] = [
      { w, px: cx, pz: cz + hd + WALL_T / 2, ry: 0 },
      { w, px: cx, pz: cz - hd - WALL_T / 2, ry: 0 },
      { w: d, px: cx + hw + WALL_T / 2, pz: cz, ry: Math.PI / 2 },
      { w: d, px: cx - hw - WALL_T / 2, pz: cz, ry: Math.PI / 2 },
    ];

    // Distinct wall color per room — BB 2025 saturated maximalist palette
    const wallColors: Record<string, string> = {
      'Living Room': '#d4a0b0',
      'Kitchen': '#c89050',
      'Dining Room': '#c8a840',
      'Bedroom 1': '#70a8a8',
      'Bedroom 2': '#506090',
      'Bedroom 3': '#508888',
      'Bathroom': '#c8b040',
      'Diary Room': '#2a2040',
      'Store Room': '#707070',
    };
    const wallMat = this.plasterMat(wallColors[room.name] || '#b8a898', 512);
    const wallDoorPositions = this.getDoorPositions(room);
    for (const wall of walls) {
      const m = new Mesh(new BoxGeometry(wall.w, WALL_H, WALL_T), wallMat);
      m.position.set(wall.px, WALL_H / 2, wall.pz);
      m.rotation.y = wall.ry;
      m.castShadow = true; m.receiveShadow = true;
      this.add(m);

      // Physics collision for this wall (skip Garden — handles its own fence collision)
      if (this.physics && room.name !== 'Garden') {
        const isHoriz = wall.ry === 0;
        const doorGap = 1.0;
        const doorsOnWall = wallDoorPositions.filter(dp => {
          if (isHoriz) return Math.abs(dp.z - wall.pz) < 0.2;
          return Math.abs(dp.x - wall.px) < 0.2;
        });
        if (doorsOnWall.length === 0) {
          this.physics.addBox([wall.px, 1.4, wall.pz], [wall.w, WALL_H, WALL_T], true);
        } else {
          const gapStart = doorsOnWall[0];
          const gp = isHoriz ? gapStart.x : gapStart.z;
          const segStart = isHoriz ? wall.px - wall.w / 2 : wall.pz - wall.w / 2;
          const segEnd = isHoriz ? wall.px + wall.w / 2 : wall.pz + wall.w / 2;
          // Left segment
          const leftLen = gp - doorGap / 2 - segStart;
          if (leftLen > 0.3) {
            const lcx = isHoriz ? segStart + leftLen / 2 : wall.px;
            const lcz = isHoriz ? wall.pz : segStart + leftLen / 2;
            const lw = isHoriz ? leftLen : WALL_T;
            const ld = isHoriz ? WALL_T : leftLen;
            this.physics.addBox([lcx, 1.4, lcz], [lw, WALL_H, ld], true);
          }
          // Right segment
          const rightStart = gp + doorGap / 2;
          const rightLen = segEnd - rightStart;
          if (rightLen > 0.3) {
            const rcx = isHoriz ? rightStart + rightLen / 2 : wall.px;
            const rcz = isHoriz ? wall.pz : rightStart + rightLen / 2;
            const rw = isHoriz ? rightLen : WALL_T;
            const rd = isHoriz ? WALL_T : rightLen;
            this.physics.addBox([rcx, 1.4, rcz], [rw, WALL_H, rd], true);
          }
        }
      }
    }

    // Distinct floor material per room — BB 2025 inspired
    let floorMat: MeshStandardMaterial;
    interface FloorCfg { type: 'tile' | 'wood' | 'marble' | 'fabric' | 'checkerboard'; color?: string; color1?: string; color2?: string; }
    const floorConfig: Record<string, FloorCfg> = {
      'Living Room': { type: 'checkerboard', color1: '#f0d8e0', color2: '#d0b0c0' },
      'Kitchen': { type: 'tile', color: '#b08050' },
      'Dining Room': { type: 'marble', color: '#d4a898' },
      'Bedroom 1': { type: 'fabric', color: '#4a7a7a' },
      'Bedroom 2': { type: 'fabric', color: '#3a4a6a' },
      'Bedroom 3': { type: 'fabric', color: '#3a5a5a' },
      'Bathroom': { type: 'checkerboard', color1: '#c8c040', color2: '#80a060' },
      'Diary Room': { type: 'wood', color: '#3a2a1a' },
      'Store Room': { type: 'tile', color: '#3a3a3a' },
    };
    if (room.name === 'Garden') {
      return;
    }
    const fc = floorConfig[room.name] || { type: 'tile', color: '#7a7a7a' };
    switch (fc.type) {
      case 'checkerboard': floorMat = this.checkerboardMat(fc.color1, fc.color2, 32, 512); break;
      case 'wood': floorMat = this.woodMat(fc.color!, 512); break;
      case 'marble': floorMat = this.marbleMat(fc.color!, 512); break;
      case 'fabric': floorMat = this.fabricMat(fc.color!, 512); break;
      default: floorMat = this.tileMat(fc.color!, 32, 512); break;
    }

    const floor = new Mesh(new PlaneGeometry(w - 0.3, d - 0.3), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0.01, cz);
    floor.receiveShadow = true;
    this.add(floor);

    // Door frame indicators (small vertical strips at wall openings)
    const frameMat = this.woodMat('#6a5a4a');
    const doorPositions = this.getDoorPositions(room);
    for (const dp of doorPositions) {
      const frame = new Mesh(new BoxGeometry(0.06, WALL_H * 0.7, 0.06), frameMat);
      frame.position.set(dp.x, WALL_H * 0.35, dp.z);
      frame.castShadow = true;
      this.add(frame);
    }

    // Door meshes — brown to contrast with walls
    const doorMat = new MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7, metalness: 0 });
    for (const dp of doorPositions) {
      const door = new Mesh(new BoxGeometry(0.7, 2.0, 0.04), doorMat);
      door.position.set(dp.x, 1.0, dp.z);
      door.castShadow = true;
      this.add(door);
      // Door handle
      const handleMat = new MeshStandardMaterial({ color: 0xccaa88, roughness: 0.3, metalness: 0.4 });
      const handle = new Mesh(new BoxGeometry(0.02, 0.04, 0.02), handleMat);
      handle.position.set(dp.x + 0.3, 0.9, dp.z);
      this.add(handle);
    }
  }

  private getDoorPositions(room: RoomDef): { x: number; z: number }[] {
    // Place door frames on shared walls between adjacent rooms
    // Handles rooms that slightly overlap on the shared boundary
    const positions: { x: number; z: number }[] = [];
    const { x, z, w, d } = room;
    const hw = w / 2, hd = d / 2;
    const rMinX = x - hw, rMaxX = x + hw;
    const rMinZ = z - hd, rMaxZ = z + hd;
    for (const other of ROOMS) {
      if (other === room) continue;
      const ohw = other.w / 2, ohd = other.d / 2;
      const oMinX = other.x - ohw, oMaxX = other.x + ohw;
      const oMinZ = other.z - ohd, oMaxZ = other.z + ohd;
      const xOverlap = Math.max(0, Math.min(rMaxX, oMaxX) - Math.max(rMinX, oMinX));
      const zOverlap = Math.max(0, Math.min(rMaxZ, oMaxZ) - Math.max(rMinZ, oMinZ));
      const xGap = Math.max(rMinX - oMaxX, oMinX - rMaxX);
      const zGap = Math.max(rMinZ - oMaxZ, oMinZ - rMaxZ);
      // Adjacent on Z axis: overlap on X, gap is small/negative on Z
      if (xOverlap > 0.5 && zGap < 0.5 && zGap > -1.0) {
        const dir = z < other.z ? 1 : -1;
        positions.push({ x, z: z + dir * hd });
      }
      // Adjacent on X axis: overlap on Z, gap is small/negative on X
      if (zOverlap > 0.5 && xGap < 0.5 && xGap > -1.0) {
        const dir = x < other.x ? 1 : -1;
        positions.push({ x: x + dir * hw, z });
      }
    }
    return positions.slice(0, 2);
  }

  private buildBaseboards() {
    const baseMat = this.woodMat('#5a4a3a');
    for (const room of ROOMS) {
      if (room.name === 'Garden') continue;
      const { x, z, w, d } = room;
      const hw = w / 2, hd = d / 2;
      const segments: { w: number; px: number; pz: number; ry: number }[] = [
        { w, px: x, pz: z + hd, ry: 0 },
        { w, px: x, pz: z - hd, ry: 0 },
        { w: d, px: x + hw, pz: z, ry: Math.PI / 2 },
        { w: d, px: x - hw, pz: z, ry: Math.PI / 2 },
      ];
      for (const seg of segments) {
        const bb = new Mesh(new BoxGeometry(seg.w, 0.08, 0.06), baseMat);
        bb.position.set(seg.px, 0.04, seg.pz);
        bb.rotation.y = seg.ry;
        this.add(bb);
      }
    }
  }

  private addEyeball(x: number, y: number, z: number, s = 0.08, rotY = 0) {
    const whiteMat = new MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.3, metalness: 0.05 });
    const irisMat = new MeshStandardMaterial({ color: 0x88aacc, roughness: 0.2, metalness: 0.1 });
    const pupilMat = new MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.1 });
    const g = new Group();
    const ball = new Mesh(new SphereGeometry(s, 12, 12), whiteMat);
    ball.position.x = s * 0.6;
    g.add(ball);
    const iris = new Mesh(new SphereGeometry(s * 0.5, 10, 10), irisMat);
    iris.position.x = s * 0.6 + s * 0.4;
    g.add(iris);
    const pupil = new Mesh(new SphereGeometry(s * 0.22, 8, 8), pupilMat);
    pupil.position.x = s * 0.6 + s * 0.65;
    g.add(pupil);
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.add(g);
  }

  private buildGardenDetails() {
    const garden = ROOMS.find(r => r.name === 'Garden')!;
    const rng = mulberry32(99);

    // Decking area — colourful wooden platform (yellow/orange tones)
    const deckMat = this.woodMat('#c89850', 512);
    const deck = new Mesh(new BoxGeometry(2.5, 0.06, garden.d - 0.5), deckMat);
    deck.position.set(garden.x + 0.5, 0.03, garden.z);
    deck.receiveShadow = true;
    this.add(deck);

    // Hot tub — box with cyan water surface
    const tubOuterMat = new MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.6, metalness: 0.1 });
    const tub = new Mesh(new BoxGeometry(0.8, 0.3, 0.8), tubOuterMat);
    tub.position.set(garden.x + 0.5, 0.15, garden.z + 0.4);
    tub.castShadow = true;
    this.add(tub);
    if (this.physics) this.physics.addBox([garden.x + 0.5, 0.15, garden.z + 0.4], [0.8, 0.3, 0.8], true);
    const waterMat = new MeshStandardMaterial({ color: 0x40cccc, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 });
    const water = new Mesh(new BoxGeometry(0.7, 0.02, 0.7), waterMat);
    water.position.set(garden.x + 0.5, 0.33, garden.z + 0.4);
    this.add(water);

    // Giant eye on back wall — BB is always watching
    this.addEyeball(garden.x, 1.4, garden.z + garden.d / 2 + 0.06, 0.25, 0);

    // Topiary bushes (cone + sphere forms)
    const topiaryMat = new MeshStandardMaterial({ color: 0x2a8a2a, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const tx = garden.x - 0.8 + i * 1.2;
      const tz = garden.z + garden.d / 2 - 0.3;
      const trunk = new Mesh(new CylinderGeometry(0.02, 0.03, 0.2, 6), this.woodMat('#5a4a3a'));
      trunk.position.set(tx, 0.1, tz);
      this.add(trunk);
      const sphere = new Mesh(new SphereGeometry(0.15 + rng() * 0.1, 6, 6), topiaryMat);
      sphere.position.set(tx, 0.3, tz);
      sphere.castShadow = true;
      this.add(sphere);
    }

    // Deck chairs (colourful striped)
    const chairColors = [0xe04040, 0x40a0e0, 0xe0c040];
    for (let i = 0; i < 3; i++) {
      const cx = garden.x - 1.0 + i * 0.8;
      const cz = garden.z - garden.d / 2 + 0.3;
      const seat = new Mesh(new BoxGeometry(0.3, 0.04, 0.3), new MeshStandardMaterial({ color: chairColors[i], roughness: 0.7 }));
      seat.position.set(cx, 0.04, cz);
      seat.castShadow = true;
      this.add(seat);
      const leg = new Mesh(new CylinderGeometry(0.01, 0.015, 0.15, 4), this.woodMat('#5a4a3a'));
      leg.position.set(cx, 0.08, cz);
      this.add(leg);
    }

    // Planters with colourful flowers
    const planterMat = this.terracottaMat();
    for (let i = 0; i < 3; i++) {
      const px = garden.x - 2.0 + i * 2.0;
      const pz = garden.z + garden.d / 2 - 0.4;
      const pot = new Mesh(new CylinderGeometry(0.05, 0.07, 0.1, 6), planterMat);
      pot.position.set(px, 0.05, pz);
      this.add(pot);
    }
  }

  private buildWallArt() {
    // Eyeball art pieces and graphic pattern decor — BB 2025 maximalist style
    const artFrame = this.woodMat('#5a4a3a');
    const artRooms = ['Living Room', 'Dining Room', 'Kitchen', 'Bedroom 1', 'Bedroom 2'];
    for (const name of artRooms) {
      const room = ROOMS.find(r => r.name === name);
      if (!room) continue;
      // Patterned art panel (colour-block / graphic)
      const palette = ['#e06060', '#60a0e0', '#e0c040', '#60d0a0', '#d060a0'];
      for (const side of [-1, 1]) {
        const artMat = new MeshStandardMaterial({ color: palette[Math.floor(Math.random() * palette.length)], roughness: 0.3 });
        const art = new Mesh(new BoxGeometry(0.4, 0.4, 0.02), artMat);
        art.position.set(room.x + side * (room.w / 2 - 0.5), 1.4, room.z);
        art.castShadow = true;
        this.add(art);
        const frame = new Mesh(new BoxGeometry(0.44, 0.44, 0.01), artFrame);
        frame.position.set(room.x + side * (room.w / 2 - 0.5), 1.4, room.z + 0.02);
        this.add(frame);
      }
      // Eyeball on one wall per room
      this.addEyeball(room.x + room.w / 2 - 0.6, 1.8, room.z, 0.06, 0);
    }
    // Neon hand-sconce style in corridor (near diary room)
    const corridorRoom = ROOMS.find(r => r.name === 'Store Room');
    if (corridorRoom) {
      const sconceMat = new MeshStandardMaterial({ color: 0xd0d0e0, roughness: 0.2, metalness: 0.3 });
      const glowMat = new MeshStandardMaterial({ color: 0xffaa40, emissive: 0xff8800, emissiveIntensity: 0.6 });
      for (const side of [-1, 1]) {
        const arm = new Mesh(new CylinderGeometry(0.015, 0.025, 0.12, 6), sconceMat);
        arm.position.set(corridorRoom.x + side * 0.3, 1.6, corridorRoom.z + corridorRoom.d / 2 + 0.08);
        arm.rotation.z = side * 0.4;
        this.add(arm);
        const glow = new Mesh(new SphereGeometry(0.025, 8, 8), glowMat);
        glow.position.set(corridorRoom.x + side * 0.35, 1.55, corridorRoom.z + corridorRoom.d / 2 + 0.08);
        this.add(glow);
      }
    }
  }

  private buildWalls() {
    for (const room of ROOMS) {
      if (room.name === 'Garden') continue;
      this.buildRoomWalls(room);
    }

    // Garden grass
    const garden = ROOMS.find(r => r.name === 'Garden')!;
    const gf = new Mesh(new PlaneGeometry(garden.w - 0.3, garden.d - 0.3), this.grassMat());
    gf.rotation.x = -Math.PI / 2;
    gf.position.set(garden.x, 0.02, garden.z);
    gf.receiveShadow = true;
    this.add(gf);

    // Garden fence posts
    const fenceMat = this.woodMat('#5a4a3a');
    for (let i = -3.5; i <= 3.5; i += 1.2) {
      const post = new Mesh(new CylinderGeometry(0.04, 0.05, 0.6, 6), fenceMat);
      post.position.set(i, 0.3, -7);
      post.castShadow = true;
      this.add(post);
    }
    for (let z = -6.5; z <= -4.5; z += 1.2) {
      const post = new Mesh(new CylinderGeometry(0.04, 0.05, 0.6, 6), fenceMat);
      post.position.set(-4, 0.3, z);
      post.castShadow = true;
      this.add(post);
    }
    for (let z = -6.5; z <= -4.5; z += 1.2) {
      const post = new Mesh(new CylinderGeometry(0.04, 0.05, 0.6, 6), fenceMat);
      post.position.set(4, 0.3, z);
      post.castShadow = true;
      this.add(post);
    }

    // Outer perimeter collision — full height walls
    if (this.physics) {
      this.physics.addBox([0, 1.4, -7], [9, WALL_H, 0.5], true);
      this.physics.addBox([0, 1.4, 5.8], [9, WALL_H, 0.5], true);
      this.physics.addBox([-5.2, 1.4, -1], [0.5, WALL_H, 14], true);
      this.physics.addBox([5.2, 1.4, -1], [0.5, WALL_H, 14], true);
    }
  }

  private buildCeiling() {
    // Clean white/off-white ceilings — no texture, clearly distinct from walls
    for (const room of ROOMS) {
      if (room.name === 'Garden') continue;
      const mat = new MeshStandardMaterial({
        color: '#f0ede8',
        roughness: 0.95, metalness: 0, side: DoubleSide,
      });
      const geo = new PlaneGeometry(room.w - 0.4, room.d - 0.4);
      const ceiling = new Mesh(geo, mat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(room.x, WALL_H, room.z);
      this.add(ceiling);
    }
  }

  // -- GLB furniture placements --
  private furnitureEntries: Object3D[] = [];

  async loadFurnitureAsync() {
    const placements: {
      room: string; model: string; x: number; z: number; ry?: number; s?: number;
    }[] = [
      // Living Room — XL sofa configuration (BB 2025 pink/blue bubble theme)
      { room: 'Living Room', model: 'L_Couch', x: -1.8, z: 0.5, ry: Math.PI, s: 0.75 },
      { room: 'Living Room', model: 'Couch_01', x: 1.5, z: 0.8, s: 0.65 },
      { room: 'Living Room', model: 'Sofa_01', x: 0, z: 1.5, s: 0.7 },
      { room: 'Living Room', model: 'Table_Round_Small', x: 0, z: 0, s: 0.8 },
      { room: 'Living Room', model: 'Standing_Lamp', x: -1.5, z: -1.2, s: 0.7 },
      { room: 'Living Room', model: 'Bookshelf_01', x: 1.6, z: -1.2, s: 0.65 },
      // Kitchen
      { room: 'Kitchen', model: 'Cabinet', x: 1.0, z: 1.0, s: 0.65 },
      { room: 'Kitchen', model: 'Table_01', x: 0.5, z: -0.5, s: 0.7 },
      // Dining Room — eye-shaped table area (round table with radial chairs)
      { room: 'Dining Room', model: 'Table_Round_Small', x: 0, z: 0, s: 0.85 },
      { room: 'Dining Room', model: 'Chair_01', x: 0.7, z: 0, s: 0.65 },
      { room: 'Dining Room', model: 'Chair_01', x: -0.7, z: 0, s: 0.65 },
      { room: 'Dining Room', model: 'Chair_01', x: 0, z: 0.7, ry: Math.PI / 2, s: 0.65 },
      { room: 'Dining Room', model: 'Chair_01', x: 0, z: -0.7, ry: Math.PI / 2, s: 0.65 },
      // Bedroom 1
      { room: 'Bedroom 1', model: 'Bed_01', x: 0, z: 0, s: 0.7 },
      { room: 'Bedroom 1', model: 'Night_Stand', x: 1.0, z: -0.6, s: 0.65 },
      { room: 'Bedroom 1', model: 'Drawer_01', x: 1.0, z: 0.6, s: 0.65 },
      { room: 'Bedroom 1', model: 'Standing_Lamp', x: -1.2, z: -0.5, s: 0.7 },
      // Bedroom 2
      { room: 'Bedroom 2', model: 'Bed_Double', x: 0, z: 0, s: 0.7 },
      { room: 'Bedroom 2', model: 'Drawer_02', x: 1.0, z: 0, s: 0.65 },
      { room: 'Bedroom 2', model: 'Shelf_01', x: -1.0, z: 0, s: 0.65 },
      // Bedroom 3
      { room: 'Bedroom 3', model: 'Bed_King', x: 0, z: 0, s: 0.7 },
      { room: 'Bedroom 3', model: 'Drawer_01', x: 1.0, z: 0, s: 0.65 },
      { room: 'Bedroom 3', model: 'Bookshelf_01', x: -1.0, z: 0, s: 0.65 },
      { room: 'Bedroom 3', model: 'Standing_Lamp', x: -0.8, z: 0.8, s: 0.7 },
      // Diary Room
      { room: 'Diary Room', model: 'Desk_01', x: 0, z: -0.4, s: 0.65 },
      { room: 'Diary Room', model: 'Office_Chair', x: 0, z: 0.3, s: 0.6 },
      // Store Room
      { room: 'Store Room', model: 'Bookshelf_02', x: 0.5, z: 0, s: 0.65 },
      { room: 'Store Room', model: 'Closet', x: -0.5, z: 0, s: 0.65 },
      // Garden — XL blue sofa on decking
      { room: 'Garden', model: 'L_Couch', x: 0.5, z: -0.6, ry: Math.PI, s: 0.7 },
    ];

    const roomMap = new Map(ROOMS.map(r => [r.name, r]));

    // Collision box sizes (half-extents) per furniture model name
    const collisionSizes: Record<string, [number, number, number]> = {
      'L_Couch':         [1.2, 0.4, 0.6],
      'Couch_01':        [1.0, 0.4, 0.5],
      'Sofa_01':         [0.7, 0.4, 0.5],
      'Table_Round_Small': [0.4, 0.4, 0.4],
      'Standing_Lamp':   [0.15, 0.6, 0.15],
      'Bookshelf_01':    [0.35, 0.6, 0.15],
      'Bookshelf_02':    [0.4, 0.6, 0.15],
      'Cabinet':         [0.4, 0.5, 0.3],
      'Table_01':        [0.5, 0.4, 0.5],
      'Chair_01':        [0.25, 0.35, 0.25],
      'Bed_01':          [0.6, 0.25, 0.4],
      'Night_Stand':     [0.25, 0.35, 0.25],
      'Drawer_01':       [0.35, 0.35, 0.3],
      'Drawer_02':       [0.4, 0.35, 0.3],
      'Bed_Double':      [0.7, 0.25, 0.5],
      'Bed_King':        [0.8, 0.25, 0.5],
      'Shelf_01':        [0.35, 0.5, 0.15],
      'Desk_01':         [0.4, 0.4, 0.4],
      'Office_Chair':    [0.25, 0.3, 0.25],
      'Closet':          [0.4, 0.55, 0.3],
    };

    for (const p of placements) {
      try {
        const gltf = await loadGLTF(`/models/furniture/${p.model}.glb`);
        const model = gltf.scene.clone(true);
        model.traverse(child => {
          if (child instanceof Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        const room = roomMap.get(p.room);
        if (!room) continue;
        const sx = p.s ?? 1;
        const wx = room.x + p.x;
        const wz = room.z + p.z;
        model.position.set(wx, 0, wz);
        if (p.ry) model.rotation.y = p.ry;
        model.scale.setScalar(sx);
        this.add(model);
        this.furnitureEntries.push(model);

        // Add collision box for this furniture piece
        if (this.physics) {
          const cs = collisionSizes[p.model];
          if (cs) {
            this.physics.addBox(
              [wx, cs[1] * sx, wz],
              [cs[0] * sx * 2, cs[1] * sx * 2, cs[2] * sx * 2],
              true,
            );
          }
        }
      } catch (e) {
        console.warn(`Failed to load furniture ${p.model}.glb:`, e);
      }
    }
  }

  // Keep minimal procedural furniture for rooms where no GLB is a good fit
  private buildFurniture() {
    for (const room of ROOMS) {
      switch (room.name) {
        case 'Bathroom': {
          // Hot-tub style rounded bath — BB 2025 yellow/green/orange bathroom
          const bathOuterMat = new MeshStandardMaterial({ color: 0xd0b040, roughness: 0.5, metalness: 0.1 });
          const tub = new Mesh(new CylinderGeometry(0.4, 0.5, 0.3, 16), bathOuterMat);
          tub.position.set(room.x - 0.2, 0.15, room.z);
          tub.castShadow = true;
          this.add(tub);
          if (this.physics) this.physics.addBox([room.x - 0.2, 0.15, room.z], [0.7, 0.3, 0.7], true);
          const bathInner = new Mesh(new CylinderGeometry(0.32, 0.38, 0.24, 14), new MeshStandardMaterial({ color: 0x60d0b0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 }));
          bathInner.position.set(room.x - 0.2, 0.21, room.z);
          this.add(bathInner);
          // Bold retro-style mirror (circular, colourful frame)
          const mirrorMat = new MeshStandardMaterial({ color: 0x88ccdd, roughness: 0.05, metalness: 0.4 });
          const mirror = new Mesh(new CylinderGeometry(0.15, 0.15, 0.02, 16), mirrorMat);
          mirror.position.set(room.x + 0.6, 0.6, room.z - 0.9);
          this.add(mirror);
          const mirrorFrame = new Mesh(new CylinderGeometry(0.17, 0.17, 0.025, 16), new MeshStandardMaterial({ color: 0xe06040, roughness: 0.4 }));
          mirrorFrame.position.set(room.x + 0.6, 0.6, room.z - 0.9);
          this.add(mirrorFrame);
          // Striped chair (Urban Outfitters bubble chair style)
          const chairMat = new MeshStandardMaterial({ color: 0xd0d040, roughness: 0.6 });
          const chair = new Mesh(new CylinderGeometry(0.08, 0.14, 0.2, 8), chairMat);
          chair.position.set(room.x + 0.6, 0.1, room.z + 0.4);
          this.add(chair);
          const chairBack = new Mesh(new CylinderGeometry(0.1, 0.06, 0.25, 8), new MeshStandardMaterial({ color: 0x40d0a0, roughness: 0.6 }));
          chairBack.position.set(room.x + 0.6, 0.25, room.z + 0.4);
          this.add(chairBack);
          // Hand sculpture on wall
          const handMat = new MeshStandardMaterial({ color: 0xe0c8a8, roughness: 0.4 });
          const hand = new Mesh(new BoxGeometry(0.08, 0.12, 0.04), handMat);
          hand.position.set(room.x - 0.6, 0.7, room.z - 0.9);
          this.add(hand);
          // Retro sink with curved basin
          const sinkMat = new MeshStandardMaterial({ color: 0xf0ede8, roughness: 0.2, metalness: 0.1 });
          const sink = new Mesh(new CylinderGeometry(0.1, 0.12, 0.08, 10), sinkMat);
          sink.position.set(room.x + 0.6, 0.35, room.z - 0.5);
          this.add(sink);
          const tapMat = new MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.6 });
          const tap = new Mesh(new CylinderGeometry(0.01, 0.01, 0.06, 6), tapMat);
          tap.position.set(room.x + 0.65, 0.42, room.z - 0.5);
          this.add(tap);
          break;
        }
        case 'Living Room': {
          // Bubble-like vase/decoration
          const bubbleMat = new MeshStandardMaterial({ color: 0x88ccee, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.5 });
          const bubble = new Mesh(new SphereGeometry(0.08, 10, 10), bubbleMat);
          bubble.position.set(room.x + 1.0, 0.45, room.z + 0.2);
          this.add(bubble);
          const bubble2 = new Mesh(new SphereGeometry(0.06, 10, 10), bubbleMat);
          bubble2.position.set(room.x + 1.1, 0.42, room.z + 0.1);
          this.add(bubble2);
          // Hand-shaped chair (procedural approximation)
          const handMat = new MeshStandardMaterial({ color: 0xe0c0a0, roughness: 0.5 });
          const handChair = new Mesh(new BoxGeometry(0.25, 0.08, 0.2), handMat);
          handChair.position.set(room.x - 1.5, 0.47, room.z - 1.0);
          this.add(handChair);
          const handBack = new Mesh(new BoxGeometry(0.04, 0.25, 0.15), handMat);
          handBack.position.set(room.x - 1.55, 0.6, room.z - 1.0);
          handBack.rotation.z = 0.15;
          this.add(handBack);
          // Plant
          const plantMat = new MeshStandardMaterial({ color: 0x338833, roughness: 0.9 });
          const plant = new Mesh(new SphereGeometry(0.07, 6, 6), plantMat);
          plant.position.set(room.x + 0.2, 0.5, room.z + 0.1);
          this.add(plant);
          break;
        }
        case 'Kitchen': {
          // Curved kitchen island — BB 2025 inflatable-look orange island
          const islandMat = new MeshStandardMaterial({ color: 0xd89840, roughness: 0.5, metalness: 0.05 });
          const island = new Mesh(new CylinderGeometry(0.7, 0.8, 0.5, 14), islandMat);
          island.position.set(room.x, 0.25, room.z - 0.3);
          island.castShadow = true;
          this.add(island);
          if (this.physics) this.physics.addBox([room.x, 0.25, room.z - 0.3], [1.4, 0.5, 1.4], true);
          break;
        }
        case 'Dining Room': {
          // Eye-shaped dining table — eye motif painted on circular top
          const tableTopMat = new MeshStandardMaterial({ color: 0xc8a040, roughness: 0.3, metalness: 0.05 });
          const tableLegMat = this.woodMat('#5a4a3a');
          const leg = new Mesh(new CylinderGeometry(0.03, 0.04, 0.4, 6), tableLegMat);
          leg.position.set(room.x, 0.2, room.z);
          this.add(leg);
          const top = new Mesh(new CylinderGeometry(0.45, 0.45, 0.04, 20), tableTopMat);
          top.position.set(room.x, 0.42, room.z);
          top.castShadow = true;
          this.add(top);
          if (this.physics) this.physics.addBox([room.x, 0.25, room.z], [0.9, 0.5, 0.9], true);
          // Iris/pupil decoration on table
          const irisMat = new MeshStandardMaterial({ color: 0x88aacc, roughness: 0.2, metalness: 0.1 });
          const iris = new Mesh(new CylinderGeometry(0.18, 0.18, 0.005, 16), irisMat);
          iris.position.set(room.x, 0.445, room.z);
          this.add(iris);
          const pupilMat = new MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.1 });
          const pupil = new Mesh(new CylinderGeometry(0.08, 0.08, 0.005, 12), pupilMat);
          pupil.position.set(room.x, 0.45, room.z);
          this.add(pupil);
          // Chairs around table
          const chairSeatMat = new MeshStandardMaterial({ color: 0xa08060, roughness: 0.7 });
          const chairAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
          for (const a of chairAngles) {
            const cx = room.x + Math.cos(a) * 0.55;
            const cz = room.z + Math.sin(a) * 0.55;
            const seat = new Mesh(new BoxGeometry(0.2, 0.04, 0.2), chairSeatMat);
            seat.position.set(cx, 0.38, cz);
            this.add(seat);
            const back = new Mesh(new BoxGeometry(0.16, 0.15, 0.02), chairSeatMat);
            back.position.set(room.x + Math.cos(a) * 0.6, 0.5, room.z + Math.sin(a) * 0.6);
            back.rotation.y = a + Math.PI;
            this.add(back);
            if (this.physics) this.physics.addBox([cx, 0.2, cz], [0.2, 0.3, 0.2], true);
          }
          break;
        }
        case 'Diary Room': {
          // Camera light (red dot)
          const light = new Mesh(new SphereGeometry(0.03, 8, 8), new MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 }));
          light.position.set(room.x, 1.8, room.z + 0.6);
          this.add(light);
          // Spotlight cone (translucent)
          const spotMat = new MeshStandardMaterial({ color: 0xffeecc, transparent: true, opacity: 0.08, side: DoubleSide });
          const spot = new Mesh(new CylinderGeometry(0.5, 0.02, 0.6, 8, 1, true), spotMat);
          spot.position.set(room.x, 2.4, room.z + 0.1);
          spot.rotation.x = Math.PI;
          this.add(spot);
          // Wide, shallow Diary Room chair — BB 2025: "incredibly wide but quite shallow"
          const chairMat = new MeshStandardMaterial({ color: 0xcc8844, roughness: 0.6, metalness: 0.05 });
          const seat = new Mesh(new BoxGeometry(0.45, 0.06, 0.25), chairMat);
          seat.position.set(room.x, 0.25, room.z + 0.3);
          this.add(seat);
          if (this.physics) this.physics.addBox([room.x, 0.2, room.z + 0.3], [0.45, 0.3, 0.25], true);
          const backMat = new MeshStandardMaterial({ color: 0xbb7733, roughness: 0.7 });
          const back = new Mesh(new BoxGeometry(0.4, 0.2, 0.04), backMat);
          back.position.set(room.x, 0.4, room.z + 0.45);
          this.add(back);
          // Eyeball surround on wall behind chair
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            this.addEyeball(
              room.x + Math.cos(angle) * 0.4,
              1.2 + Math.sin(angle) * 0.3,
              room.z - 0.9,
              0.04,
              Math.PI
            );
          }
          break;
        }
      }
    }
    // Underlit bed glow — BB 2025: beds have soft LED light underneath
    const bedRooms = ['Bedroom 1', 'Bedroom 2', 'Bedroom 3'];
    for (const bn of bedRooms) {
      const br = ROOMS.find(r => r.name === bn);
      if (!br) continue;
      const glowMat = new MeshStandardMaterial({ color: 0x40aacc, emissive: 0x40aacc, emissiveIntensity: 0.4, transparent: true, opacity: 0.3 });
      const glow = new Mesh(new BoxGeometry(0.5, 0.02, 0.35), glowMat);
      glow.position.set(br.x, 0.04, br.z);
      this.add(glow);
    }
    // Visible surveillance cameras in rooms (black/white domes with red LED) — BB 2025
    const cameraRooms = ['Living Room', 'Kitchen', 'Dining Room', 'Bathroom', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3'];
    const camMat = new MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const camLensMat = new MeshStandardMaterial({ color: 0x666688, roughness: 0.1, metalness: 0.3 });
    const camLedMat = new MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 });
    for (const cn of cameraRooms) {
      const cr = ROOMS.find(r => r.name === cn);
      if (!cr) continue;
      // Two cameras per room, one at each end — lens points toward room center
      for (const corner of [-1, 1]) {
        const cx = cr.x + corner * (cr.w / 2 - 0.3);
        const cz = cr.z;
        const dome = new Mesh(new SphereGeometry(0.04, 6, 6), camMat);
        dome.scale.y = 0.4;
        dome.position.set(cx, WALL_H - 0.1, cz);
        this.add(dome);
        // Lens points toward room center
        const lens = new Mesh(new SphereGeometry(0.015, 6, 6), camLensMat);
        const lookDir = corner > 0 ? -0.02 : 0.02;
        lens.position.set(cx + lookDir, WALL_H - 0.08, cz);
        this.add(lens);
        const led = new Mesh(new SphereGeometry(0.005, 4, 4), camLedMat);
        led.position.set(cx, WALL_H - 0.1, cz + 0.035);
        this.add(led);
      }
    }
  }

  getRoomAt(x: number, z: number): RoomDef | undefined {
    return this.rooms.find(r =>
      x >= r.x - r.w / 2 && x <= r.x + r.w / 2 &&
      z >= r.z - r.d / 2 && z <= r.z + r.d / 2
    );
  }

  getRoomByName(name: string): RoomDef | undefined {
    return this.rooms.find(r => r.name === name);
  }
}

function mulberry32(a: number): () => number {
  return () => { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
