import { House } from './House';
import { NPC, type NPCConfig } from './NPC';
import { SimulationClock } from './SimulationClock';
import { type SceneManager } from './SceneManager';
import { type PhysicsWorld } from './Physics';
import { type NPCBrain } from '../api/NPCBrain';
import { AvatarSystem } from './AvatarSystem';
import { randomPersonality, type PersonalityTraits } from '../simulation/Needs';
import { RelationshipGraph } from '../simulation/Relationship';
import { IntimacySystem } from '../simulation/Intimacy';
import { TokenCompressor } from '../utils/TokenCompressor';
import { Group, Box3, Mesh, MeshStandardMaterial } from 'three';
import { generateSkinAtlas } from './SkinGenerator';

function exhibitionistPersonality(): PersonalityTraits {
  return {
    openness: 1.0,           // max — novelty-seeking, uninhibited
    conscientiousness: -0.8, // very low — impulsive, messy
    extraversion: 1.0,       // max — desperate for social attention
    agreeableness: -0.5,     // low — doesn't care what others think
    neuroticism: -1.0,       // min — zero shame, zero anxiety
  };
}

const HOUSEMATES: NPCConfig[] = [
  { name: 'Alexander', color: 0x4488cc, spawnRoom: 'Living Room', personality: randomPersonality(), gender: 'male' },
  { name: 'Jessica',   color: 0xcc6644, spawnRoom: 'Living Room', personality: randomPersonality(), gender: 'female' },
  { name: 'Samantha',  color: 0x44cc88, spawnRoom: 'Kitchen', personality: randomPersonality(), gender: 'female' },
  { name: 'Ryan',      color: 0xcc8844, spawnRoom: 'Kitchen', personality: randomPersonality(), gender: 'male' },
  // Isabella — extreme exhibitionist, no inhibitions
  { name: 'Isabella',  color: 0xee5599, spawnRoom: 'Bedroom 1', personality: exhibitionistPersonality(), gender: 'female', libido: 1.0 },
  // Olivia — extreme exhibitionist, no inhibitions
  { name: 'Olivia',    color: 0xff6699, spawnRoom: 'Bedroom 2', personality: exhibitionistPersonality(), gender: 'female', libido: 1.0 },
  { name: 'Ethan',     color: 0x66aadd, spawnRoom: 'Dining Room', personality: randomPersonality(), gender: 'male' },
  { name: 'Liam',      color: 0x88aadd, spawnRoom: 'Bedroom 3', personality: randomPersonality(), gender: 'male' },
  { name: 'Charlotte', color: 0xcc88aa, spawnRoom: 'Bathroom', personality: randomPersonality(), gender: 'female' },
  { name: 'Noah',      color: 0x88ccaa, spawnRoom: 'Store Room', personality: randomPersonality(), gender: 'male' },
];

export interface ConversationEvent {
  speaker: string;
  listener: string;
  text: string;
  room: string;
}

export class NPCManager {
  readonly npcs: NPC[] = [];
  readonly relationships = new RelationshipGraph();
  readonly intimacy = new IntimacySystem();
  readonly avatarSys = new AvatarSystem();
  readonly avatarGLBMap = new Map<string, string>();
  readonly conversations: ConversationEvent[] = [];
  evictionCandidates: string[] = [];
  /** Reference to TaskSystem for injecting active tasks into conversation context */
  taskSystem: { tasks: { npcName: string; description: string; bonus: string; deadlineDay: number }[]; getTasksFor: (name: string) => any[] } | null = null;
  /** Recent day events for conversation context (set from main.ts) */
  recentEvents: string[] = [];
  private house: House;
  private clock: SimulationClock;
  private brain: NPCBrain;
  private physics?: PhysicsWorld;
  private _nudeNames: string[] = [];
  private relMap = new Map<string, Map<string, number>>();
  private convCooldown = 0;

  constructor(house: House, clock: SimulationClock, brain: NPCBrain, sceneMgr: SceneManager, physics?: PhysicsWorld) {
    this.house = house;
    this.clock = clock;
    this.brain = brain;
    this.physics = physics;

    for (let i = 0; i < HOUSEMATES.length; i++) {
      const cfg = HOUSEMATES[i];
      const npc = new NPC(cfg);
      npc.setRooms(house.rooms);
      // Spawn all NPCs together in the Garden, spread in a line
      const garden = house.getRoomByName('Garden');
      if (garden) {
        const spread = (i - (HOUSEMATES.length - 1) / 2) * 0.6;
        npc.position.set(garden.x + spread, 0, garden.z);
      } else {
        const room = house.getRoomByName(cfg.spawnRoom);
        if (room) npc.position.set(room.x, 0, room.z);
      }
      if (physics) npc.initPhysics(physics);
      this.npcs.push(npc);
      sceneMgr.add(npc);
    }
    this.loadNPCavatars();
  }

  private async loadNPCavatars() {
    const avatarMap: string[] = [
      'White_M_1_Casual.glb',    // Alexander (male)
      'Black_F_1_Casual.glb',    // Jessica (female)
      'Hispanic_F_1_Casual.glb', // Samantha (female)
      'Asian_M_1_Casual.glb',    // Ryan (male)
      'Hispanic_F_1_Casual.glb', // Isabella (female)
      'Asian_F_1_Casual.glb',    // Olivia (female)
      'White_M_1_Casual.glb',    // Ethan (male)
      'Black_M_1_Casual.glb',    // Liam (male)
      'White_F_1_Casual.glb',    // Charlotte (female)
      'Hispanic_M_1_Casual.glb', // Noah (male)
    ];

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      const filename = avatarMap[i];
      this.avatarGLBMap.set(npc.npcName, filename);
      try {
        const gltf = await this.avatarSys.loadGLTF(`/models/${filename}`);
        const group = gltf.scene.clone(true) as Group;
        // Scale to match game units (~1.6 units tall)
        const bbox = new Box3().setFromObject(group);
        const height = bbox.max.y - bbox.min.y;
        if (height > 0) {
          const scale = 1.6 / height;
          group.scale.set(scale, scale, scale);
        }
        // Center the avatar feet at y=0
        const bbox2 = new Box3().setFromObject(group);
        group.position.y = -bbox2.min.y;
        // Apply procedural PBR skin textures
        this.applyProceduralSkin(group, i);
        npc.replaceWithAvatar(group);
      } catch (e) {
        console.warn(`Failed to load GLB avatar for ${npc.npcName}, using procedural fallback:`, e);
        const path = `/models/avatars/${npc.npcName.toLowerCase()}`;
        const layers = await this.avatarSys.loadAvatar(npc.avatarId, path, npc.npcColor, i);
        if (layers.body || layers.dressed) {
          const group = this.avatarSys.getAvatarGroup(npc.avatarId, npc);
          if (group) npc.replaceWithAvatar(group);
        }
      }
    }
  }

  /** Cache of skin texture sets per NPC index (2048x2048 PBR atlas) */
  private skinCache = new Map<number, ReturnType<typeof generateSkinAtlas>>();

  /** Generate procedural PBR skin and apply to the loaded GLB avatar group */
  private applyProceduralSkin(group: Group, npcIndex: number) {
    // Find the shared _Body material and skin-only meshes
    let bodyMat: MeshStandardMaterial | null = null;
    const eyeTeethMeshes: Mesh[] = [];
    const bodyMeshes: Mesh[] = [];
    group.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const mat = child.material;
      if (mat instanceof MeshStandardMaterial && mat.name === '_Body') {
        bodyMat = mat;
        const name = child.name.toLowerCase();
        if (name.includes('eye') || name.includes('teeth') || name.includes('gland')) {
          eyeTeethMeshes.push(child);
        } else {
          bodyMeshes.push(child);
        }
      }
    });
    if (!bodyMat) return;

    // Generate or retrieve cached skin textures
    let skin = this.skinCache.get(npcIndex);
    if (!skin) {
      const tones = [
        '#e8c4a0', '#d4a574', '#c4956a', '#8d5524',
        '#f0d0b0', '#deb887', '#cd853f', '#a0522d',
      ];
      skin = generateSkinAtlas(2048, 2048, tones[npcIndex % tones.length], npcIndex);
      this.skinCache.set(npcIndex, skin);
    }

    // Clone the material for body meshes so we don't affect eyes/teeth
    const bm = bodyMat as MeshStandardMaterial;
    const skinMat = bm.clone();
    skinMat.name = 'Skin_PBR';
    skinMat.map = skin.albedo;
    skinMat.normalMap = skin.normal;
    skinMat.roughnessMap = skin.roughness;
    skinMat.aoMap = skin.ao;
    skinMat.normalScale?.set(0.8, 0.8);
    skinMat.roughness = 0.6;
    skinMat.metalness = 0;
    skinMat.needsUpdate = true;

    for (const m of bodyMeshes) m.material = skinMat;

    // Give eyes/teeth a simple white material so they don't render skin-colored
    for (const m of eyeTeethMeshes) {
      const whiteMat = bm.clone();
      whiteMat.name = 'EyeTeeth';
      const isEye = m.name.toLowerCase().includes('eye');
      whiteMat.color.setHex(isEye ? 0xeeeeee : 0xffffff);
      whiteMat.map = null;
      whiteMat.normalMap = null;
      whiteMat.roughnessMap = null;
      whiteMat.aoMap = null;
      whiteMat.roughness = isEye ? 0.1 : 0.3;
      whiteMat.metalness = 0;
      whiteMat.needsUpdate = true;
      m.material = whiteMat;
    }
  }

  /** Reload avatars from the GLB map (used after restoring a saved game) */
  async reloadAvatars() {
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      const filename = this.avatarGLBMap.get(npc.npcName);
      if (!filename) continue;
      try {
        const gltf = await this.avatarSys.loadGLTF(`/models/${filename}`);
        const group = gltf.scene.clone(true) as Group;
        const bbox = new Box3().setFromObject(group);
        const height = bbox.max.y - bbox.min.y;
        if (height > 0) {
          const scale = 1.6 / height;
          group.scale.set(scale, scale, scale);
        }
        const bbox2 = new Box3().setFromObject(group);
        group.position.y = -bbox2.min.y;
        this.applyProceduralSkin(group, i);
        npc.replaceWithAvatar(group);
      } catch (e) {
        console.warn(`reloadAvatars: failed for ${npc.npcName}:`, e);
      }
    }
  }

  private syncRelationships() {
    this.relMap.clear();
    for (const npc of this.npcs) {
      const map = new Map<string, number>();
      for (const other of this.npcs) {
        if (other.npcName !== npc.npcName) {
          map.set(other.npcName, this.relationships.get(npc.npcName, other.npcName));
        }
      }
      this.relMap.set(npc.npcName, map);
    }
  }

  getClosestNPC(pos: { x: number; z: number }, maxDist = 3): NPC | undefined {
    let closest: NPC | undefined;
    let closestDist = maxDist;
    for (const npc of this.npcs) {
      if (!npc.visible) continue;
      const dx = pos.x - npc.position.x;
      const dz = pos.z - npc.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < closestDist) { closestDist = dist; closest = npc; }
    }
    return closest;
  }

  get nudeNames() { return this._nudeNames; }

  private processClothing(simDt: number) {
    const allNames = this.npcs.map(n => n.npcName);
    this._nudeNames = [];

    for (const npc of this.npcs) {
      if (!npc.visible) continue;

      const activityTransition = npc.clothing.getTransitionForActivity(npc.currentActivity);
      if (activityTransition && npc.clothing.canTransition(npc.npcName, activityTransition)) {
        // Exhibitionist NPCs: prefer nudity/towel over covering up
        const showOff = npc.personality.extraversion * 0.4 + npc.personality.openness * 0.3 + npc.libido * 0.3;
        const wantsAttention = npc.needs.values.social < 0.6;

        let targetState = activityTransition;

        // If the activity suggests nudity (showering), they'll do it nude — no modesty check
        // If lounging and feeling attention-starved, strip!
        if (targetState === 'sleepwear') {
          // Exhibitionists skip straight to nude/towel instead of pajamas
          if (Math.random() < showOff) {
            targetState = Math.random() < 0.5 ? 'nude' : 'towel';
          }
        }
        if (targetState === 'changing') {
          // Changing: go all the way to nude if they feel like showing off
          if (Math.random() < showOff * 0.7 + (wantsAttention ? 0.2 : 0)) {
            targetState = Math.random() < 0.6 ? 'nude' : 'towel';
          }
        }

        const event = npc.clothing.transition(npc.npcName, targetState, npc.currentRoom,
          this.clock.day, this.clock.timeString, allNames);
        if (event) {
          this.avatarSys.setClothing(npc.avatarId, event.to);
          this.syncAvatarClothing(npc);
        }
      }

      npc.socialCooldown = Math.max(0, npc.socialCooldown - simDt);

      if (npc.isNude() && !this._nudeNames.includes(npc.npcName)) {
        this._nudeNames.push(npc.npcName);
      }
    }
  }

  private syncAvatarClothing(npc: NPC) {
    const group = this.avatarSys.getAvatarGroup(npc.avatarId, npc);
    if (group) npc.replaceWithAvatar(group);
  }

  private processIntimacy(day: number) {
    for (const a of this.npcs) {
      if (!a.visible) continue;
      for (const b of this.npcs) {
        if (a === b || !b.visible) continue;
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        if (dx * dx + dz * dz > 4) continue;

        const aff = this.relationships.get(a.npcName, b.npcName);
        const libidoAvg = (a.libido + b.libido) / 2;
        const event = this.intimacy.processPair(
          a.npcName, b.npcName, aff, a.currentRoom,
          day, this.clock.timeString, this.clock.hours, this.relationships,
          libidoAvg,
        );
        // Record intimacy events in NPC memory
        if (event) {
          for (const n of [a, b]) {
            n.memory.record('intimate', [n.npcName, event.npcA, event.npcB], event.room,
              event.description, 0.5, 0.7, day, this.clock.timeString);
          }
        }
      }
    }
  }

  /** Active multi-turn conversations: key = "speaker|listener", value = turns remaining */
  private activeConvs = new Map<string, number>();

  private processConversations(simDt: number) {
    const day = this.clock.day;

    // 1. Advance existing multi-turn conversations
    for (const [key, turnsLeft] of this.activeConvs) {
      const [aName, bName] = key.split('|');
      const a = this.npcs.find(n => n.npcName === aName);
      const b = this.npcs.find(n => n.npcName === bName);
      if (!a || !b || !a.visible || !b.visible || a.isEvicted || b.isEvicted || turnsLeft <= 0) {
        this.activeConvs.delete(key);
        if (a) a.conversingWith = null;
        if (b) b.conversingWith = null;
        continue;
      }

      // One NPC speaks per tick in the conversation (alternating)
      const speaker = turnsLeft % 2 === 0 ? a : b;
      const listener = speaker === a ? b : a;

      // Skip if either is on social cooldown
      if (speaker.socialCooldown > 0) continue;

      const context = this.buildConversationContext(speaker, listener, true);
      const history = speaker.dialogueHistory.slice(-5);

      this.brain.think(speaker.npcName, context, history).then(reply => {
        const line = `${speaker.npcName} to ${listener.npcName}: "${reply}"`;
        speaker.dialogueHistory.push(line);
        listener.dialogueHistory.push(line);
        this.conversations.push({
          speaker: speaker.npcName,
          listener: listener.npcName,
          text: reply,
          room: speaker.currentRoom,
        });

        // Process strategic content in reply
        this.processStrategicReply(speaker, listener, reply);

        // Update beliefs from what was said
        const replyLower = reply.toLowerCase();
        const wasFriendly = replyLower.includes('nice') || replyLower.includes('like') || replyLower.includes('trust') || replyLower.includes('good') || replyLower.includes('ally');
        const wasHostile = replyLower.includes('hate') || replyLower.includes('betray') || replyLower.includes('against') || replyLower.includes('problem');
        speaker.beliefs.observeInteraction(listener.npcName, wasFriendly ? 0.1 : wasHostile ? -0.1 : 0, wasFriendly);
        listener.beliefs.observeInteraction(speaker.npcName, wasFriendly ? 0.05 : 0, wasFriendly);

        // Update relationships based on conversation tone
        if (wasFriendly) {
          this.relationships.adjust(speaker.npcName, listener.npcName, 0.02);
          this.relationships.adjust(listener.npcName, speaker.npcName, 0.02);
        } else if (wasHostile) {
          this.relationships.adjust(speaker.npcName, listener.npcName, -0.03);
          this.relationships.adjust(listener.npcName, speaker.npcName, -0.03);
        }

        // Learn physicality from conversation (both learn about each other)
        if (!speaker.knownPhysicality.has(listener.npcName)) {
          speaker.knownPhysicality.set(listener.npcName, listener.physicalDesc);
        }
        if (!listener.knownPhysicality.has(speaker.npcName)) {
          listener.knownPhysicality.set(speaker.npcName, speaker.physicalDesc);
        }

        // Record in memory stream
        const day = this.clock.day;
        speaker.memoryStream.observe(
          `Had a conversation with ${listener.npcName}: "${reply.substring(0, 80)}"`,
          wasFriendly ? 4 : wasHostile ? 6 : 3,
          'conversation', [speaker.npcName, listener.npcName],
          speaker.currentRoom, speaker.emotion.primary, day, this.clock.timeString,
        );

        // Update theory of mind
        speaker.theoryOfMind.updateFromConversation(listener.npcName, reply, wasFriendly, day);
        listener.theoryOfMind.updateFromConversation(speaker.npcName, reply, wasFriendly, day);

        // Periodically (10% chance) do deep ToM inference
        if (Math.random() < 0.1 && speaker.theoryOfMind['lastInferenceTime'] < day) {
          const otherActions = listener.visualContext.slice(0, 3);
          speaker.theoryOfMind.inferOtherMind(
            this.brain, speaker.npcName, listener.npcName,
            otherActions, speaker.beliefs, speaker.memoryStream, day,
          ).catch(() => {});
        }
      });

      // Reduce remaining turns
      const newTurns = turnsLeft - 1;
      if (newTurns <= 0) {
        this.activeConvs.delete(key);
        a.conversingWith = null;
        b.conversingWith = null;
      } else {
        this.activeConvs.set(key, newTurns);
      }

      // Cooldown so each turn doesn't fire instantly
      speaker.socialCooldown = 3 + Math.random() * 2;
      return; // one turn per tick
    }

    // 2. Start new conversations between nearby NPCs
    this.convCooldown -= simDt;
    if (this.convCooldown > 0) return;

    const candidates = this.npcs.filter(n => n.visible && !n.isEvicted && !n.conversingWith);

    for (const speaker of candidates) {
      if (speaker.socialCooldown > 0) continue;
      if (Math.random() > 0.15) continue; // 15% chance per tick

      // Update strategic attributes
      speaker.evictionFear = this.evictionCandidates.includes(speaker.npcName) ? 0.7 + Math.random() * 0.3
        : Math.max(0, speaker.evictionFear - 0.05);
      speaker.desperation = speaker.evictionFear * (0.5 + speaker.personality.extraversion * 0.3);
      speaker.prizeAwareness = Math.min(1, speaker.prizeAwareness + 0.01 * day);

      for (const listener of candidates) {
        if (listener === speaker) continue;
        if (listener.socialCooldown > 0) continue;
        if (speaker.currentRoom !== listener.currentRoom) continue;
        const dx = speaker.position.x - listener.position.x;
        const dz = speaker.position.z - listener.position.z;
        if (dx * dx + dz * dz > 25) continue;

        // Decide conversation length based on personality and relationship
        const aff = this.relationships.get(speaker.npcName, listener.npcName);
        const baseTurns = 3 + Math.floor(Math.random() * 3); // 3-5 exchanges
        const affinityBonus = aff > 0.3 ? 2 : aff < -0.3 ? -1 : 0;
        const extroBonus = speaker.personality.extraversion > 0.6 ? 1 : 0;
        const totalTurns = Math.max(2, baseTurns + affinityBonus + extroBonus);

        const key = `${speaker.npcName}|${listener.npcName}`;
        this.activeConvs.set(key, totalTurns);
        speaker.conversingWith = listener.npcName;
        listener.conversingWith = speaker.npcName;

        // Both get a cooldown so they don't immediately start a new conversation
        speaker.socialCooldown = 5 + Math.random() * 3;
        listener.socialCooldown = 5 + Math.random() * 3;

        // Build context and generate the first line
        const context = this.buildConversationContext(speaker, listener, false);

        // Remember recent memories about the listener
        const memories = speaker.memory.recallAbout(listener.npcName, 2);
        const memStr = memories.length > 0
          ? ` Recent memories: ${memories.map(m => m.summary).join('; ')}.`
          : '';

        this.brain.think(speaker.npcName, context + memStr, speaker.dialogueHistory.slice(-3))
          .then(reply => {
            const line = `${speaker.npcName} to ${listener.npcName}: "${reply}"`;
            speaker.dialogueHistory.push(line);
            listener.dialogueHistory.push(line);
            this.conversations.push({
              speaker: speaker.npcName,
              listener: listener.npcName,
              text: reply,
              room: speaker.currentRoom,
            });

            this.processStrategicReply(speaker, listener, reply);

            // Learn physicality from conversation
            if (!speaker.knownPhysicality.has(listener.npcName)) {
              speaker.knownPhysicality.set(listener.npcName, listener.physicalDesc);
            }
            if (!listener.knownPhysicality.has(speaker.npcName)) {
              listener.knownPhysicality.set(speaker.npcName, speaker.physicalDesc);
            }

            // Record memory of the conversation start
            speaker.memory.record('conversation', [speaker.npcName, listener.npcName],
              speaker.currentRoom, `Started talking to ${listener.npcName}`, 0.3, 0.4, day, this.clock.timeString);
            speaker.memoryStream.observe(
              `Started a conversation with ${listener.npcName}`,
              4, 'conversation', [speaker.npcName, listener.npcName],
              speaker.currentRoom, speaker.emotion.primary, day, this.clock.timeString,
            );

            // Update beliefs
            speaker.beliefs.ensureOther(listener.npcName);
            listener.beliefs.ensureOther(speaker.npcName);
          });

        this.convCooldown = 1;
        return; // one new conversation per tick
      }
    }
  }

  /** Build a rich context string for the NPC's brain prompt (compressed format) */
  private buildConversationContext(speaker: NPC, listener: NPC, isContinuing: boolean): string {
    const rel = this.relationships.get(speaker.npcName, listener.npcName);
    const relCode = TokenCompressor.formatRel(listener.npcName, rel);

    // Compressed room context
    const vis = speaker.visualContext.length > 0
      ? `|VIS:${TokenCompressor.compressEntities(speaker.visualContext.join('; '))}`
      : '';

    // Strategic — compressed
    const isAllied = speaker.alliance.includes(listener.npcName);
    const allied = isAllied ? '|ALLY' : '';
    const betray = speaker.betrayalPlans.includes(listener.npcName) ? '|BETRAY' : '';
    const prize = speaker.prizeAwareness > 0.5 ? '|£2M:DESPERATE' : '|£2M';
    const fear = speaker.evictionFear > 0.5 ? '|EVICT:SCARED' : '';
    const tasks = speaker.completedTaskCount > 0 ? `|TASKS:${speaker.completedTaskCount}` : '';

    // Active tasks for this NPC
    let activeTaskStr = '';
    if (this.taskSystem) {
      const myTasks = this.taskSystem.getTasksFor(speaker.npcName);
      if (myTasks.length > 0) {
        activeTaskStr = `|MYTASKS:${myTasks.map((t: any) => TokenCompressor.compressEntities(t.description)).join(';')}`;
      }
    }

    // Recent events
    const recentStr = this.recentEvents.length > 0
      ? `|EVENTS:${TokenCompressor.compressEntities(this.recentEvents.slice(-3).join('; '))}`
      : '';

    const eviction = this.evictionCandidates.length > 0 ? `|EVICT_CAND:${this.evictionCandidates.map(n => TokenCompressor.compressEntities(n)).join(',')}` : '';

    // Personality — compressed
    const p = speaker.personality;
    const pers = `P:EX${(p.extraversion * 100).toFixed(0)}/AG${(p.agreeableness * 100).toFixed(0)}/NE${(p.neuroticism * 100).toFixed(0)}/CO${(p.conscientiousness * 100).toFixed(0)}`;

    // Needs — compressed
    const needs = TokenCompressor.formatNeeds(speaker.needs.values);
    const mood = `${speaker.emotion.primary}:${(speaker.emotion.intensity * 100).toFixed(0)}`;

    // Beliefs about listener — compressed
    const trust = speaker.beliefs.getTrust(listener.npcName);
    const threat = speaker.beliefs.getThreat(listener.npcName);
    const pop = speaker.beliefs.getPopularity(listener.npcName);
    const beliefs = `B:TR${(trust * 100).toFixed(0)}/TH${(threat * 100).toFixed(0)}/PO${(pop * 100).toFixed(0)}`;

    // Self-beliefs
    const sb = speaker.beliefs;
    const selfB = `SELF:CF${(sb.confidence * 100).toFixed(0)}/WN${(sb.winBelief * 100).toFixed(0)}/CN${(sb.cunning * 100).toFixed(0)}`;

    // Theory of mind — compressed one-liner
    const tom = speaker.theoryOfMind.describeInferenceCompact(listener.npcName);
    const tomNote = tom ? `|${tom}` : '';

    // Physical self-awareness
    const myPhys = `PHYS:ME=${speaker.physicalDesc}`;
    const knownPhys = speaker.knownPhysicality.get(listener.npcName);
    const theirPhys = knownPhys
      ? `THEM=${knownPhys}`
      : `THEM=unknown`;
    const physNote = `|${myPhys}/${theirPhys}`;

    const continuing = isContinuing ? '|CONT' : '|START';

    // Assemble compressed context (compact but all info preserved)
    const ctx = `${TokenCompressor.compressEntities(speaker.npcName)}→${TokenCompressor.compressEntities(listener.npcName)}@${TokenCompressor.compressEntities(speaker.currentRoom)}|${relCode}${allied}${betray}${prize}${fear}${tasks}${activeTaskStr}${recentStr}${eviction}${vis}|${pers}|${needs}|${mood}|${beliefs}|${selfB}${physNote}${tomNote}${continuing}`;

    return ctx;
  }

  /** Detect and process strategic conversation content */
  private processStrategicReply(speaker: NPC, listener: NPC, reply: string) {
    const replyLower = reply.toLowerCase();

    // Alliance formation
    if (replyLower.includes('ally') || replyLower.includes('pact') || replyLower.includes('vote together') || replyLower.includes('team up')) {
      if (!speaker.alliance.includes(listener.npcName)) {
        speaker.alliance.push(listener.npcName);
        if (!listener.alliance.includes(speaker.npcName)) {
          listener.alliance.push(speaker.npcName);
        }
        this.relationships.adjust(speaker.npcName, listener.npcName, 0.2);
        this.relationships.adjust(listener.npcName, speaker.npcName, 0.2);
        speaker.beliefs.formAlliance(listener.npcName);
        listener.beliefs.formAlliance(speaker.npcName);
      }
    }

    // Promises
    if (replyLower.includes('promise') || replyLower.includes("i'll") || replyLower.includes('i will')) {
      speaker.campaignPromises.set(listener.npcName, reply.substring(0, 60));
    }

    // Betrayal / backstabbing
    if (replyLower.includes('betray') || replyLower.includes('backstab') || replyLower.includes('against') || replyLower.includes('nominate')) {
      if (replyLower.includes(listener.npcName.toLowerCase())) {
        // Threatening the listener directly
        this.relationships.adjust(listener.npcName, speaker.npcName, -0.1);
        listener.beliefs.observeInteraction(speaker.npcName, -0.1, false);
      } else {
        // Plotting against someone else
        if (!speaker.betrayalPlans.includes(listener.npcName)) {
          speaker.betrayalPlans.push(listener.npcName);
          speaker.beliefs.planBetrayal(listener.npcName);
          this.relationships.adjust(listener.npcName, speaker.npcName, -0.05);
        }
      }
    }

    // Gossip about others
    for (const other of this.npcs) {
      if (other === speaker || other === listener) continue;
      if (replyLower.includes(other.npcName.toLowerCase())) {
        // Spreading reputation
        if (replyLower.includes('nice') || replyLower.includes('good') || replyLower.includes('great')) {
          other.beliefs.ensureOther(speaker.npcName);
          // Positive gossip slightly boosts the gossiper's trust
          listener.beliefs.ensureOther(other.npcName);
          listener.beliefs.observeInteraction(other.npcName, 0.05, true);
        } else if (replyLower.includes('bad') || replyLower.includes('weird') || replyLower.includes('annoy')) {
          listener.beliefs.ensureOther(other.npcName);
          listener.beliefs.observeInteraction(other.npcName, -0.05, false);
        }
      }
    }
  }

  update(dt: number) {
    const simDt = dt * (this.clock.paused ? 0 : this.clock.speed);
    this.syncRelationships();

    // Sync each NPC's local affinity from the central relationship graph
    for (const npc of this.npcs) {
      for (const other of this.npcs) {
        if (other === npc) continue;
        npc.affinity.set(other.npcName, this.relationships.get(npc.npcName, other.npcName));
      }
    }

    const hour = this.clock.hours;
    const day = this.clock.day;
    const time = this.clock.timeString;

    // Build visual context per room — what each NPC can "see"
    const roomVisuals = new Map<string, string[]>();
    for (const npc of this.npcs) {
      if (!npc.visible || npc.isEvicted) continue;
      const room = npc.currentRoom;
      if (!roomVisuals.has(room)) roomVisuals.set(room, []);
      const cloth = npc.clothing.getState(npc.npcName);
      const clothNote = cloth === 'nude' ? ' (naked)' : cloth === 'towel' ? ' (in towel)' : '';
      roomVisuals.get(room)!.push(`${npc.npcName}${clothNote} is ${npc.currentActivity}`);
    }

    for (const npc of this.npcs) {
      if (!npc.visible) continue;
      if (npc.isEvicted) continue;

      if (this.physics) {
        npc.updatePhysics(dt, this.physics);
        npc.syncFromPhysics(this.physics);
      }

      npc.updateAnimation(dt);

      const room = this.house.getRoomAt(npc.position.x, npc.position.z);
      npc.currentRoom = room?.name ?? 'Unknown';

      // Attach visual context: what the NPC sees in their current room
      npc.visualContext = roomVisuals.get(npc.currentRoom) ?? [];

      npc.think(simDt, hour, day, time, this.npcs, this.relMap, this.brain);
    }

    this.processClothing(simDt);
    this.processIntimacy(day);
    this.processConversations(simDt);
    this.avatarSys.updateMixers(dt);
  }
}
