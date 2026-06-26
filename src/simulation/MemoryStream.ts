export type MemoryType = 'observation' | 'conversation' | 'interaction' | 'intimate' | 'conflict' | 'daily' | 'reflection' | 'plan' | 'nomination';

export interface MemoryEntry {
  id: number;
  type: MemoryType;
  timestamp: number;       // real-world ms
  gameDay: number;
  gameTime: string;
  description: string;
  importance: number;      // 0-10
  participants: string[];
  location: string;
  emotion: string;
}

/** Stanford-style memory stream: chronological + retrieval by recency·importance·relevance */
export class MemoryStream {
  private entries: MemoryEntry[] = [];
  private nextId = 0;

  /** Decay factor for recency — Stanford uses 0.99^hours */
  private static readonly RECENCY_DECAY = 0.99;
  /** Max entries before pruning low-importance old ones */
  private static readonly MAX_ENTRIES = 300;

  add(entry: Omit<MemoryEntry, 'id'>): MemoryEntry {
    const e: MemoryEntry = { id: this.nextId++, ...entry };
    this.entries.push(e);
    this.prune();
    return e;
  }

  /** Record an observation (most common) */
  observe(
    description: string,
    importance: number,
    type: MemoryType = 'observation',
    participants: string[] = [],
    location: string = '',
    emotion: string = '',
    gameDay: number = 0,
    gameTime: string = '',
  ): MemoryEntry {
    return this.add({
      type, description, importance,
      timestamp: Date.now(),
      gameDay, gameTime,
      participants, location, emotion,
    });
  }

  /**
   * Stanford-style retrieval: score = recency^δ · importance · relevance
   * Uses keyword overlap for relevance (no embeddings needed).
   */
  retrieve(query: string, k = 15): MemoryEntry[] {
    const now = Date.now();
    const queryWords = this.tokenize(query);

    const scored = this.entries.map(e => {
      const ageHours = (now - e.timestamp) / (1000 * 3600);
      const recency = Math.pow(MemoryStream.RECENCY_DECAY, ageHours);
      const importance = e.importance / 10;
      const relevance = this.computeRelevance(queryWords, e);
      const score = recency * importance * relevance;
      return { entry: e, score };
    });

    return scored
      .filter(s => s.score > 0.01)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.entry);
  }

  /** Retrieve memories mentioning a specific person */
  retrieveAbout(name: string, k = 8): MemoryEntry[] {
    return this.entries
      .filter(e => e.participants.includes(name) || e.description.toLowerCase().includes(name.toLowerCase()))
      .map(e => ({ entry: e, score: e.importance / 10 * (e.participants.includes(name) ? 1.2 : 0.8) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.entry);
  }

  /** Retrieve memories at a location */
  retrieveAt(location: string, k = 8): MemoryEntry[] {
    return this.entries
      .filter(e => e.location === location)
      .map(e => ({ entry: e, score: e.importance / 10 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(s => s.entry);
  }

  /** Retrieve memories of a specific type */
  retrieveByType(type: MemoryType, k = 10): MemoryEntry[] {
    return this.entries
      .filter(e => e.type === type)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, k);
  }

  /** Get recent memories (by recency) */
  getRecent(k = 10): MemoryEntry[] {
    return [...this.entries].reverse().slice(0, k);
  }

  /** Get all entries */
  getAll(): MemoryEntry[] {
    return [...this.entries];
  }

  /** Get entries with importance >= threshold */
  getSignificant(threshold = 0.7): MemoryEntry[] {
    return this.entries.filter(e => e.importance >= threshold);
  }

  /** Accumulated importance of last N observations */
  getRecentImportance(n = 20): number {
    return this.entries.slice(-n).reduce((sum, e) => sum + e.importance, 0);
  }

  /** Describe recent memories for a prompt */
  describeRecent(k = 5): string {
    return this.getRecent(k).map(e =>
      `[${e.gameDay ? `Day ${e.gameDay}` : ''}${e.gameTime ? ` ${e.gameTime}` : ''}] ${e.description}`
    ).join('\n');
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text.toLowerCase()
        .replace(/[^a-z0-9\s']/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2)
    );
  }

  /** Keyword overlap relevance scoring */
  private computeRelevance(queryWords: Set<string>, entry: MemoryEntry): number {
    const entryWords = this.tokenize(entry.description);
    entryWords.add(entry.location.toLowerCase());
    entry.participants.forEach(p => entryWords.add(p.toLowerCase()));

    let overlap = 0;
    for (const w of queryWords) {
      if (entryWords.has(w)) overlap++;
      // Partial match for longer words
      for (const ew of entryWords) {
        if (ew.length > 4 && (ew.includes(w) || w.includes(ew))) overlap += 0.5;
      }
    }

    // Boost if participants or location match
    for (const p of entry.participants) {
      if (queryWords.has(p.toLowerCase())) overlap += 1;
    }
    if (queryWords.has(entry.location.toLowerCase())) overlap += 1;

    // Normalize: 1.0 if all query words match, scaled down otherwise
    return Math.min(1, overlap / Math.max(1, queryWords.size));
  }

  private prune() {
    if (this.entries.length <= MemoryStream.MAX_ENTRIES) return;
    // Remove oldest low-importance entries
    this.entries.sort((a, b) => {
      const imp = b.importance - a.importance;
      if (imp !== 0) return imp;
      return b.timestamp - a.timestamp;
    });
    this.entries = this.entries.slice(0, MemoryStream.MAX_ENTRIES);
    // Restore chronological order
    this.entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Restore from saved state */
  restore(entries: MemoryEntry[]) {
    this.entries = entries;
    this.nextId = Math.max(...entries.map(e => e.id), 0) + 1;
  }
}
