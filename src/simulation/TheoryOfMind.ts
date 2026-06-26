import type { NPCBrain } from '../api/NPCBrain';
import type { MemoryStream } from './MemoryStream';
import { BeliefSystem } from './Belief';

/**
 * Theory of Mind — an agent's model of what other agents believe, want, and intend.
 * 
 * This is the highest layer of the brain. It enables:
 * - Recognizing that other agents have their own beliefs, goals, and strategies
 * - Inferring those mental states from observed behavior
 * - Using those inferences to inform conversation and strategy
 */
export class TheoryOfMind {
  /** For each other NPC, what THIS agent thinks THEY believe */
  readonly inferredBeliefs: Map<string, {
    thinksTheyArePopular: number;  // 0-1
    thinksTheyWillWin: number;     // 0-1
    trustInMe: number;             // 0-1
    fearsEviction: number;         // 0-1
    strategySummary: string;       // natural language
    lastUpdated: number;           // game day
  }> = new Map();

  lastInferenceTime = -1;

  /** Ensure we have a slot for another NPC */
  ensureOther(name: string, day: number) {
    if (!this.inferredBeliefs.has(name)) {
      this.inferredBeliefs.set(name, {
        thinksTheyArePopular: 0.3 + Math.random() * 0.4,
        thinksTheyWillWin: 0.2 + Math.random() * 0.3,
        trustInMe: 0.3 + Math.random() * 0.4,
        fearsEviction: 0.3 + Math.random() * 0.4,
        strategySummary: 'unknown strategy',
        lastUpdated: day,
      });
    }
  }

  /**
   * Infer what another NPC is thinking based on their recent actions.
   * Uses the LLM to make a theory-of-mind inference.
   */
  async inferOtherMind(
    brain: NPCBrain,
    myName: string,
    otherName: string,
    otherRecentActions: string[],
    _myBeliefs: BeliefSystem,
    myMemory: MemoryStream,
    day: number,
  ): Promise<void> {
    this.ensureOther(otherName, day);

    const actionsStr = otherRecentActions.length > 0
      ? otherRecentActions.join('\n')
      : 'No recent observations';

    const relevantMemories = myMemory.retrieveAbout(otherName, 5)
      .map(m => `- ${m.description}`).join('\n');

    const prompt = `You are ${myName} trying to figure out what ${otherName} is thinking. This is a Big Brother game where housemates compete for £2,000,000.\n\nWhat ${otherName} has been doing:\n${actionsStr}\n\nYour memories of ${otherName}:\n${relevantMemories}\n\nBased on this, answer these questions about ${otherName}:\n1. How popular do they think they are? (0-100)\n2. How much do they think they can win? (0-100)\n3. How much do they trust you? (0-100)\n4. How worried are they about eviction? (0-100)\n5. What do you think their game strategy is? (one sentence)\n\nFormat:\nPopularity: <number>\nWinChance: <number>\nTrustInMe: <number>\nEvictionFear: <number>\nStrategy: <text>`;

    try {
      const result = await brain.thinkRaw(prompt);
      const parsed = this.parseInference(result);
      this.inferredBeliefs.set(otherName, {
        ...parsed,
        lastUpdated: day,
      });
    } catch {
      // Keep existing inference on failure
    }

    this.lastInferenceTime = day;
  }

  /**
   * Update theory of mind from observing a conversation exchange.
   * This is faster (no LLM call) — rule-based update.
   */
  updateFromConversation(otherName: string, line: string, wasPositive: boolean, day: number) {
    this.ensureOther(otherName, day);
    const infer = this.inferredBeliefs.get(otherName)!;

    // Positive conversation = they seem more trusting of us
    if (wasPositive) {
      infer.trustInMe = Math.min(1, infer.trustInMe + 0.05);
    } else {
      infer.trustInMe = Math.max(0, infer.trustInMe - 0.08);
    }

    // If they talk about the prize, they want to win
    if (line.toLowerCase().includes('money') || line.toLowerCase().includes('prize') || line.toLowerCase().includes('win')) {
      infer.thinksTheyWillWin = Math.min(1, infer.thinksTheyWillWin + 0.1);
    }

    // If they talk about eviction, they're scared
    if (line.toLowerCase().includes('evict') || line.toLowerCase().includes('vote') || line.toLowerCase().includes('nominate')) {
      infer.fearsEviction = Math.min(1, infer.fearsEviction + 0.08);
    }

    infer.lastUpdated = day;
  }

  /** Get a compressed numerical summary of inferred beliefs about another NPC */
  describeInferenceCompact(otherName: string): string {
    const infer = this.inferredBeliefs.get(otherName);
    if (!infer) return '';
    return `ToM:TR${(infer.trustInMe * 100).toFixed(0)}/FE${(infer.fearsEviction * 100).toFixed(0)}/WN${(infer.thinksTheyWillWin * 100).toFixed(0)}`;
  }

  /** Get a natural-language description of what we think another NPC believes */
  describeInference(otherName: string): string {
    const infer = this.inferredBeliefs.get(otherName);
    if (!infer) return '';
    const parts: string[] = [];
    if (infer.trustInMe > 0.6) parts.push(`${otherName} seems to trust you`);
    else if (infer.trustInMe < 0.4) parts.push(`${otherName} doesn't seem to trust you`);
    if (infer.fearsEviction > 0.6) parts.push(`${otherName} is probably scared of eviction`);
    if (infer.thinksTheyWillWin > 0.6) parts.push(`${otherName} seems confident about winning`);
    if (parts.length === 0) parts.push(`you're not sure what ${otherName} is thinking`);
    return parts.join('. ') + '.' + (infer.strategySummary !== 'unknown strategy' ? ` You suspect their strategy: ${infer.strategySummary}` : '');
  }

  private parseInference(text: string): {
    thinksTheyArePopular: number;
    thinksTheyWillWin: number;
    trustInMe: number;
    fearsEviction: number;
    strategySummary: string;
  } {
    const result = {
      thinksTheyArePopular: 0.5,
      thinksTheyWillWin: 0.5,
      trustInMe: 0.5,
      fearsEviction: 0.5,
      strategySummary: 'unknown strategy',
    };

    const popMatch = text.match(/Popularity:\s*(\d+)/i);
    if (popMatch) result.thinksTheyArePopular = Math.min(1, Math.max(0, parseInt(popMatch[1]) / 100));

    const winMatch = text.match(/WinChance:\s*(\d+)/i);
    if (winMatch) result.thinksTheyWillWin = Math.min(1, Math.max(0, parseInt(winMatch[1]) / 100));

    const trustMatch = text.match(/TrustInMe:\s*(\d+)/i);
    if (trustMatch) result.trustInMe = Math.min(1, Math.max(0, parseInt(trustMatch[1]) / 100));

    const fearMatch = text.match(/EvictionFear:\s*(\d+)/i);
    if (fearMatch) result.fearsEviction = Math.min(1, Math.max(0, parseInt(fearMatch[1]) / 100));

    const stratMatch = text.match(/Strategy:\s*(.+)/i);
    if (stratMatch) result.strategySummary = stratMatch[1].trim();

    return result;
  }
}
