export class Narrator {
  private voice: SpeechSynthesisVoice | null = null;
  private speaking = false;
  private queue: string[] = [];
  private lastNarration = 0;
  private available = false;

  constructor() {
    this.available = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.available) this.initVoice();
  }

  private initVoice() {
    const tryVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      this.voice = voices.find(v =>
        v.lang.startsWith('en-GB') && v.name.toLowerCase().includes('male')
      ) || voices.find(v => v.lang.startsWith('en-GB')) || null;
    };
    tryVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = tryVoice;
    }
  }

  private processQueue() {
    if (!this.available || this.speaking || this.queue.length === 0) return;
    this.speaking = true;
    const text = this.queue.shift()!;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = this.voice;
      utter.rate = 0.75;
      utter.pitch = 1.0;
      utter.volume = 0.7;
      utter.onend = () => {
        this.speaking = false;
        setTimeout(() => this.processQueue(), 500);
      };
      window.speechSynthesis.speak(utter);
    } catch {
      this.speaking = false;
    }
  }

  narrate(text: string) {
    if (!this.available) return;
    this.queue.push(text);
    if (!this.speaking) this.processQueue();
  }

  announceDay(day: number) {
    this.narrate(`Day ${day}.`);
  }

  announceActivity(name: string, activity: string, room: string) {
    const now = Date.now();
    if (now - this.lastNarration < 8000) return;
    this.lastNarration = now;
    this.narrate(`${name} is ${activity} in the ${room}.`);
  }

  announceEvent(message: string) {
    const now = Date.now();
    if (now - this.lastNarration < 5000) return;
    this.lastNarration = now;
    this.narrate(message);
  }

  announceTaskStart(name: string, description: string) {
    this.narrate(`Big Brother has set a task for ${name}. ${description}.`);
  }

  announceTaskProgress(name: string, description: string, room: string) {
    const now = Date.now();
    if (now - this.lastNarration < 12000) return;
    this.lastNarration = now;
    this.narrate(`${name} is in the ${room}, working on Big Brother's task. ${description}.`);
  }

  announceReaction(observer: string, target: string, reaction: string) {
    const now = Date.now();
    if (now - this.lastNarration < 8000) return;
    this.lastNarration = now;
    this.narrate(`${observer} ${reaction} ${target}.`);
  }
}
