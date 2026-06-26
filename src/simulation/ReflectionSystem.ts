import type { NPCBrain } from '../api/NPCBrain';
import { MemoryStream, type MemoryEntry } from './MemoryStream';

/**
 * Stanford-style reflection system.
 * When accumulated importance of recent events exceeds a threshold,
 * the agent generates high-level abstract insights (reflections).
 */
export class ReflectionSystem {
  private importanceAccumulator = 0;
  private reflectionThreshold: number;
  private lastReflectionDay = -1;
  private maxReflectionsPerDay: number;

  /**
   * @param threshold importance sum needed to trigger reflection (Stanford: 150)
   * @param maxPerDay cap on reflections per game day
   */
  constructor(threshold = 100, maxPerDay = 4) {
    this.reflectionThreshold = threshold;
    this.maxReflectionsPerDay = maxPerDay;
  }

  /** Accumulate importance and trigger reflection if threshold crossed */
  tick(
    recentMemories: MemoryEntry[],
    memoryStream: MemoryStream,
    brain: NPCBrain,
    npcName: string,
    personality: string,
    day: number,
  ): void {
    // Add importance of new memories to accumulator
    for (const mem of recentMemories) {
      if (mem.type === 'reflection') continue; // don't reflect on reflections
      this.importanceAccumulator += mem.importance;
    }

    // Reset accumulator on new day
    if (day !== this.lastReflectionDay) {
      this.lastReflectionDay = day;
      this.importanceAccumulator = 0;
      return; // wait for events to build up
    }

    // Check threshold
    if (this.importanceAccumulator < this.reflectionThreshold) return;

    // Check max per day
    const reflectionsToday = memoryStream.retrieveByType('reflection', 100)
      .filter(m => m.gameDay === day).length;
    if (reflectionsToday >= this.maxReflectionsPerDay) {
      this.importanceAccumulator = 0; // reset anyway to avoid re-checking
      return;
    }

    // Generate reflections using LLM
    this.generateReflections(memoryStream, brain, npcName, personality, day);
    this.importanceAccumulator = 0;
  }

  /** Query LLM for high-level insights from recent significant memories */
  private async generateReflections(
    memoryStream: MemoryStream,
    brain: NPCBrain,
    npcName: string,
    personality: string,
    day: number,
  ) {
    // Get significant recent memories for reflection
    const recentSignificant = memoryStream.getAll()
      .filter(m => m.type !== 'reflection' && m.importance >= 5)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);

    if (recentSignificant.length < 3) return;

    const memDescriptions = recentSignificant.map(m =>
      `- ${m.description}${m.participants.length ? ` (with ${m.participants.join(', ')})` : ''}`
    ).join('\n');

    const prompt = `${npcName} (personality: ${personality}) reflects on recent events.\n\nStatements:\n${memDescriptions}\n\nGiven only the above statements, what 3-5 high-level insights can you infer about ${npcName}'s situation, relationships, or strategy? Keep each insight to one sentence.`;

    try {
      const result = await brain.thinkRaw(prompt);
      const insights = result.split('\n')
        .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^-\s*/, '').trim())
        .filter(l => l.length > 10);

      for (const insight of insights.slice(0, 5)) {
        const importance = 6 + Math.random() * 3; // reflections are fairly important
        memoryStream.observe(insight, importance, 'reflection', [], '', personality, day, '');
      }
    } catch {
      // Silently skip if LLM call fails
    }
  }

  /** Get current reflections for context */
  getRecentReflections(memoryStream: MemoryStream, k = 3): MemoryEntry[] {
    return memoryStream.retrieveByType('reflection', k);
  }
}
