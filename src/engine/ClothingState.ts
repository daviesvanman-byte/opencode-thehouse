export type ClothingState = 'dressed' | 'changing' | 'sleepwear' | 'towel' | 'nude' | 'swimwear';

export const CLOTHING_TRANSITIONS: Record<ClothingState, ClothingState[]> = {
  dressed: ['changing', 'sleepwear', 'swimwear', 'nude'],      // can strip directly
  changing: ['dressed', 'towel', 'nude', 'sleepwear', 'swimwear'],
  sleepwear: ['changing', 'dressed', 'nude', 'towel'],         // can strip from sleepwear
  towel: ['changing', 'dressed', 'nude', 'sleepwear'],         // towel → sleepwear shortcut
  nude: ['changing', 'towel', 'dressed', 'sleepwear', 'swimwear'], // nude → any covered state
  swimwear: ['changing', 'towel', 'dressed', 'nude'],          // can strip from swimwear
};

export interface ClothingEvent {
  npcName: string;
  from: ClothingState;
  to: ClothingState;
  room: string;
  day: number;
  timestamp: string;
  witnesses: string[];
}

export class ClothingStateMachine {
  private states = new Map<string, ClothingState>();
  private eventLog: ClothingEvent[] = [];
  private _privacyBlurEnabled = true;

  get privacyBlurEnabled() { return this._privacyBlurEnabled; }
  setPrivacyBlur(v: boolean) { this._privacyBlurEnabled = v; }

  getState(name: string): ClothingState {
    return this.states.get(name) ?? 'dressed';
  }

  canTransition(name: string, to: ClothingState): boolean {
    const current = this.getState(name);
    return CLOTHING_TRANSITIONS[current]?.includes(to) ?? false;
  }

  transition(
    name: string, to: ClothingState, room: string,
    day: number, timestamp: string, allNpcs: string[],
  ): ClothingEvent | null {
    if (!this.canTransition(name, to)) return null;

    const from = this.getState(name);
    this.states.set(name, to);

    const witnesses = allNpcs.filter(n =>
      n !== name && Math.random() < 0.4   // exhibitionist house: everyone notices everything
    );

    const event: ClothingEvent = { npcName: name, from, to, room, day, timestamp, witnesses };
    this.eventLog.push(event);
    return event;
  }

  isPrivate(state: ClothingState): boolean {
    return state === 'nude' || state === 'towel' || state === 'changing';
  }

  getTransitionForActivity(activity: string): ClothingState | null {
    switch (activity) {
      case 'sleeping': return 'sleepwear';
      case 'showering': return 'nude';
      case 'changing': return 'changing';
      case 'lounging': return Math.random() < 0.5 ? 'sleepwear' : null;
      default: return null;
    }
  }

  getEvents() { return [...this.eventLog]; }
  getEventsFor(npcName: string) {
    return this.eventLog.filter(e => e.npcName === npcName);
  }

  /** Get all NPC clothing states as [name, state] pairs */
  getAllStates(): [string, string][] {
    return Array.from(this.states.entries());
  }

  /** Bulk-restore clothing states from save data */
  restoreStates(states: [string, string][]) {
    this.states.clear();
    for (const [name, state] of states) {
      this.states.set(name, state as ClothingState);
    }
  }
}
