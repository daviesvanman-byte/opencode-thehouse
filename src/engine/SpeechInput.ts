export type SpeechResultCallback = (transcript: string) => void;

interface SpeechInputRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  abort(): void;
  onresult: ((e: SpeechInputEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}
interface SpeechInputEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

export class SpeechInput {
  private recognition: SpeechInputRecognition | null = null;
  private listening = false;
  private callback: SpeechResultCallback | null = null;

  get isListening() { return this.listening; }

  start(cb: SpeechResultCallback) {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) {
      console.warn('SpeechInput: SpeechRecognition not available');
      return;
    }
    this.stop();
    this.callback = cb;
    this.recognition = new (SR as new () => SpeechInputRecognition)();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (e: SpeechInputEvent) => {
      const text = e.results[0][0].transcript;
      this.listening = false;
      if (this.callback) this.callback(text);
    };

    this.recognition.onerror = () => { this.listening = false; };
    this.recognition.onend = () => { this.listening = false; };

    try {
      this.recognition.start();
      this.listening = true;
    } catch {
      this.listening = false;
    }
  }

  stop() {
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
      this.recognition = null;
    }
    this.listening = false;
  }
}
