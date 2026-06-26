import {
  Group, Mesh, MeshStandardMaterial, BoxGeometry, RingGeometry, Vector3,
} from 'three';
import { AnimationController } from './AnimationController';
import { SkeletalAnimator } from './SkeletalAnimator';
import { type PhysicsWorld } from './Physics';
import { Needs, type PersonalityTraits, EmotionalState } from '../simulation/Needs';
import { ClothingStateMachine } from './ClothingState';
import { Memory } from '../simulation/Memory';
import { Physiology } from '../simulation/Physiology';
import { type RoomDef } from './House';
import { generateSkinTexture, generateClothTexture } from './ProceduralTexture';
import { BeliefSystem } from '../simulation/Belief';
import { MemoryStream } from '../simulation/MemoryStream';
import { ReflectionSystem } from '../simulation/ReflectionSystem';
import { PlanningSystem } from '../simulation/PlanningSystem';
import { TheoryOfMind } from '../simulation/TheoryOfMind';
import type { NPCBrain } from '../api/NPCBrain';

export interface NPCConfig {
  name: string;
  color: number;
  spawnRoom: string;
  personality: PersonalityTraits;
  gender?: 'male' | 'female';
  libido?: number;
}

type Action = {
  type: string;
  targetRoom: string;
  duration: number;
  priority: number;
};

export class NPC extends Group {
  readonly npcName: string;
  readonly npcColor: string;
  readonly personality: PersonalityTraits;
  readonly gender: 'male' | 'female';
  readonly libido: number;
  readonly needs: Needs;
  readonly emotion: EmotionalState;
  readonly clothing: ClothingStateMachine;
  readonly memory: Memory;
  readonly physiology: Physiology;

  readonly avatarId = Symbol('npc');
  private animRoot = new Group();
  readonly animCtrl = new AnimationController(this.animRoot);
  private body: Mesh;
  private head: Mesh;
  private avatarGroup: Group | null = null;
  /** Skeletal animation driver for rigged GLB avatars */
  private skeletalAnim: SkeletalAnimator | null = null;
  private targetPos = new Vector3();
  private moveSpeed = 3;
  private _state: 'idle' | 'walking' | 'acting' = 'idle';
  private physicsBodyId = {};
  private _currentAction: Action | null = null;
  private actionTimer = 0;
  private thinkCooldown = 0;
  private stuckTimer = 0; // Tracks how long the NPC has been stuck
  socialCooldown = 0; // used by NPCManager for conversation, not for think()
  private homeRoom: string;
  private _rooms: RoomDef[] = [];

  currentRoom = '';
  currentActivity = 'idle';
  dialogueHistory: string[] = [];
  affinity: Map<string, number> = new Map();
  lastDialogueTime = 0;
  isEvicted = false;
  immunity = false;       // immune to next nomination
  luxuryBoost = 0;        // hours remaining for luxury mood boost
  nominatePower = 0;      // extra nomination votes they can cast
  completedTaskCount = 0; // total tasks completed
  visualContext: string[] = []; // what the NPC can "see" in their room
  // Strategic attributes
  evictionFear = 0; // 0-1, how scared they are of being evicted
  desperation = 0;  // 0-1, how desperate they are to stay
  prizeAwareness = 0; // 0-1, how much they think about the £2M prize
  alliance: string[] = []; // NPC names they're allied with
  betrayalPlans: string[] = []; // NPC names they plan to betray
  campaignPromises: Map<string, string> = new Map(); // npc -> promise made
  /** Belief system — what this NPC thinks about others and the world */
  beliefs: BeliefSystem;
  /** Multi-layer brain systems */
  memoryStream: MemoryStream;
  reflection: ReflectionSystem;
  planning: PlanningSystem;
  theoryOfMind: TheoryOfMind;
  /** Currently engaged in a multi-turn conversation with this NPC (null if none) */
  conversingWith: string | null = null;
  /** Dialogue exchange counter for the current conversation */
  conversationTurn = 0;
  /** Pending line to speak (set by brain, consumed by display) */
  pendingLine: { target: string; text: string } | null = null;
  /** Physical description for self-awareness */
  physicalDesc: string;
  /** What the NPC knows about other NPCs' physicality (name → description) */
  knownPhysicality: Map<string, string> = new Map();

  constructor(config: NPCConfig) {
    super();
    this.npcName = config.name;
    this.npcColor = `#${config.color.toString(16).padStart(6, '0')}`;
    this.personality = config.personality;
    this.gender = config.gender ?? (Math.random() < 0.5 ? 'male' : 'female');
    this.libido = config.libido ?? (0.7 + Math.random() * 0.3);
    this.needs = new Needs();
    this.emotion = new EmotionalState();
    this.beliefs = new BeliefSystem(
      config.personality.neuroticism,
      config.personality.extraversion,
      config.personality.agreeableness,
    );
    this.clothing = new ClothingStateMachine();
    this.memory = new Memory();
    this.memoryStream = new MemoryStream();
    this.reflection = new ReflectionSystem(100, 4);
    this.planning = new PlanningSystem();
    this.theoryOfMind = new TheoryOfMind();
    this.physiology = new Physiology();
    this.currentRoom = config.spawnRoom;
    this.homeRoom = config.spawnRoom;

    const variant = Math.floor(Math.random() * 1000);
    const skinTone = this.gender === 'male'
      ? `rgb(${215+Math.floor(Math.random()*35)},${185+Math.floor(Math.random()*35)},${160+Math.floor(Math.random()*30)})`
      : `rgb(${230+Math.floor(Math.random()*25)},${200+Math.floor(Math.random()*30)},${175+Math.floor(Math.random()*25)})`;
    const skinTex = generateSkinTexture(256, 256, skinTone, variant);
    const clothTex = generateClothTexture(128, 128, `#${config.color.toString(16).padStart(6, '0')}`);

    const skin = new MeshStandardMaterial({ map: skinTex.map, normalMap: skinTex.normalMap, roughness: 0.4, metalness: 0 });
    const cloth = new MeshStandardMaterial({
      map: clothTex,
      roughness: 0.7,
      metalness: 0,
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.15,
    });

    // Larger body for visibility
    this.body = new Mesh(new BoxGeometry(0.7, 1.0, 0.45), cloth);
    this.body.position.y = 0.9;
    this.body.castShadow = true;
    this.body.userData._npc = this;
    this.animRoot.add(this.body);

    // Larger head
    this.head = new Mesh(new BoxGeometry(0.35, 0.35, 0.35), skin);
    this.head.position.y = 1.6;
    this.head.castShadow = true;
    this.head.userData._npc = this;
    this.animRoot.add(this.head);

    // Floor indicator ring — bright, color-matched ring under the NPC
    const ringMat = new MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.7,
      roughness: 0.3,
      metalness: 0,
      side: 2,
    });
    const ring = new Mesh(new RingGeometry(0.35, 0.65, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.userData._npc = this;
    this.animRoot.add(ring);

    this.add(this.animRoot);
    this.position.y = 0;

    // Physical description for self/other awareness
    const height = this.gender === 'male' ? 'tall' : (Math.random() > 0.5 ? 'tall' : 'petite');
    const build = Math.random() > 0.5 ? 'slender' : 'athletic';
    const hairColors = this.gender === 'male' ? ['brown', 'dark', 'blonde', 'ginger'] : ['blonde', 'brunette', 'red', 'dark'];
    const hair = hairColors[Math.floor(Math.random() * hairColors.length)];
    const eyes = Math.random() > 0.5 ? 'blue' : (Math.random() > 0.5 ? 'green' : 'brown');
    this.physicalDesc = `${height}, ${build}, ${hair} hair, ${eyes} eyes`;
  }

  setRooms(rooms: RoomDef[]) { this._rooms = rooms; }

  // Save/load accessors
  get action() { return this._currentAction; }
  get actionTimeRemaining() { return this.actionTimer; }
  get thinkCD() { return this.thinkCooldown; }
  set thinkCD(v: number) { this.thinkCooldown = v; }
  get homeRoomName() { return this.homeRoom; }
  set homeRoomName(v: string) { this.homeRoom = v; }

  /** Restore current action from save data */
  setAction(type: string, targetRoom: string, duration: number, priority: number) {
    this._currentAction = { type, targetRoom, duration, priority };
    this.actionTimer = duration;
  }
  clearAction() { this._currentAction = null; this.actionTimer = 0; }

  replaceWithAvatar(group: Group | null) {
    if (this.avatarGroup) {
      this.animRoot.remove(this.avatarGroup);
      this.avatarGroup = null;
    }
    // Dispose previous skeletal animator
    if (this.skeletalAnim) { this.skeletalAnim.dispose(); this.skeletalAnim = null; }

    if (group && group.children.length > 0) {
      this.avatarGroup = group;
      group.userData._npc = this;
      group.traverse(child => { child.userData._npc = this; });
      this.animRoot.add(group);
      this.body.visible = false;
      this.head.visible = false;
      // Create skeletal animation driver from the loaded GLB skeleton
      this.skeletalAnim = SkeletalAnimator.fromScene(group);
    } else {
      this.body.visible = true;
      this.head.visible = true;
      const hasBody = this.animRoot.children.includes(this.body);
      const hasHead = this.animRoot.children.includes(this.head);
      if (!hasBody) this.animRoot.add(this.body);
      if (!hasHead) this.animRoot.add(this.head);
    }
  }

  isPrivateState(): boolean {
    return this.clothing.isPrivate(this.clothing.getState(this.npcName));
  }

  isNude(): boolean {
    return this.clothing.getState(this.npcName) === 'nude';
  }

  initPhysics(physics: PhysicsWorld) {
    const body = physics.addSphere([this.position.x, 0.8, this.position.z], 0.3, 1);
    body.fixedRotation = true;
    body.updateMassProperties();
    physics.register(this.physicsBodyId, body);
  }

  syncFromPhysics(physics: PhysicsWorld) {
    const pos = physics.getPosition(this.physicsBodyId);
    if (pos) { this.position.x = pos[0]; this.position.z = pos[2]; }
  }

  get state() { return this._state; }
  setState(s: 'idle' | 'walking' | 'acting') { this._state = s; }

  setTarget(x: number, z: number) {
    this.targetPos.set(x, 0, z);
    this._state = 'walking';
  }

  think(simDt: number, hour: number, day: number, time: string, allNpcs: NPC[], relationships: Map<string, Map<string, number>>, brain?: NPCBrain) {
    this.physiology.update(simDt, this.currentActivity);
    this.needs.update(simDt, this.currentActivity);

    // Luxury boost: decay and apply mood bonus
    if (this.luxuryBoost > 0) {
      this.luxuryBoost -= simDt / 3600; // convert simDt to game hours
      this.needs.values.fun = Math.min(1, this.needs.values.fun + simDt * 0.01);
      this.needs.values.social = Math.min(1, this.needs.values.social + simDt * 0.005);
    }

    this.emotion.update(this.personality, this.needs);

    // ── Layer 1: Observe — add current state to memory stream ──
    if (this.currentActivity !== 'idle' || this._state !== 'idle') {
      const roomContext = this.visualContext.length > 0 ? ` ${this.visualContext.join('. ')}` : '';
      const imp = this.currentActivity === 'socializing' ? 4 : 2;
      this.memoryStream.observe(
        `${this.currentActivity} in ${this.currentRoom}.${roomContext}`,
        imp, 'daily', [this.npcName], this.currentRoom,
        this.emotion.primary, day, time,
      );
    }

    // ── Layer 2: Reflection — check if we should generate high-level insights ──
    const persStr = `extroversion=${this.personality.extraversion.toFixed(1)}, agreeableness=${this.personality.agreeableness.toFixed(1)}, neuroticism=${this.personality.neuroticism.toFixed(1)}`;
    if (brain && this.thinkCooldown <= 0) {
      const recentMems = this.memoryStream.getRecent(10);
      this.reflection.tick(recentMems, this.memoryStream, brain, this.npcName, persStr, day);
    }

    // ── Layer 3: Planning — generate/review daily plan ──
    if (brain && day !== this.planning['planGeneratedAtDay'] && !this._currentAction) {
      const allNames = allNpcs.filter(n => n !== this).map(n => n.npcName);
      this.planning.generateDailyPlan(
        brain, this.npcName, persStr, this.memoryStream,
        this.needs, this.emotion, day, hour, allNames, [],
      ).catch(() => {});
      this.planning['planGeneratedAtDay'] = day;
    }

    this.thinkCooldown -= simDt;
    if (this.thinkCooldown > 0) return;

    // ── Layer 4: Action — decide what to do ──
    if (this._currentAction) {
      this.actionTimer -= simDt;
      if (this.actionTimer <= 0) {
        this.finishActivity(day, time, allNpcs);
        this._currentAction = null;
      }
      return;
    }

    if (this._state === 'walking') {
      const dx = this.targetPos.x - this.position.x;
      const dz = this.targetPos.z - this.position.z;
      if (dx * dx + dz * dz < 0.04) {
        this._state = 'idle';
        this.startNewActivity(hour, allNpcs, relationships);
      }
      return;
    }

    this.startNewActivity(hour, allNpcs, relationships);
  }

  private startNewActivity(hour: number, allNpcs: NPC[], relationships: Map<string, Map<string, number>>) {
    const actions = this.evaluateActions(hour, allNpcs, relationships);

    if (actions.length === 0) {
      this.currentActivity = 'idle';
      this.thinkCooldown = 2 + Math.random() * 4;
      return;
    }

    actions.sort((a, b) => b.priority - a.priority);
    const chosen = actions[0];

    this._currentAction = chosen;
    this.actionTimer = chosen.duration;

    const room = this._rooms.find(r => r.name === chosen.targetRoom);
    if (room) {
      const offX = (Math.random() - 0.5) * Math.min(room.w * 0.3, 0.6);
      const offZ = (Math.random() - 0.5) * Math.min(room.d * 0.3, 0.6);
      this.setTarget(room.x + offX, room.z + offZ);
    }

    this.currentActivity = chosen.type;
    this.thinkCooldown = 1;
  }

  private evaluateActions(hour: number, allNpcs: NPC[], relationships: Map<string, Map<string, number>>): Action[] {
    const actions: Action[] = [];
    const isNight = hour < 7 || hour >= 22;
    const currentState = this.clothing.getState(this.npcName);
    const isExposed = currentState === 'nude' || currentState === 'towel' || currentState === 'swimwear' || currentState === 'changing';
    const commonRooms = ['Living Room', 'Garden', 'Kitchen', 'Dining Room'];

    // ── Exhibitionism: parade around common areas when nude/towel/swimwear ──
    if (isExposed) {
      // High priority: go to a common area to be seen
      const target = commonRooms[Math.floor(Math.random() * commonRooms.length)];
      if (this.currentRoom !== target) {
        actions.push({
          type: currentState === 'nude' ? 'lounging' : 'lounging',
          targetRoom: target,
          duration: 10 + Math.random() * 10,
          priority: 1.5 + this.personality.extraversion * 0.8,
        });
      }
      // If already in a common room while exposed, stay longer
      if (commonRooms.includes(this.currentRoom)) {
        actions.push({
          type: 'lounging',
          targetRoom: this.currentRoom,
          duration: 5 + Math.random() * 8,
          priority: 1.2 + this.personality.extraversion * 0.5,
        });
      }
    }

    // ── Voyeurism: seek out NPCs who are nude/changing/towel ──
    for (const other of allNpcs) {
      if (other === this || !other.visible) continue;
      const otherState = other.clothing.getState(other.npcName);
      if (otherState === 'nude' || otherState === 'changing' || otherState === 'towel') {
        const dx = this.position.x - other.position.x;
        const dz = this.position.z - other.position.z;
        if (dx * dx + dz * dz > 3 || this.currentRoom !== other.currentRoom) {
          actions.push({
            type: 'socializing',
            targetRoom: other.currentRoom,
            duration: 5 + Math.random() * 5,
            priority: 1.0 + this.libido * 0.5 + this.personality.extraversion * 0.3,
          });
        } else {
          // Already near them — gawk (stay in room)
          actions.push({
            type: 'socializing',
            targetRoom: this.currentRoom,
            duration: 4 + Math.random() * 4,
            priority: 1.0 + this.libido * 0.5,
          });
        }
        break;
      }
    }

    // ── Visual context: react to what they see in their room ──
    const seesExposed = this.visualContext.some(v => v.includes('(naked)') || v.includes('(in towel)'));
    if (seesExposed && this.libido > 0.6) {
      // High libido NPCs stay and watch when someone exposed is nearby
      actions.push({
        type: 'socializing',
        targetRoom: this.currentRoom,
        duration: 4 + Math.random() * 4,
        priority: this.libido * 1.0,
      });
    }
    if (seesExposed && this.personality.conscientiousness > 0.5) {
      // Conscientious NPCs leave when someone is exposed (disapproval)
      const otherRoom = this._rooms.filter(r => r.name !== this.currentRoom && r.name !== 'Unknown');
      if (otherRoom.length > 0) {
        const r = otherRoom[Math.floor(Math.random() * otherRoom.length)];
        actions.push({ type: 'lounging', targetRoom: r.name, duration: 5 + Math.random() * 3, priority: 1.1 });
      }
    }

    // ── Exhibitionist undressing: strip in common areas for attention ──
    if (commonRooms.includes(this.currentRoom) && !isExposed && Math.random() < 0.3 + this.personality.extraversion * 0.3) {
      actions.push({ type: 'changing', targetRoom: this.currentRoom, duration: 2 + Math.random() * 2, priority: this.personality.extraversion * 1.5 + this.libido * 0.5 });
    }

    // ── Desperate socializing (threshold raised to 0.7 — they're always craving attention) ──
    if (this.needs.values.social < 0.7) {
      const socialWeight = (1 - this.needs.values.social) * 2.0 * (0.8 + this.personality.extraversion * 0.4);
      const target = commonRooms[Math.floor(Math.random() * commonRooms.length)];
      if (this.currentRoom !== target) {
        actions.push({ type: 'socializing', targetRoom: target, duration: 8 + Math.random() * 8, priority: socialWeight });
      } else {
        actions.push({ type: 'socializing', targetRoom: target, duration: 4 + Math.random() * 4, priority: socialWeight * 0.7 });
      }
    }

    // ── Proactive social seeking — belief-driven ──
    const socialUrgency = this.needs.values.social < 0.7 ? (1 - this.needs.values.social) * 2.0 : 0;
    const sortedOthers = allNpcs
      .filter(o => o !== this && o.visible && !o.isEvicted && o.npcName !== this.conversingWith)
      .map(o => ({
        npc: o,
        trust: this.beliefs.getTrust(o.npcName),
        threat: this.beliefs.getThreat(o.npcName),
        pop: this.beliefs.getPopularity(o.npcName),
        aff: relationships.get(this.npcName)?.get(o.npcName) ?? 0,
      }));

    if (socialUrgency > 0 && sortedOthers.length > 0) {
      // High extraversion: seek anyone (quantity over quality)
      if (this.personality.extraversion > 0.6) {
        const target = sortedOthers.sort((a, b) => b.aff - a.aff)[0];
        if (target && this.currentRoom !== target.npc.currentRoom) {
          actions.push({ type: 'socializing', targetRoom: target.npc.currentRoom, duration: 8 + Math.random() * 6, priority: socialUrgency + 0.5 });
        }
      } else {
        // Low extraversion: seek trusted individuals
        const trusted = sortedOthers.filter(o => o.trust > 0.5).sort((a, b) => b.trust - a.trust);
        if (trusted.length > 0 && this.currentRoom !== trusted[0].npc.currentRoom) {
          actions.push({ type: 'socializing', targetRoom: trusted[0].npc.currentRoom, duration: 6 + Math.random() * 5, priority: socialUrgency + 0.3 });
        }
      }
    }

    // ── Cunning: seek out popular/influential NPCs to build relationships ──
    if (this.beliefs.cunning > 0.5 && sortedOthers.length > 0) {
      const popular = sortedOthers.sort((a, b) => b.pop - a.pop)[0];
      if (popular && popular.pop > 0.6 && this.currentRoom !== popular.npc.currentRoom) {
        actions.push({ type: 'socializing', targetRoom: popular.npc.currentRoom, duration: 5 + Math.random() * 4, priority: this.beliefs.cunning * 0.7 });
      }
    }

    // ── Confront high-threat NPCs (when confident) ──
    if (this.beliefs.confidence > 0.5 && sortedOthers.length > 0) {
      const highThreat = sortedOthers.filter(o => o.threat > 0.6).sort((a, b) => b.threat - a.threat);
      if (highThreat.length > 0 && this.currentRoom !== highThreat[0].npc.currentRoom) {
        actions.push({ type: 'socializing', targetRoom: highThreat[0].npc.currentRoom, duration: 4 + Math.random() * 4, priority: 0.6 + highThreat[0].threat * 0.4 });
      }
    }

    // ── Seek out an NPC we're not allied with yet (strategic expansion) ──
    if (this.beliefs.cunning > 0.3 && sortedOthers.length > 0) {
      const nonAllied = sortedOthers.find(o => !this.alliance.includes(o.npc.npcName) && o.aff > -0.1);
      if (nonAllied && this.currentRoom !== nonAllied.npc.currentRoom) {
        actions.push({ type: 'socializing', targetRoom: nonAllied.npc.currentRoom, duration: 5 + Math.random() * 4, priority: 0.5 + this.beliefs.cunning * 0.3 });
      }
    }

    // ── Basic needs (still present, but lower priority than attention-seeking) ──
    if (this.needs.values.hunger < 0.4) {
      actions.push({ type: 'eating', targetRoom: 'Kitchen', duration: 6 + Math.random() * 4, priority: (1 - this.needs.values.hunger) * 1.5 });
    }

    if ((this.needs.values.energy < 0.3 && isNight) || this.needs.values.energy < 0.1) {
      actions.push({ type: 'sleeping', targetRoom: this.homeRoom, duration: 10 + Math.random() * 8, priority: (1 - this.needs.values.energy) * 1.8 });
    }

    if (this.physiology.fatigue > 0.7) {
      actions.push({ type: 'sleeping', targetRoom: this.homeRoom, duration: 8 + Math.random() * 5, priority: this.physiology.fatigue * 1.5 });
    }

    if (this.needs.values.hygiene < 0.3) {
      actions.push({ type: 'showering', targetRoom: 'Bathroom', duration: 5 + Math.random() * 3, priority: (1 - this.needs.values.hygiene) * 1.2 });
    }

    if (this.needs.values.fun < 0.3) {
      actions.push({ type: 'lounging', targetRoom: 'Garden', duration: 6 + Math.random() * 4, priority: (1 - this.needs.values.fun) * 0.8 });
    }

    // ── Diary room: fame-hungry NPCs love the camera ──
    if (Math.random() < 0.2 + this.personality.extraversion * 0.3) {
      actions.push({ type: 'diary', targetRoom: 'Diary Room', duration: 4 + Math.random() * 3, priority: 0.6 + this.personality.extraversion * 0.5 });
    }

    // ── Wandering: patrol the house to be seen (attention-seeking) ──
    if (this._state !== 'walking' && Math.random() < 0.3 + this.personality.extraversion * 0.2) {
      const rooms = this._rooms.filter(r => r.name !== this.currentRoom);
      if (rooms.length > 0) {
        const r = rooms[Math.floor(Math.random() * rooms.length)];
        actions.push({ type: 'lounging', targetRoom: r.name, duration: 3 + Math.random() * 3, priority: 0.5 + this.personality.extraversion * 0.4 });
      }
    }

    // ── Flirting/intimacy pursuit (high libido) ──
    if (this.libido > 0.5) {
      for (const other of allNpcs) {
        if (other === this || !other.visible) continue;
        if (Math.abs(this.position.x - other.position.x) < 5) {
          const aff = relationships.get(this.npcName)?.get(other.npcName) ?? 0;
          if (aff > -0.2) {
            actions.push({
              type: 'lounging',
              targetRoom: other.currentRoom,
              duration: 5 + Math.random() * 5,
              priority: this.libido * 0.8 + Math.max(0, aff) * 0.5,
            });
          }
          break;
        }
      }
    }

    // ── Desperation-driven actions (eviction fear) ──
    if (this.evictionFear > 0.4) {
      // Desperate: seek out other NPCs to campaign for votes
      for (const other of allNpcs) {
        if (other === this || !other.visible) continue;
        const aff = relationships.get(this.npcName)?.get(other.npcName) ?? 0;
        // Try to build/maintain relationships when scared of eviction
        const despoPriority = this.evictionFear * 1.5 + this.desperation * 1.0 + (aff < 0 ? 0.5 : 0);
        if (this.currentRoom !== other.currentRoom) {
          actions.push({ type: 'socializing', targetRoom: other.currentRoom, duration: 6 + Math.random() * 6, priority: despoPriority });
        } else {
          actions.push({ type: 'socializing', targetRoom: this.currentRoom, duration: 4 + Math.random() * 4, priority: despoPriority * 0.8 });
        }
        break;
      }
      // Desperate NPCs also do more tasks/diary room to impress Big Brother
      if (Math.random() < this.evictionFear * 0.5) {
        actions.push({ type: 'diary', targetRoom: 'Diary Room', duration: 4 + Math.random() * 3, priority: 0.8 + this.evictionFear * 0.8 });
      }
    }

    // ── Prize money awareness: more strategic when prize-aware ──
    if (this.prizeAwareness > 0.3) {
      // Campaign by seeking out popular NPCs
      for (const other of allNpcs) {
        if (other === this || !other.visible) continue;
        if (other.completedTaskCount > this.completedTaskCount) {
          // Try to be seen with successful NPCs
          actions.push({ type: 'socializing', targetRoom: other.currentRoom, duration: 4 + Math.random() * 4, priority: 0.6 + this.prizeAwareness * 0.5 });
          break;
        }
      }
    }

    // ── Alliance maintenance: seek out allies ──
    if (this.alliance.length > 0) {
      for (const allyName of this.alliance) {
        const ally = allNpcs.find(n => n.npcName === allyName);
        if (ally && ally.visible && !ally.isEvicted) {
          if (this.currentRoom !== ally.currentRoom) {
            actions.push({ type: 'socializing', targetRoom: ally.currentRoom, duration: 5 + Math.random() * 5, priority: 0.9 });
          }
          break;
        }
      }
    }

    // ── Strip for attention: go nude in common areas ──
    if (!isExposed && Math.random() < this.personality.extraversion * 0.3 + this.libido * 0.2) {
      const room = commonRooms[Math.floor(Math.random() * commonRooms.length)];
      actions.push({ type: 'changing', targetRoom: room, duration: 2, priority: 0.7 + this.personality.extraversion * 0.5 });
    }

    return actions;
  }

  private finishActivity(day: number, time: string, allNpcs: NPC[]) {
    if (this.currentActivity === 'eating') {
      this.memory.record('daily', [this.npcName], this.currentRoom, `Ate in the ${this.currentRoom}`, 0.2, 0.3, day, time);
    }
    if (this.currentActivity === 'socializing') {
      const nearby = allNpcs.filter(n => n !== this && n.visible && Math.abs(this.position.x - n.position.x) < 5);
      for (const n of nearby) {
        const aff = this.affinity.get(n.npcName) ?? 0;
        const wasPositive = aff > 0;
        this.memory.record('conversation', [this.npcName, n.npcName], this.currentRoom,
          `Hung out with ${n.npcName}`, wasPositive ? 0.4 : -0.2, 0.5, day, time);
        // Update beliefs based on social interaction
        this.beliefs.ensureOther(n.npcName);
        this.beliefs.observeInteraction(n.npcName, aff, wasPositive);
      }
    }
    if (this.currentActivity === 'sleeping') {
      this.memory.record('daily', [this.npcName], this.currentRoom, 'Slept', 0, 0.2, day, time);
    }
    this.currentActivity = 'idle';
    this.thinkCooldown = 0.5 + Math.random() * 1;
  }

  updateAnimation(dt: number) {
    const state = this._state === 'walking' ? 'walking' : 'idle';
    this.animCtrl.setState(state);
    this.animCtrl.update(dt);
    if (this.skeletalAnim) {
      this.skeletalAnim.setState(state);
      this.skeletalAnim.update(dt);
    }
  }

  updatePhysics(dt: number, physics: PhysicsWorld) {
    if (this._state === 'walking') {
      const dx = this.targetPos.x - this.position.x;
      const dz = this.targetPos.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.2) {
        physics.setVelocity(this.physicsBodyId, 0, 0, 0);
        this._state = 'idle';
        this.stuckTimer = 0;
        return;
      }
      const speed = this.moveSpeed;
      let vx = (dx / dist) * speed;
      let vz = (dz / dist) * speed;

      // Stuck recovery logic
      const vel = physics.getVelocity(this.physicsBodyId);
      if (vel) {
        const currentSpeed = Math.sqrt(vel[0] * vel[0] + vel[2] * vel[2]);
        if (currentSpeed < 0.1) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 0.5) {
            // We are stuck! Apply a perpendicular "slide" force to find a gap
            const slideDir = Math.sin(Date.now() * 0.005) > 0 ? 1 : -1;
            vx += (dz / dist) * speed * slideDir;
            vz -= (dx / dist) * speed * slideDir;
            // Slowly nudge the target position to avoid repeat sticking
            this.targetPos.x += (Math.random() - 0.5) * 0.1;
            this.targetPos.z += (Math.random() - 0.5) * 0.1;
          }
        } else {
          this.stuckTimer = 0;
        }
      }

      physics.setVelocity(this.physicsBodyId, vx, 0, vz);
      this.rotation.y = Math.atan2(dx, dz);
    } else {
      physics.setVelocity(this.physicsBodyId, 0, 0, 0);
      this.stuckTimer = 0;
    }
  }

  lookAtPosition(pos: Vector3) {
    const dx = pos.x - this.position.x;
    const dz = pos.z - this.position.z;
    this.rotation.y = Math.atan2(dx, dz);
  }
}
