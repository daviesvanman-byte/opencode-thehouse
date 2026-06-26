export interface BigBrotherTask {
  npcName: string;
  description: string;
  bonus: string;
  requiredActivity: string;
  requiredRoom?: string;
  requiredClothing?: string;
  deadlineDay: number;
  deadlineHour: number;
  assignedDay: number;
  assignedHour: number;
  completed: boolean;
  failed: boolean;
  rewardType?: 'immunity' | 'luxury' | 'nominate' | 'praise';
}

export interface TaskReward {
  type: 'immunity' | 'luxury' | 'nominate' | 'praise';
  npcName: string;
  description: string;
}

export class TaskSystem {
  tasks: BigBrotherTask[] = [];

  assignTask(
    npcName: string,
    description: string,
    bonus: string,
    requiredActivity: string,
    deadlineDay: number,
    deadlineHour: number,
    assignedDay = 1,
    assignedHour = 0,
    requiredRoom?: string,
    requiredClothing?: string,
  ): BigBrotherTask {
    const rewardType = this.inferRewardType(bonus);
    const task: BigBrotherTask = {
      npcName, description, bonus,
      requiredActivity, requiredRoom, requiredClothing,
      deadlineDay, deadlineHour,
      assignedDay, assignedHour,
      completed: false, failed: false,
      rewardType,
    };
    this.tasks.push(task);
    return task;
  }

  private inferRewardType(bonus: string): 'immunity' | 'luxury' | 'nominate' | 'praise' {
    const lower = bonus.toLowerCase();
    if (lower.includes('immunity') || lower.includes('immune') || lower.includes('save')) return 'immunity';
    if (lower.includes('luxury') || lower.includes('hamper') || lower.includes('treat') || lower.includes('reward') || lower.includes('party')) return 'luxury';
    if (lower.includes('nominate') || lower.includes('power') || lower.includes('vote') || lower.includes('choose')) return 'nominate';
    return 'praise';
  }

  getCompletedRewards(): TaskReward[] {
    return this.tasks
      .filter(t => t.completed && t.rewardType && t.rewardType !== 'praise')
      .map(t => ({
        type: t.rewardType!,
        npcName: t.npcName,
        description: t.description,
      }));
  }

  checkCompletion(npcName: string, activity: string, room: string, clothingState: string, day: number, hour: number) {
    for (const task of this.tasks) {
      if (task.npcName !== npcName || task.completed || task.failed) continue;

      // Check deadline
      if (day > task.deadlineDay || (day === task.deadlineDay && hour >= task.deadlineHour)) {
        task.failed = true;
        continue;
      }

      // Check activity match
      if (task.requiredActivity !== activity) continue;

      // Check room if specified
      if (task.requiredRoom && task.requiredRoom !== room) continue;

      // Check clothing if specified
      if (task.requiredClothing && task.requiredClothing !== clothingState) continue;

      // All conditions met
      task.completed = true;
    }
  }

  getTasksFor(npcName: string): BigBrotherTask[] {
    return this.tasks.filter(t => t.npcName === npcName && !t.completed && !t.failed);
  }

  getFailedTasks(day: number, hour: number): BigBrotherTask[] {
    const failed: BigBrotherTask[] = [];
    for (const task of this.tasks) {
      if (task.completed || task.failed) continue;
      if (day > task.deadlineDay || (day === task.deadlineDay && hour >= task.deadlineHour)) {
        task.failed = true;
        failed.push(task);
      }
    }
    return failed;
  }

  getCompletedTasks(npcName?: string): BigBrotherTask[] {
    return npcName
      ? this.tasks.filter(t => t.npcName === npcName && t.completed)
      : this.tasks.filter(t => t.completed);
  }
}
