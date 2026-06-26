export interface ReplayFrame {
  day: number;
  hour: number;
  room: string;
  activity: string;
  emotion: string;
  clothing: string;
  x: number;
  z: number;
  yaw: number;
}

export interface TaskReplay {
  npcName: string;
  taskDescription: string;
  frames: ReplayFrame[];
}

export class TaskRecorder {
  private recordings = new Map<string, ReplayFrame[]>();

  recordFrame(npcName: string, taskId: string, frame: ReplayFrame) {
    const key = `${npcName}:${taskId}`;
    if (!this.recordings.has(key)) {
      this.recordings.set(key, []);
    }
    this.recordings.get(key)!.push(frame);
  }

  getReplay(npcName: string, taskId: string): TaskReplay | null {
    const key = `${npcName}:${taskId}`;
    const frames = this.recordings.get(key);
    if (!frames || frames.length === 0) return null;
    return { npcName, taskDescription: '', frames };
  }

  setTaskDescription(npcName: string, taskId: string, desc: string) {
    const key = `${npcName}:${taskId}`;
    const replay = this.recordings.get(key);
    // We store description alongside the recording by tagging first frame
    if (replay && replay.length > 0) {
      (replay as any)._desc = desc;
    }
  }

  getAllReplays(): TaskReplay[] {
    const result: TaskReplay[] = [];
    for (const [key, frames] of this.recordings) {
      const [npcName] = key.split(':');
      const desc = (frames as any)._desc || '';
      result.push({ npcName, taskDescription: desc, frames });
    }
    return result;
  }

  clearReplay(npcName: string, taskId: string) {
    this.recordings.delete(`${npcName}:${taskId}`);
  }

  /** Get all recordings as serializable entries for save */
  getAllEntries(): [string, ReplayFrame[]][] {
    return Array.from(this.recordings.entries());
  }

  /** Restore recordings from saved entries */
  restoreEntries(entries: [string, ReplayFrame[]][]) {
    this.recordings.clear();
    for (const [key, frames] of entries) {
      this.recordings.set(key, frames);
    }
  }
}
