/** Per-NPC beliefs about others and the world */
export class BeliefSystem {
  /** Trust rating per NPC (0=none, 1=absolute) */
  trust: Map<string, number> = new Map();
  /** Perceived threat per NPC (0=none, 1=extreme) */
  threat: Map<string, number> = new Map();
  /** Perceived popularity per NPC (0=none, 1=very popular) */
  perceivedPopularity: Map<string, number> = new Map();
  /** How confident they are in their own social standing (0=none, 1=very) */
  confidence = 0.3 + Math.random() * 0.7;
  /** How paranoid they are (0=chill, 1=extreme) — derived from neuroticism */
  paranoia = 0;
  /** How likely they think they are to win (0=no chance, 1=guaranteed) */
  winBelief = 0.1 + Math.random() * 0.4;
  /** Whether they believe alliances actually work (0=useless, 1=essential) */
  allianceBelief = 0.3 + Math.random() * 0.7;
  /** Strategic cunning (0=naive, 1=machiavellian) */
  cunning = 0;

  constructor(neuroticism: number, extraversion: number, agreeableness: number) {
    this.paranoia = 0.1 + neuroticism * 0.6;
    this.cunning = (1 - agreeableness) * 0.4 + extraversion * 0.3;
    // Initial random trust/threat for each NPC (filled as NPCs are met)
  }

  ensureOther(name: string) {
    if (!this.trust.has(name)) this.trust.set(name, 0.3 + Math.random() * 0.4);
    if (!this.threat.has(name)) this.threat.set(name, 0.1 + Math.random() * 0.3);
    if (!this.perceivedPopularity.has(name)) this.perceivedPopularity.set(name, 0.2 + Math.random() * 0.3);
  }

  /** Update belief based on a social interaction */
  observeInteraction(otherName: string, _affinityDelta: number, wasPositive: boolean) {
    this.ensureOther(otherName);
    // Trust adjusts with positive/negative interactions
    const trustAdj = wasPositive ? 0.05 : -0.1;
    this.trust.set(otherName, Math.max(0, Math.min(1, (this.trust.get(otherName) ?? 0.5) + trustAdj)));
    // Threat decreases when treated well, increases when treated poorly
    const threatAdj = wasPositive ? -0.03 : 0.08;
    this.threat.set(otherName, Math.max(0, Math.min(1, (this.threat.get(otherName) ?? 0.3) + threatAdj)));
    // Paranoia-based distortion
    if (this.paranoia > 0.5) {
      this.threat.set(otherName, Math.min(1, (this.threat.get(otherName) ?? 0.3) + 0.02 * this.paranoia));
    }
  }

  /** Observe someone being popular/successful */
  observeSuccess(otherName: string) {
    this.ensureOther(otherName);
    this.perceivedPopularity.set(otherName, Math.min(1, (this.perceivedPopularity.get(otherName) ?? 0.5) + 0.1));
    this.threat.set(otherName, Math.min(1, (this.threat.get(otherName) ?? 0.3) + 0.05 * this.paranoia));
  }

  /** Someone was evicted — adjust beliefs */
  observeEviction(evictedName: string) {
    // "If they can go, so can I" — confidence wavers
    this.confidence = Math.max(0, this.confidence - 0.1 * (1 - this.paranoia));
    this.winBelief = Math.max(0, this.winBelief - 0.05);
    // The evicted person must not have been popular enough
    this.perceivedPopularity.delete(evictedName);
    this.trust.delete(evictedName);
    this.threat.delete(evictedName);
  }

  /** Form an alliance — boost trust */
  formAlliance(otherName: string) {
    this.ensureOther(otherName);
    this.trust.set(otherName, Math.min(1, (this.trust.get(otherName) ?? 0.5) + 0.2 + this.cunning * 0.1));
    this.threat.set(otherName, Math.max(0, (this.threat.get(otherName) ?? 0.3) - 0.15));
  }

  /** Plan betrayal */
  planBetrayal(targetName: string) {
    // Cunning NPCs hide it better (threat doesn't rise as much)
    this.ensureOther(targetName);
    this.trust.set(targetName, Math.max(0, (this.trust.get(targetName) ?? 0.5) - 0.3));
    this.threat.set(targetName, Math.min(1, (this.threat.get(targetName) ?? 0.3) + 0.2 * (1 - this.cunning)));
  }

  getTrust(name: string): number { return this.trust.get(name) ?? 0.5; }
  getThreat(name: string): number { return this.threat.get(name) ?? 0.3; }
  getPopularity(name: string): number { return this.perceivedPopularity.get(name) ?? 0.5; }

  /** Describe beliefs for the NPC's prompt context */
  describeBeliefsAbout(otherName: string): string {
    this.ensureOther(otherName);
    const trust = this.getTrust(otherName);
    const threat = this.getThreat(otherName);
    const pop = this.getPopularity(otherName);
    const parts: string[] = [];
    if (trust > 0.7) parts.push(`you trust ${otherName} a lot`);
    else if (trust < 0.3) parts.push(`you don't trust ${otherName}`);
    else parts.push(`you're neutral about ${otherName}`);
    if (threat > 0.7) parts.push(`${otherName} seems like a major threat to your game`);
    else if (threat > 0.4) parts.push(`${otherName} could be a minor threat`);
    if (pop > 0.7) parts.push(`${otherName} is popular with the housemates`);
    else if (pop < 0.3) parts.push(`${otherName} isn't very popular`);
    return parts.join('. ') + '.';
  }

  /** Brief one-line summary for the brain prompt */
  describeSelf(): string {
    const parts: string[] = [];
    parts.push(`you think you have a ${this.winBelief > 0.5 ? 'good' : 'decent'} chance of winning`);
    if (this.confidence > 0.6) parts.push('you feel confident socially');
    else parts.push('you worry about your place in the house');
    return parts.join('. ') + '.';
  }
}
