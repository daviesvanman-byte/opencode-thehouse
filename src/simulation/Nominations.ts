import { type RelationshipGraph } from './Relationship';
import type { NPC } from '../engine/NPC';
import type { IntimacyEvent } from './Intimacy';
import type { ClothingEvent } from '../engine/ClothingState';
import type { BigBrotherTask } from '../engine/TaskSystem';

export interface NominationResult {
  week: number;
  nominations: { nominator: string; target: string; reason: string }[];
  evictionCandidate1: string;
  evictionCandidate2: string;
  evicted: string | null;
}

export class NominationSystem {
  private week = 0;
  private results: NominationResult[] = [];
  private _nextNominationsDay = 7;
  private _evictedNames: string[] = [];

  get nextNominationsDay() { return this._nextNominationsDay; }
  get evictedNames() { return this._evictedNames; }
  get currentWeek() { return this.week; }
  get lastResult(): NominationResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  private generateReason(_nominator: NPC, target: NPC, _affinity: number): string {
    const reasons = [
      `${target.npcName} has been causing drama and it's bad for the house.`,
      `I think ${target.npcName} is the weakest link in the group.`,
      `${target.npcName} hasn't been pulling their weight around here.`,
      `I feel like ${target.npcName} is playing mind games with everyone.`,
      `Honestly? ${target.npcName} just irritates me. Time to go.`,
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  /** AI-driven nomination: an independent AI agent watches events and decides. Falls back to relationship voting. */
  async runAIDrivenNominations(
    npcs: NPC[],
    relationships: RelationshipGraph,
    intimacyEvents: IntimacyEvent[],
    clothingEvents: ClothingEvent[],
    tasks: BigBrotherTask[],
    brain?: { think: (name: string, context: string, history: string[]) => Promise<string> },
    dayRecap?: string[],
  ): Promise<NominationResult> {
    this.week++;
    this._nextNominationsDay += 7;

    const active = npcs.filter(n => !this._evictedNames.includes(n.npcName) && !n.immunity);
    if (active.length <= 2) {
      const result: NominationResult = {
        week: this.week, nominations: [],
        evictionCandidate1: active[0]?.npcName ?? '',
        evictionCandidate2: active[1]?.npcName ?? '',
        evicted: null,
      };
      this.results.push(result);
      return result;
    }

    // Try AI nomination
    if (brain && (intimacyEvents.length + clothingEvents.length > 0 || (dayRecap && dayRecap.length > 0))) {
      try {
        return await this.aiNominate(active, intimacyEvents, clothingEvents, tasks, brain, dayRecap);
      } catch {
        // fall through to relationship voting
      }
    }

    // Fallback: relationship-based voting
    return this.runNominations(active, relationships);
  }

  private async aiNominate(
    active: NPC[],
    intimacyEvents: IntimacyEvent[],
    clothingEvents: ClothingEvent[],
    tasks: BigBrotherTask[],
    brain: { think: (name: string, context: string, history: string[]) => Promise<string> },
    dayRecap?: string[],
  ): Promise<NominationResult> {
    const names = active.map(n => n.npcName).join(', ');

    // Gather recent highlights
    const recentIntimate = intimacyEvents.slice(-5).map(e =>
      `${e.npcA} & ${e.npcB}: ${e.description} (Day ${e.day})`
    ).join('\n');

    const recentClothing = clothingEvents.slice(-10).map(e =>
      `${e.npcName} changed from ${e.from} to ${e.to} in ${e.room} (Day ${e.day})`
    ).join('\n');

    const recentTasks = tasks.filter(t => t.completed || t.failed).slice(-5).map(t =>
      `${t.npcName} ${t.completed ? 'completed' : 'FAILED'} task: "${t.description}"`
    ).join('\n');

    const recentEvents = dayRecap ? dayRecap.slice(-10).join('\n') : '';

    const context = [
      `Big Brother housemates: ${names}`,
      '',
      'Recent intimate/drama moments:',
      recentIntimate,
      '',
      'Recent clothing/streaking moments:',
      recentClothing,
      '',
      'Recent task results:',
      recentTasks,
      '',
      'Recent day events:',
      recentEvents,
      '',
      'Based on the events above, who are the TWO most entertaining/controversial housemates',
      'that should face eviction? Choose two different people.',
      'Reply with ONLY their names separated by a comma, nothing else.',
    ].join('\n');

    const reply = await brain.think('Big Brother', context, []);
    const names2 = reply.split(',').map(s => s.trim()).filter(s => active.some(n => n.npcName === s));

    const evictionCandidate1 = names2[0] ?? active[Math.floor(Math.random() * active.length)].npcName;
    const evictionCandidate2 = names2[1] ?? active.find(n => n.npcName !== evictionCandidate1)?.npcName ?? evictionCandidate1;

    const evicted = Math.random() < 0.5 ? evictionCandidate1 : evictionCandidate2;
    if (evicted) this._evictedNames.push(evicted);

    const nominations = active.map(n => ({
      nominator: n.npcName,
      target: n.npcName === evictionCandidate1 ? evictionCandidate2 : evictionCandidate1,
      reason: 'The AI audience has spoken.',
    }));

    const result: NominationResult = { week: this.week, nominations, evictionCandidate1, evictionCandidate2, evicted };
    this.results.push(result);
    return result;
  }

  /** Legacy relationship-based nomination (fallback / manual) */
  runNominations(active: NPC[], relationships: RelationshipGraph): NominationResult {
    this.week++;
    this._nextNominationsDay += 7;

    if (active.length <= 2) {
      const result: NominationResult = {
        week: this.week,
        nominations: [],
        evictionCandidate1: active[0]?.npcName ?? '',
        evictionCandidate2: active[1]?.npcName ?? '',
        evicted: null,
      };
      this.results.push(result);
      return result;
    }

    const nominations: { nominator: string; target: string; reason: string }[] = [];

    for (const npc of active) {
      const others = active.filter(n => n.npcName !== npc.npcName);
      let lowestAffinity = Infinity;
      let lowestName = others[0].npcName;

      for (const other of others) {
        const aff = relationships.get(npc.npcName, other.npcName);
        if (aff < lowestAffinity) {
          lowestAffinity = aff;
          lowestName = other.npcName;
        }
      }

      const reason = this.generateReason(npc, active.find(n => n.npcName === lowestName)!, lowestAffinity);
      nominations.push({ nominator: npc.npcName, target: lowestName, reason });

      // Extra nomination votes from task rewards
      if (npc.nominatePower > 0) {
        for (let i = 0; i < npc.nominatePower; i++) {
          nominations.push({ nominator: npc.npcName, target: lowestName, reason: `${reason} (bonus nomination)` });
        }
        npc.nominatePower = 0;
      }
    }

    const voteCount = new Map<string, number>();
    for (const n of nominations) {
      voteCount.set(n.target, (voteCount.get(n.target) ?? 0) + 1);
    }

    const sorted = [...voteCount.entries()].sort((a, b) => b[1] - a[1]);
    const evictionCandidate1 = sorted[0][0];
    const evictionCandidate2 = sorted.length > 1 ? sorted[1][0] : sorted[0][0];

    const votesA = sorted[0][1];
    const votesB = sorted.length > 1 ? sorted[1][1] : 0;
    const totalVotes = votesA + votesB;
    const voteRatio = votesA / totalVotes;

    // If leading candidate has >50% of votes, evict them; otherwise random tiebreak
    const evicted = voteRatio > 0.5 ? evictionCandidate1
      : Math.random() < 0.5 ? evictionCandidate1 : evictionCandidate2;

    if (evicted) this._evictedNames.push(evicted);

    const result: NominationResult = {
      week: this.week,
      nominations,
      evictionCandidate1,
      evictionCandidate2,
      evicted,
    };

    this.results.push(result);
    return result;
  }

  getNominationHistory(): NominationResult[] {
    return [...this.results];
  }

  /** Restore full nomination state from save data */
  restore(data: { week: number; nextNominationsDay: number; evictedNames: string[]; results: NominationResult[] }) {
    this.week = data.week;
    this._nextNominationsDay = data.nextNominationsDay;
    this._evictedNames = [...data.evictedNames];
    this.results = data.results.map(r => ({ ...r }));
  }
}
