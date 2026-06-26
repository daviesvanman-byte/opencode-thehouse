import type { NPC } from './NPC';
import type { ClothingStateMachine } from './ClothingState';
import type { RelationshipGraph } from '../simulation/Relationship';
import type { IntimacySystem } from '../simulation/Intimacy';
import type { DiarySystem } from './DiaryRoom';
import type { TaskSystem } from './TaskSystem';
import type { NominationSystem } from '../simulation/Nominations';
import type { SimulationClock } from './SimulationClock';
import type { ReplayFrame } from './TaskRecorder';

const DB_NAME = 'TheHouseSave';
const DB_VERSION = 1;
const STORE = 'saves';
const SAVE_KEY = 'gameState';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SaveData {
  version: number;
  timestamp: number;
  clock: { elapsed: number; paused: boolean; speed: number };
  npcs: NpcSaveData[];
  clothing: { states: [string, string][]; privacyBlurEnabled: boolean; eventLog: ClothingEventSave[] };
  relationships: [string, string, number][];
  intimacy: { pairings: [string, string][]; events: IntimacyEventSave[] };
  diary: { confessions: ConfessionSave[] };
  tasks: TaskSave[];
  taskRecordings: [string, ReplayFrame[]][];
  nominations: {
    week: number; nextNominationsDay: number; evictedNames: string[];
    results: NominationResultSave[];
  };
  conversations: { speaker: string; listener: string; text: string; room: string }[];
}

interface NpcSaveData {
  npcName: string; npcColor: string; gender: string; libido: number;
  personality: Record<string, number>;
  position: { x: number; y: number; z: number };
  rotationY: number;
  state: string;
  action: { type: string; targetRoom: string; duration: number; priority: number } | null;
  actionTimer: number;
  needs: { values: Record<string, number> };
  emotion: { primary: string; intensity: number };
  physiology: { fatigue: number; hydration: number; health: number; energy: number };
  memory: { nextId: number; events: unknown[] };
  dialogueHistory: string[];
  affinity: [string, number][];
  thinkCooldown: number; socialCooldown: number;
  homeRoom: string; currentRoom: string; currentActivity: string;
  lastDialogueTime: number; isEvicted: boolean;
  avatarGLB: string;
}

interface ClothingEventSave { npcName: string; from: string; to: string; room: string; day: number; timestamp: string; witnesses: string[] }
interface IntimacyEventSave { type: string; npcA: string; npcB: string; description: string; day: number; timestamp: string; room: string }
interface ConfessionSave { npcName: string; day: number; timestamp: string; text: string; targets: string[] }
interface TaskSave { npcName: string; description: string; bonus: string; requiredActivity: string; deadlineDay: number; deadlineHour: number; assignedDay: number; assignedHour: number; completed: boolean; failed: boolean }
interface NominationResultSave { week: number; evictionCandidate1: string; evictionCandidate2: string; evicted: string | null; nominations: { nominator: string; target: string; reason: string }[] }

export class SaveManager {
  private ready: Promise<IDBDatabase>;

  constructor() { this.ready = openDB(); }

  async save(data: SaveData): Promise<void> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(): Promise<SaveData | null> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(SAVE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async exists(): Promise<boolean> {
    return (await this.load()) !== null;
  }

  async delete(): Promise<void> {
    const db = await this.ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  captureState(
    clock: SimulationClock,
    npcs: NPC[],
    clothing: ClothingStateMachine,
    relationships: RelationshipGraph,
    intimacy: IntimacySystem,
    diary: DiarySystem,
    tasks: TaskSystem,
    nominations: NominationSystem,
    conversations: { speaker: string; listener: string; text: string; room: string }[],
    taskRecordings?: [string, ReplayFrame[]][],
    npcAvatarMap?: Map<string, string>,
  ): SaveData {
    // Aggregate clothing states from all NPCs (each NPC has its own ClothingStateMachine)
    const allClothingStates: [string, string][] = npcs.map(n => [n.npcName, n.clothing.getState(n.npcName)]);
    const allEvents: ClothingEventSave[] = npcs.flatMap(n =>
      n.clothing.getEvents().map(e => ({
        npcName: e.npcName, from: e.from, to: e.to, room: e.room,
        day: e.day, timestamp: e.timestamp, witnesses: [...e.witnesses],
      }))
    );
    return {
      version: 1,
      timestamp: Date.now(),
      clock: { elapsed: clock.elapsed, paused: clock.paused, speed: clock.speed },
      npcs: npcs.map(n => ({
        npcName: n.npcName,
        npcColor: n.npcColor,
        gender: n.gender,
        libido: n.libido,
        personality: { ...n.personality },
        position: { x: n.position.x, y: n.position.y, z: n.position.z },
        rotationY: n.rotation.y,
        state: n.state,
        action: n.action ? { type: n.action.type, targetRoom: n.action.targetRoom, duration: n.action.duration, priority: n.action.priority } : null,
        actionTimer: n.actionTimeRemaining,
        needs: { values: { ...n.needs.values } },
        emotion: { primary: n.emotion.primary, intensity: n.emotion.intensity },
        physiology: { fatigue: n.physiology.fatigue, hydration: n.physiology.hydration, health: n.physiology.health, energy: n.physiology.energy },
        memory: { nextId: n.memory.nextId, events: n.memory.events },
        dialogueHistory: [...n.dialogueHistory],
        affinity: Array.from(n.affinity.entries()),
        thinkCooldown: n.thinkCD,
        socialCooldown: n.socialCooldown,
        homeRoom: n.homeRoomName,
        currentRoom: n.currentRoom,
        currentActivity: n.currentActivity,
        lastDialogueTime: n.lastDialogueTime,
        isEvicted: n.isEvicted,
        avatarGLB: npcAvatarMap?.get(n.npcName) ?? '',
      })),
      clothing: {
        states: allClothingStates,
        privacyBlurEnabled: clothing.privacyBlurEnabled,
        eventLog: allEvents,
      },
      relationships: relationships.getAllEdges(),
      intimacy: {
        pairings: intimacy.getAllPairings(),
        events: intimacy.getAllEvents() as IntimacyEventSave[],
      },
      diary: { confessions: diary.getConfessions() as ConfessionSave[] },
      tasks: tasks.tasks.map(t => ({
        npcName: t.npcName, description: t.description, bonus: t.bonus ?? '',
        requiredActivity: t.requiredActivity, deadlineDay: t.deadlineDay, deadlineHour: t.deadlineHour,
        assignedDay: t.assignedDay, assignedHour: t.assignedHour, completed: t.completed, failed: t.failed,
      })),
      taskRecordings: taskRecordings ?? [],
      nominations: {
        week: nominations.currentWeek,
        nextNominationsDay: nominations.nextNominationsDay,
        evictedNames: [...nominations.evictedNames],
        results: nominations.getNominationHistory().map(r => ({
          week: r.week, evictionCandidate1: r.evictionCandidate1,
          evictionCandidate2: r.evictionCandidate2, evicted: r.evicted ?? null,
          nominations: r.nominations.map(n => ({ nominator: n.nominator, target: n.target, reason: n.reason })),
        })),
      },
      conversations: [...conversations],
    };
  }

  restoreNPC(npc: NPC, data: NpcSaveData) {
    npc.position.set(data.position.x, data.position.y, data.position.z);
    npc.rotation.y = data.rotationY;
    npc.setState(data.state as 'idle' | 'walking' | 'acting');
    if (data.action) {
      npc.setAction(data.action.type, data.action.targetRoom, data.action.duration, data.action.priority);
      npc.actionTimeRemaining; // read to sync; setAction already sets actionTimer
    } else {
      npc.clearAction();
    }
    npc.needs.values = data.needs.values as Record<string, number>;
    npc.emotion.primary = data.emotion.primary as any;
    npc.emotion.intensity = data.emotion.intensity;
    Object.assign(npc.physiology, data.physiology);
    npc.memory.nextId = data.memory.nextId;
    npc.memory.events = data.memory.events as any[];
    npc.dialogueHistory = [...data.dialogueHistory];
    npc.affinity = new Map(data.affinity);
    npc.thinkCD = data.thinkCooldown;
    npc.socialCooldown = data.socialCooldown;
    npc.homeRoomName = data.homeRoom;
    npc.currentRoom = data.currentRoom;
    npc.currentActivity = data.currentActivity;
    npc.lastDialogueTime = data.lastDialogueTime;
    npc.isEvicted = data.isEvicted;
  }
}
