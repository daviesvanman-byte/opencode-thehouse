export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private _enabled = true;

  get enabled() { return this._enabled; }

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startAmbient() {
    this.ensure();
    if (this.ambientOsc) return;
    if (!this.ctx) return;
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = 60;
    this.ambientOsc.connect(this.ambientGain!);
    this.ambientOsc.start();
    this.ambientGain!.gain.setTargetAtTime(0.04, this.ctx.currentTime, 1);
  }

  stopAmbient() {
    if (this.ambientOsc) {
      try { this.ambientOsc.stop(); } catch {}
      this.ambientOsc = null;
    }
  }

  setAmbientVolume(v: number) {
    this.ensure();
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(v * 0.04, this.ctx.currentTime, 0.5);
    }
  }

  playTone(freq: number, duration: number, volume = 0.1, type: OscillatorType = 'sine') {
    this.ensure();
    if (!this._enabled || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  footstep() {
    this.playTone(80 + Math.random() * 40, 0.06, 0.06, 'square');
  }

  doorOpen() {
    this.playTone(300, 0.15, 0.1, 'sine');
    setTimeout(() => this.playTone(250, 0.1, 0.08, 'sine'), 100);
  }

  dialogueBlip() {
    this.playTone(600 + Math.random() * 200, 0.04, 0.04, 'sine');
  }

  /** Speak text aloud via Web Speech API (TTS) */
  speak(text: string, pitch = 1.0) {
    if (!this._enabled) return;
    try {
      if (!window.speechSynthesis) return;
      // Cancel any utterance already in progress
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = pitch;
      utterance.volume = 1.0;
      utterance.onerror = (e) => console.warn('Speech error:', e);
      // Small delay avoids Chrome/Android TTS race conditions
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (e) { console.warn('speak() failed:', e); }
  }

  /** Ensure speechSynthesis is primed (call on first user gesture) */
  initSpeech() {
    try {
      if (!window.speechSynthesis) return;
      // Prime speech synthesis with a silent utterance to unlock it
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
      // Load voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.getVoices();
      }
    } catch (e) { console.warn('initSpeech() failed:', e); }
  }

  stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  toggle() {
    this._enabled = !this._enabled;
    if (this._enabled) {
      this.startAmbient();
    } else {
      this.stopAmbient();
    }
    if (this.masterGain) {
      this.masterGain.gain.value = this._enabled ? 0.3 : 0;
    }
    return this._enabled;
  }

  dispose() {
    this.stopAmbient();
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
  }
}
