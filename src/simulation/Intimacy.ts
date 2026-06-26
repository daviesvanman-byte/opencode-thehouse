import { type RelationshipGraph } from './Relationship';

export type IntimacyLevel = 'none' | 'flirting' | 'crush' | 'romance' | 'showmance' | 'intimate';

export interface IntimacyEvent {
  type: 'flirt' | 'kiss' | 'cuddle' | 'intimate' | 'fight' | 'confession';
  npcA: string;
  npcB: string;
  description: string;
  day: number;
  timestamp: string;
  room: string;
}

export class IntimacySystem {
  private pairings = new Map<string, IntimacyLevel>();
  private events: IntimacyEvent[] = [];

  private key(a: string, b: string) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  getLevel(a: string, b: string): IntimacyLevel {
    return this.pairings.get(this.key(a, b)) ?? 'none';
  }

  getEventsFor(npcName: string): IntimacyEvent[] {
    return this.events.filter(e => e.npcA === npcName || e.npcB === npcName);
  }

  recordEvent(
    type: IntimacyEvent['type'], npcA: string, npcB: string,
    room: string, day: number, timestamp: string,
    relationships: RelationshipGraph,
  ): IntimacyEvent {
    const k = this.key(npcA, npcB);
    const currentLevel = this.pairings.get(k) ?? 'none';

    let newLevel = currentLevel;
    let description = '';

    switch (type) {
      case 'flirt':
        if (currentLevel === 'none') newLevel = 'flirting';
        description = `${npcA} flirted with ${npcB} in the ${room}`;
        relationships.adjust(npcA, npcB, 0.05);
        relationships.adjust(npcB, npcA, 0.03);
        break;
      case 'kiss':
        if (currentLevel === 'flirting' || currentLevel === 'crush') newLevel = 'romance';
        description = `${npcA} and ${npcB} shared a kiss in the ${room}`;
        relationships.adjust(npcA, npcB, 0.12);
        relationships.adjust(npcB, npcA, 0.12);
        break;
      case 'cuddle':
        if (currentLevel === 'romance') newLevel = 'showmance';
        description = `${npcA} and ${npcB} were cuddling in the ${room}`;
        relationships.adjust(npcA, npcB, 0.08);
        relationships.adjust(npcB, npcA, 0.08);
        break;
      case 'intimate':
        if (currentLevel === 'showmance' || currentLevel === 'romance') newLevel = 'intimate';
        description = `${npcA} and ${npcB} had an intimate moment in the ${room}`;
        relationships.adjust(npcA, npcB, 0.2);
        relationships.adjust(npcB, npcA, 0.2);
        break;
      case 'fight':
        if (currentLevel !== 'none') newLevel = 'none';
        description = `${npcA} and ${npcB} had an argument in the ${room}`;
        relationships.adjust(npcA, npcB, -0.15);
        relationships.adjust(npcB, npcA, -0.15);
        break;
      case 'confession':
        description = `${npcA} confessed feelings to ${npcB} in the ${room}`;
        if (currentLevel === 'flirting') newLevel = 'romance';
        relationships.adjust(npcA, npcB, 0.15);
        break;
    }

    if (newLevel !== currentLevel) {
      this.pairings.set(k, newLevel);
    }

    const event: IntimacyEvent = { type, npcA, npcB, description, day, timestamp, room };
    this.events.push(event);
    return event;
  }

  processPair(
    a: string, b: string, affinity: number, room: string,
    day: number, timestamp: string, hour: number, relationships: RelationshipGraph,
    libidoBoost = 1,
  ): IntimacyEvent | null {
    const level = this.getLevel(a, b);
    // High-libido NPCs are active almost all hours
    if (hour >= 2 && hour < 8) return null; // only skip deep-sleep window 2am-8am
    // Any room is fair game for exhibitionists
    if (room !== 'Living Room' && room !== 'Bedroom 1' && room !== 'Bedroom 2' && room !== 'Bedroom 3' && room !== 'Garden' && room !== 'Kitchen' && room !== 'Dining Room' && room !== 'Store Room') return null;

    const isBedroom = room.startsWith('Bedroom');

    // Intimate events: boosted by libido
    if (level === 'showmance' || level === 'intimate') {
      const chance = (isBedroom ? 0.12 : 0.06) * libidoBoost;
      if (Math.random() < chance) {
        return this.recordEvent('intimate', a, b, room, day, timestamp, relationships);
      }
    }

    if (affinity > 0.3 && level === 'none' && Math.random() < 0.04 * libidoBoost) {
      return this.recordEvent('flirt', a, b, room, day, timestamp, relationships);
    }
    if (affinity > 0.4 && level === 'flirting' && Math.random() < 0.06 * libidoBoost) {
      return this.recordEvent('kiss', a, b, room, day, timestamp, relationships);
    }
    if (affinity > 0.5 && (level === 'romance' || level === 'crush') && Math.random() < 0.08 * libidoBoost) {
      return this.recordEvent('cuddle', a, b, room, day, timestamp, relationships);
    }
    if (affinity < -0.3 && Math.random() < 0.02) {
      return this.recordEvent('fight', a, b, room, day, timestamp, relationships);
    }
    return null;
  }

  getAllIntimateEvents(): IntimacyEvent[] {
    return this.events.filter(e => e.type === 'intimate');
  }

  getShowmances(): { a: string; b: string; level: IntimacyLevel }[] {
    const result: { a: string; b: string; level: IntimacyLevel }[] = [];
    for (const [k, level] of this.pairings) {
      if (level !== 'none' && level !== 'flirting') {
        const [a, b] = k.split('|');
        result.push({ a, b, level });
      }
    }
    return result;
  }

  getAllEvents(): IntimacyEvent[] {
    return [...this.events];
  }

  /** Get all pairings as [key, level] entries */
  getAllPairings(): [string, string][] {
    return Array.from(this.pairings.entries());
  }

  /** Bulk-restore intimacy state from save data */
  restore(data: { pairings: [string, string][]; events: IntimacyEvent[] }) {
    this.pairings.clear();
    for (const [k, level] of data.pairings) {
      this.pairings.set(k, level as IntimacyLevel);
    }
    this.events = [...data.events];
  }
}
