import type { NPCBrain } from '../api/NPCBrain';
import { MemoryStream } from './MemoryStream';
import type { Needs } from './Needs';
import type { EmotionalState } from './Needs';

export interface PlanEntry {
  description: string;
  location: string;
  targetNpc?: string;
}

/**
 * St anford-style hierarchical planning.
 * - Daily plan: high-level direction for the day
 * - Action plan: current sequence of actions derived from daily plan + current context
 */
export class PlanningSystem {
  dailyPlan: PlanEntry[] = [];
  currentPlanIndex = 0;
  planGeneratedAtDay = -1;
  private planGenerationHour = -1;

  /** Generate a daily plan using LLM */
  async generateDailyPlan(
    brain: NPCBrain,
    npcName: string,
    personality: string,
    memoryStream: MemoryStream,
    needs: Needs,
    emotion: EmotionalState,
    day: number,
    hour: number,
    allNpcNames: string[],
    evictionCandidates: string[],
  ): Promise<void> {
    // Get relevant memories and reflections
    const recentMemories = memoryStream.describeRecent(5);
    const reflections = memoryStream.retrieveByType('reflection', 3)
      .map(m => `- ${m.description}`).join('\n');

    const reflectionsStr = reflections ? `\nReflections:\n${reflections}` : '';
    const evictionStr = evictionCandidates.length > 0
      ? `\nUpcoming eviction: ${evictionCandidates.join(', ')}`
      : '';

    const prompt = `You are ${npcName}, ${personality}. Current time: Day ${day}, hour ${hour.toFixed(0)}:00.\n\nYour needs:\n- Social: ${(needs.values.social * 100).toFixed(0)}%\n- Energy: ${(needs.values.energy * 100).toFixed(0)}%\n- Hunger: ${(needs.values.hunger * 100).toFixed(0)}%\n- Hygiene: ${(needs.values.hygiene * 100).toFixed(0)}%\n- Fun: ${(needs.values.fun * 100).toFixed(0)}%\n\nMood: ${emotion.primary} (${(emotion.intensity * 100).toFixed(0)}%)\n\nRecent memories:\n${recentMemories}${reflectionsStr}${evictionStr}\n\nOther housemates: ${allNpcNames.join(', ')}.\n\nWhat is your plan for the rest of today? List 2-4 broad goals. Each goal should be one sentence. Examples:\n- "Spend time in the living room socializing with housemates"\n- "Cook a meal in the kitchen"\n- "Rest in my bedroom"\n- "Talk to [name] about the eviction"`;

    try {
      const result = await brain.thinkRaw(prompt);
      const lines = result.split('\n')
        .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^-\s*/, '').trim())
        .filter(l => l.length > 10 && !l.startsWith('*') && !l.startsWith('#'));

      this.dailyPlan = lines.slice(0, 4).map(l => ({
        description: l,
        location: this.inferLocation(l),
        targetNpc: this.inferTargetNpc(l, allNpcNames),
      }));
      this.currentPlanIndex = 0;
      this.planGeneratedAtDay = day;
      this.planGenerationHour = hour;

      // Record plan in memory
      memoryStream.observe(
        `Planned: ${this.dailyPlan.map(p => p.description).join('; ')}`,
        3, 'plan', [], '', personality, day, `${hour.toFixed(0)}:00`,
      );
    } catch {
      // Fallback: use basic plan based on needs
      this.dailyPlan = this.fallbackPlan(needs, day, hour);
    }
  }

  /** Get current action from the plan (or null if plan is exhausted) */
  getCurrentAction(): PlanEntry | null {
    if (this.currentPlanIndex >= this.dailyPlan.length) return null;
    return this.dailyPlan[this.currentPlanIndex];
  }

  /** Advance to the next plan item */
  advancePlan(): void {
    this.currentPlanIndex++;
  }

  /** Reset the plan (when replanning) */
  resetPlan(): void {
    this.currentPlanIndex = 0;
  }

  /** Check if this plan is stale (generated too long ago) */
  isStale(hour: number): boolean {
    // Replan every ~6 hours or when context changes significantly
    return Math.abs(hour - this.planGenerationHour) >= 6;
  }

  /** Describe current plan for context */
  describePlan(): string {
    if (this.dailyPlan.length === 0) return '';
    const remaining = this.dailyPlan.slice(this.currentPlanIndex);
    if (remaining.length === 0) return '';
    return `Current plan: ${remaining.map((p, i) => `${i + 1}. ${p.description}`).join(' ')}`;
  }

  private inferLocation(text: string): string {
    const locs: [RegExp, string][] = [
      [/kitchen|eat|cook|food|meal|dinner|breakfast/i, 'Kitchen'],
      [/living|tv|couch|sofa|socialize|chat|talk|convers/i, 'Living Room'],
      [/bath|shower|bathroom|wash|clean|hygiene/i, 'Bathroom'],
      [/bed|sleep|rest|nap|bedroom/i, 'Bedroom 1'],
      [/garden|outdoor|patio|fresh air|sun/i, 'Garden'],
      [/dining|dinner table|eat.*room/i, 'Dining Room'],
      [/diary|confess/i, 'Diary Room'],
      [/store|storage/i, 'Store Room'],
    ];
    for (const [regex, room] of locs) {
      if (regex.test(text)) return room;
    }
    return 'Living Room'; // default
  }

  private inferTargetNpc(text: string, allNames: string[]): string | undefined {
    for (const name of allNames) {
      if (text.toLowerCase().includes(name.toLowerCase())) return name;
    }
    return undefined;
  }

  private fallbackPlan(needs: Needs, _day: number, _hour: number): PlanEntry[] {
    const plan: PlanEntry[] = [];
    if (needs.values.hunger < 0.4) plan.push({ description: 'Get something to eat in the kitchen', location: 'Kitchen' });
    if (needs.values.energy < 0.3) plan.push({ description: 'Rest in my bedroom', location: 'Bedroom 1' });
    if (needs.values.social < 0.5) plan.push({ description: 'Socialize with housemates in the living room', location: 'Living Room' });
    if (needs.values.hygiene < 0.3) plan.push({ description: 'Take a shower', location: 'Bathroom' });
    if (plan.length === 0) plan.push({ description: 'Relax in the living room', location: 'Living Room' });
    return plan;
  }
}
