/**
 * AAAK-style token compression for NPC LLM prompts.
 * 
 * Techniques:
 * 1. Entity short codes (Alexander→ALC, Living Room→LR)
 * 2. Structured memory format instead of verbose prose
 * 3. Redundant instruction stripping (pre-encode rules into codes)
 * 4. Content selection (only pack what's needed)
 * 5. Token budget estimation and tracking
 */

// ── Entity code maps ─────────────────────────────────────────────

const NPC_CODES: Record<string, string> = {
  alexander: 'ALC', jessica: 'JSS', samantha: 'SAM', ryan: 'RYN',
};
const NPC_NAMES: Record<string, string> = {};
for (const [k, v] of Object.entries(NPC_CODES)) NPC_NAMES[v] = k;

const ROOM_CODES: Record<string, string> = {
  'living room': 'LR', 'kitchen': 'KT', 'dining room': 'DR',
  'bedroom 1': 'B1', 'bedroom 2': 'B2', 'bedroom 3': 'B3',
  'bathroom': 'BA', 'garden': 'GD', 'diary room': 'DRM',
  'store room': 'SR', 'unknown': '??',
};
const ROOM_NAMES: Record<string, string> = {};
for (const [k, v] of Object.entries(ROOM_CODES)) ROOM_NAMES[v] = k;

const ACTIVITY_CODES: Record<string, string> = {
  socializing: 'SOC', eating: 'EAT', sleeping: 'SLP', showering: 'SHW',
  lounging: 'LNG', diary: 'DIA', changing: 'CHG', idling: 'IDL',
  walking: 'WLK', acting: 'ACT',
};

const EMOTION_CODES: Record<string, string> = {
  happy: 'HAP', sad: 'SAD', angry: 'ANG', anxious: 'ANX',
  calm: 'CAL', excited: 'EXC', neutral: 'NTR', bored: 'BRD',
  fearful: 'FER', surprised: 'SRP',
};

const NEED_CODES: Record<string, string> = {
  hunger: 'HUN', energy: 'ENG', social: 'SOC', hygiene: 'HYG', fun: 'FUN',
};

// ── Compressor ───────────────────────────────────────────────────

export class TokenCompressor {
  /** Shorten entity names in text */
  static compressEntities(text: string): string {
    let r = text;
    // NPC names (case-insensitive)
    for (const [name, code] of Object.entries(NPC_CODES)) {
      r = r.replace(new RegExp(`\\b${name}\\b`, 'gi'), code);
    }
    // Room names
    for (const [room, code] of Object.entries(ROOM_CODES)) {
      r = r.replace(new RegExp(`\\b${room}\\b`, 'gi'), code);
    }
    // Activities
    for (const [act, code] of Object.entries(ACTIVITY_CODES)) {
      r = r.replace(new RegExp(`\\b${act}\\b`, 'gi'), code);
    }
    // Emotions
    for (const [emo, code] of Object.entries(EMOTION_CODES)) {
      r = r.replace(new RegExp(`\\b${emo}\\b`, 'gi'), code);
    }
    // Needs
    for (const [need, code] of Object.entries(NEED_CODES)) {
      r = r.replace(new RegExp(`\\b${need}\\b`, 'gi'), code);
    }
    return r;
  }

  /** Expand codes back to readable form for LLM */
  static expandEntities(text: string): string {
    let r = text;
    for (const [name, code] of Object.entries(NPC_CODES)) {
      r = r.replace(new RegExp(`\\b${code}\\b`, 'g'), name.charAt(0).toUpperCase() + name.slice(1));
    }
    for (const [room, code] of Object.entries(ROOM_CODES)) {
      r = r.replace(new RegExp(`\\b${code}\\b`, 'g'), room.charAt(0).toUpperCase() + room.slice(1));
    }
    for (const [act, code] of Object.entries(ACTIVITY_CODES)) {
      r = r.replace(new RegExp(`\\b${code}\\b`, 'g'), act);
    }
    for (const [emo, code] of Object.entries(EMOTION_CODES)) {
      r = r.replace(new RegExp(`\\b${code}\\b`, 'g'), emo);
    }
    return r;
  }

  /** Compress a memory entry into structured shorthand */
  static compressMemory(desc: string, location: string, participants: string[], emotion: string): string {
    const loc = ROOM_CODES[location.toLowerCase()] || location;
    const emo = EMOTION_CODES[emotion.toLowerCase()] || emotion;
    const parts = participants.map(p => NPC_CODES[p.toLowerCase()] || p).join('+');
    const descCompressed = TokenCompressor.compressEntities(desc);
    // Structured: [LOC] PARTS: desc [EMO]
    return `[${loc}]${parts ? ` ${parts}:` : ''} ${descCompressed} [${emo}]`;
  }

  /** Format a memory list for a prompt — compressed */
  static formatMemories(memories: { description: string; participants: string[]; location: string; importance: number }[], maxTokens = 200): string {
    const lines: string[] = [];
    let estimatedTokens = 0;
    for (const m of memories) {
      const compressed = TokenCompressor.compressMemory(m.description, m.location, m.participants, '');
      const line = `·${compressed}`;
      const tokens = TokenCompressor.estimateTokens(line);
      if (estimatedTokens + tokens > maxTokens) break;
      lines.push(line);
      estimatedTokens += tokens;
    }
    return lines.join('\n');
  }

  /** Estimate token count (rough: ~4 chars per token for English) */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 3.5);
  }

  /** Format need values compactly */
  static formatNeeds(needs: Record<string, number>): string {
    return Object.entries(needs)
      .map(([k, v]) => `${NEED_CODES[k.toLowerCase()] || k}:${(v * 100).toFixed(0)}`)
      .join(',');
  }

  /** Build a compressed relationship line */
  static formatRel(name: string, value: number): string {
    const code = NPC_CODES[name.toLowerCase()] || name;
    const relType = value > 0.3 ? 'FRD' : value > -0.3 ? 'NTL' : 'HST';
    return `${code}:${relType}(${(value * 100).toFixed(0)})`;
  }

  /** Compress a full context string for the brain */
  static compressContext(context: string): string {
    // 1. Compress entities
    let r = TokenCompressor.compressEntities(context);
    // 2. Strip filler words
    r = r.replace(/\b(just|really|quite|basically|actually|literally|honestly|pretty)\b/gi, '');
    // 3. Condense whitespace
    r = r.replace(/\s{2,}/g, ' ').trim();
    return r;
  }

  /** Track token usage across multiple calls */
  static createTracker() {
    return new TokenBudgetTracker();
  }
}

// ── Token budget tracker ────────────────────────────────────────

interface TokenCall {
  callType: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  savedTokens: number; // vs uncompressed
}

export class TokenBudgetTracker {
  private calls: TokenCall[] = [];
  private readonly COST_PER_1K_INPUT = 0.00015;  // approx for mistral-7b
  private readonly COST_PER_1K_OUTPUT = 0.00060;

  logCall(callType: string, inputText: string, outputText: string, uncompressedText?: string) {
    const inputTokens = TokenCompressor.estimateTokens(inputText);
    const outputTokens = TokenCompressor.estimateTokens(outputText);
    const savedTokens = uncompressedText
      ? TokenCompressor.estimateTokens(uncompressedText) - inputTokens
      : 0;
    const estimatedCost = (inputTokens / 1000) * this.COST_PER_1K_INPUT
      + (outputTokens / 1000) * this.COST_PER_1K_OUTPUT;
    this.calls.push({ callType, inputTokens, outputTokens, estimatedCost, savedTokens });
  }

  getStats(): string {
    const total = this.calls.reduce((s, c) => ({
      input: s.input + c.inputTokens,
      output: s.output + c.outputTokens,
      cost: s.cost + c.estimatedCost,
      saved: s.saved + c.savedTokens,
    }), { input: 0, output: 0, cost: 0, saved: 0 });

    return [
      `[TOKEN] Calls: ${this.calls.length}`,
      `  Input:  ${total.input.toLocaleString()} tokens`,
      `  Output: ${total.output.toLocaleString()} tokens`,
      `  Saved:  ${total.saved.toLocaleString()} tokens (${total.saved > 0 ? ((total.saved / (total.input + total.saved)) * 100).toFixed(1) : 0}%)`,
      `  Est. cost: \$${total.cost.toFixed(5)}`,
    ].join('\n');
  }

  getCallsByType(): Record<string, number> {
    const byType: Record<string, number> = {};
    for (const c of this.calls) {
      byType[c.callType] = (byType[c.callType] || 0) + c.inputTokens;
    }
    return byType;
  }

  reset() { this.calls = []; }
}

/** Singleton tracker shared across NPCs */
export const globalTokenTracker = TokenCompressor.createTracker();
