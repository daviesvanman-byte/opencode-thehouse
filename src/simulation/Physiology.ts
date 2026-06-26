export interface PhysiologyState {
  fatigue: number;
  hydration: number;
  health: number;
  energy: number;
}

export class Physiology {
  fatigue = 0;
  hydration = 1;
  health = 1;
  energy = 1;
  get isExhausted(): boolean { return this.fatigue > 0.8; }
  get isDehydrated(): boolean { return this.hydration < 0.3; }
  get isSick(): boolean { return this.health < 0.3; }
  get overallHealth(): number {
    return (this.energy + this.hydration + this.health + (1 - this.fatigue)) / 4;
  }

  update(dt: number, activity: string) {
    const hours = dt;

    this.fatigue = Math.min(1, this.fatigue + hours * 0.008);
    this.hydration = Math.max(0, this.hydration - hours * 0.005);
    this.health = Math.max(0, this.health - (this.hydration < 0.2 ? hours * 0.01 : 0));

    switch (activity) {
      case 'sleeping':
        this.fatigue = Math.max(0, this.fatigue - hours * 0.15);
        this.energy = Math.min(1, this.energy + hours * 0.12);
        break;
      case 'eating':
        this.energy = Math.min(1, this.energy + hours * 0.2);
        this.hydration = Math.min(1, this.hydration + hours * 0.15);
        break;
      case 'showering':
        this.hydration = Math.min(1, this.hydration + hours * 0.1);
        break;
      case 'lounging':
        this.fatigue = Math.max(0, this.fatigue - hours * 0.04);
        break;
      case 'socializing':
        this.energy = Math.max(0, this.energy - hours * 0.02);
        break;
      default:
        this.energy = Math.max(0, this.energy - hours * 0.01);
        break;
    }

    if (this.fatigue > 0.9) {
      this.health = Math.max(0, this.health - hours * 0.005);
    }
  }

  getState(): PhysiologyState {
    return {
      fatigue: this.fatigue,
      hydration: this.hydration,
      health: this.health,
      energy: this.energy,
    };
  }

  reset() {
    this.fatigue = 0;
    this.hydration = 1;
    this.health = 1;
    this.energy = 1;
  }
}
