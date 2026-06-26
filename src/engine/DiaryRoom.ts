export interface Confession {
  npcName: string;
  day: number;
  timestamp: string;
  text: string;
  targets: string[];
}

export class DiarySystem {
  private confessions: Confession[] = [];
  recordConfession(npcName: string, day: number, time: string, relationships: Record<string, number>): Confession {
    const sorted = Object.entries(relationships)
      .filter(([_, v]) => v !== 0)
      .sort((a, b) => a[1] - b[1]);

    const mostLiked = sorted[sorted.length - 1];
    const mostDisliked = sorted[0];
    const targets: string[] = [];

    const lines: string[] = [];

    if (mostDisliked && mostDisliked[1] < -0.1) {
      targets.push(mostDisliked[0]);
      if (mostDisliked[1] < -0.5) {
        lines.push(`I really can't stand ${mostDisliked[0]}. Being around them is exhausting.`);
      } else {
        lines.push(`${mostDisliked[0]} gets on my nerves sometimes, but maybe it's just the house.`);
      }
    }

    if (mostLiked && mostLiked[1] > 0.1 && mostLiked[0] !== mostDisliked?.[0]) {
      targets.push(mostLiked[0]);
      if (mostLiked[1] > 0.5) {
        lines.push(`${mostLiked[0]} is honestly the only thing keeping me sane in here.`);
      } else {
        lines.push(`I'm glad ${mostLiked[0]} is here. We get along well.`);
      }
    }

    if (lines.length === 0) {
      lines.push('Nothing much to report today. Just taking it day by day.');
    }

    const text = lines.join(' ');

    const confession: Confession = {
      npcName,
      day,
      timestamp: time,
      text,
      targets,
    };

    this.confessions.push(confession);
    return confession;
  }

  getConfessions(): Confession[] {
    return [...this.confessions];
  }

  getConfessionsFor(npcName: string): Confession[] {
    return this.confessions.filter(c => c.npcName === npcName);
  }

  getLatestConfessions(count = 5): Confession[] {
    return this.confessions.slice(-count).reverse();
  }

  /** Bulk-restore confessions from save data (replaces all existing) */
  restoreConfessions(confessions: Confession[]) {
    this.confessions = [...confessions];
  }
}
