export interface PersonalityTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export function randomPersonality(): PersonalityTraits {
  return {
    openness:          0.3 + Math.random() * 0.7,          // high — novelty-seeking, uninhibited
    conscientiousness: -0.8 + Math.random() * 0.6,         // low — impulsive, messy
    extraversion:      0.5 + Math.random() * 0.5,          // very high — desperate for social
    agreeableness:    -0.3 + Math.random() * 1.0,          // variable — some mean, some nice
    neuroticism:      -0.8 + Math.random() * 0.6,          // low — shameless, low anxiety
  };
}

export type NeedType = 'hunger' | 'energy' | 'social' | 'hygiene' | 'fun';

export const NEED_NAMES: NeedType[] = ['hunger', 'energy', 'social', 'hygiene', 'fun'];

export class Needs {
  values: Record<NeedType, number> = {
    hunger: 0.8,
    energy: 0.9,
    social: 0.5,
    hygiene: 0.8,
    fun: 0.5,
  };
  decayRates: Record<NeedType, number> = {
    hunger: 0.04,
    energy: 0.015,
    social: 0.03,
    hygiene: 0.01,
    fun: 0.02,
  };

  update(dt: number, activity: string) {
    for (const need of NEED_NAMES) {
      this.values[need] = Math.max(0, Math.min(1, this.values[need] - this.decayRates[need] * dt));
    }
    this.applyActivity(activity, dt);
  }

  private applyActivity(activity: string, dt: number) {
    switch (activity) {
      case 'eating': this.values.hunger = Math.min(1, this.values.hunger + 0.3 * dt); break;
      case 'sleeping': this.values.energy = Math.min(1, this.values.energy + 0.2 * dt); break;
      case 'showering': this.values.hygiene = Math.min(1, this.values.hygiene + 0.4 * dt); break;
      case 'socializing': this.values.social = Math.min(1, this.values.social + 0.15 * dt); break;
      case 'lounging': this.values.fun = Math.min(1, this.values.fun + 0.1 * dt); break;
    }
  }

  getMostUrgent(): NeedType {
    let lowest: NeedType = 'hunger';
    for (const need of NEED_NAMES) {
      if (this.values[need] < this.values[lowest]) lowest = need;
    }
    return lowest;
  }
}

export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'anxious' | 'excited';

export class EmotionalState {
  primary: Emotion = 'neutral';
  intensity = 0.3;

  update(personality: PersonalityTraits, needs: Needs) {
    const lowest = needs.getMostUrgent();
    const avgNeed = NEED_NAMES.reduce((s, n) => s + needs.values[n], 0) / NEED_NAMES.length;

    if (needs.values[lowest] < 0.2) {
      this.primary = 'angry';
      this.intensity = 0.7 + personality.neuroticism * 0.3;
    } else if (needs.values[lowest] < 0.4) {
      this.primary = 'sad';
      this.intensity = 0.4 + personality.neuroticism * 0.2;
    } else if (avgNeed > 0.7) {
      this.primary = 'happy';
      this.intensity = 0.4 + avgNeed * 0.3 + personality.extraversion * 0.2;
    } else if (needs.values.social > 0.6 && personality.extraversion > 0.3) {
      this.primary = 'excited';
      this.intensity = 0.5 + needs.values.social * 0.3;
    } else if (needs.values.energy < 0.4) {
      this.primary = 'anxious';
      this.intensity = 0.3 + (1 - needs.values.energy) * 0.3;
    } else {
      this.primary = 'neutral';
      this.intensity = 0.2 + avgNeed * 0.2;
    }
  }
}
