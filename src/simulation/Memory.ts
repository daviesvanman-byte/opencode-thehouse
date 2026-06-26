export interface MemoryEvent {
  id: number;
  type: 'conversation' | 'observation' | 'interaction' | 'intimate' | 'conflict' | 'daily' | 'clothing' | 'nomination';
  timestamp: number;
  day: number;
  time: string;
  participants: string[];
  location: string;
  summary: string;
  emotionalValence: number;
  importance: number;
}

export class Memory {
  events: MemoryEvent[] = [];
  nextId = 0;

  record(
    type: MemoryEvent['type'],
    participants: string[],
    location: string,
    summary: string,
    emotionalValence: number,
    importance: number,
    day: number,
    time: string,
  ): MemoryEvent {
    const event: MemoryEvent = {
      id: this.nextId++,
      type,
      timestamp: Date.now(),
      day,
      time,
      participants,
      location,
      summary,
      emotionalValence,
      importance,
    };
    this.events.push(event);
    this.prune();
    return event;
  }

  recall(type?: MemoryEvent['type'], limit = 10): MemoryEvent[] {
    let filtered = this.events;
    if (type) filtered = filtered.filter(e => e.type === type);
    const now = Date.now();
    return filtered
      .map(e => ({
        ...e,
        score: e.importance * (1 - (now - e.timestamp) / (14 * 24 * 3600 * 1000)),
      }))
      .filter(e => e.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  recallAbout(name: string, limit = 5): MemoryEvent[] {
    const now = Date.now();
    return this.events
      .filter(e => e.participants.includes(name))
      .map(e => ({
        ...e,
        score: e.importance * (1 - (now - e.timestamp) / (14 * 24 * 3600 * 1000)),
      }))
      .filter(e => e.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  recallAt(room: string, limit = 5): MemoryEvent[] {
    const now = Date.now();
    return this.events
      .filter(e => e.location === room)
      .map(e => ({
        ...e,
        score: e.importance * (1 - (now - e.timestamp) / (14 * 24 * 3600 * 1000)),
      }))
      .filter(e => e.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private prune() {
    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;
    this.events = this.events.filter(e => {
      const age = now - e.timestamp;
      return age < week * 2 || e.importance > 0.7;
    });
    if (this.events.length > 200) {
      this.events.sort((a, b) => b.importance - a.importance);
      this.events = this.events.slice(0, 200);
    }
  }

  getAll(): MemoryEvent[] {
    return [...this.events];
  }

  getSignificant(threshold = 0.6): MemoryEvent[] {
    return this.events.filter(e => e.importance >= threshold);
  }
}
