import type { AgentRelay } from '../engine/AgentRelay';
import { TokenCompressor, globalTokenTracker } from '../utils/TokenCompressor';

export type APIProvider = 'openrouter' | 'gemini' | 'groq' | 'huggingface' | 'ollama' | 'local';

interface ProviderConfig {
  model: string;
  url: string;
}

const PROVIDERS: Record<APIProvider, ProviderConfig> = {
  openrouter: { model: 'mistralai/mistral-7b-instruct:free', url: 'https://openrouter.ai/api/v1/chat/completions' },
  gemini: { model: 'gemini-2.0-flash-lite', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  groq: { model: 'llama3-8b-8192', url: 'https://api.groq.com/openai/v1/chat/completions' },
  huggingface: { model: 'mistralai/Mistral-7B-Instruct-v0.3', url: 'https://api-inference.huggingface.co/models/' },
  ollama: { model: 'llama3.2:1b', url: '' },
  local: { model: 'local', url: '' },
};

const LOCAL_RESPONSES = [
  'Hey, how\'s it going?',
  'This house is crazy, right?',
  'I could use a snack.',
  'Anyone seen the remote?',
  'Today has been exhausting.',
  'I wonder what they\'re cooking for dinner.',
  'Did you hear that noise last night?',
  'I need some fresh air.',
  'Let\'s just relax for a bit.',
  'Not much to do around here.',
  'I miss my family.',
  'Anyone want to play a game?',
  'What do you think of the others?',
  'I\'m feeling good today.',
  'Ugh, I\'m so bored.',
];

function buildPrompt(name: string, context: string, dialogueHistory: string[]): string {
  const recentLines = dialogueHistory.slice(-6);
  const historyStr = recentLines.length > 0
    ? `\nHistory:\n${recentLines.map(d => `  ${d}`).join('\n')}`
    : '';
  // Condensed instructions (~25 tokens vs ~60 before)
  return `You are ${name} in BB house. You have own goals/fears/opinions. Keep replies <40 words. React to what was just said — ask, share, or change topic.\n\nContext: ${context}${historyStr}\n\n${name}:`;
}

async function queryOpenRouter(prompt: string, apiKey: string, maxTokens = 80): Promise<string> {
  const cfg = PROVIDERS.openrouter;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.8 }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '...';
}

async function queryGemini(prompt: string, apiKey: string, maxTokens = 80): Promise<string> {
  const cfg = PROVIDERS.gemini;
  const url = `${cfg.url}${cfg.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '...';
}

async function queryGroq(prompt: string, apiKey: string, maxTokens = 80): Promise<string> {
  const cfg = PROVIDERS.groq;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.8 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '...';
}

async function queryHuggingFace(prompt: string, apiKey: string, maxTokens = 80): Promise<string> {
  const cfg = PROVIDERS.huggingface;
  const res = await fetch(`${cfg.url}${cfg.model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: maxTokens, temperature: 0.8 } }),
  });
  if (!res.ok) throw new Error(`HuggingFace ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0]?.generated_text?.replace(prompt, '').trim() ?? '...' : '...';
}

function queryLocal(): string {
  return LOCAL_RESPONSES[Math.floor(Math.random() * LOCAL_RESPONSES.length)];
}

type QueryFn = (prompt: string, key: string, maxTokens?: number) => Promise<string>;

const QUERY_FN: Record<Exclude<APIProvider, 'local' | 'ollama'>, QueryFn> = {
  openrouter: queryOpenRouter,
  gemini: queryGemini,
  groq: queryGroq,
  huggingface: queryHuggingFace,
};

export class NPCBrain {
  private apiKeys: Partial<Record<APIProvider, string>> = {};
  private activeProviders: APIProvider[] = ['local'];
  private providerIndex = 0;
  private failures: Record<string, number> = {};
  private cooldowns: Record<string, number> = {};
  private relay: AgentRelay | null = null;

  setRelay(relay: AgentRelay) {
    this.relay = relay;
    if (!this.activeProviders.includes('ollama')) {
      this.activeProviders.push('ollama');
    }
    this.failures['ollama'] = 0;
  }

  setKey(provider: APIProvider, key: string) {
    this.apiKeys[provider] = key;
    if (provider !== 'local' && !this.activeProviders.includes(provider)) {
      this.activeProviders.push(provider);
    }
    this.failures[provider] = 0;
  }

  removeProvider(provider: APIProvider) {
    this.activeProviders = this.activeProviders.filter(p => p !== provider);
    if (this.activeProviders.length === 0) this.activeProviders.push('local');
  }

  async think(name: string, context: string, dialogueHistory: string[] = []): Promise<string> {
    const compressedCtx = TokenCompressor.compressContext(context);
    const compressedHistory = dialogueHistory.map(l => TokenCompressor.compressEntities(l));
    const prompt = buildPrompt(name, compressedCtx, compressedHistory);
    const uncompressedPrompt = buildPrompt(name, context, dialogueHistory);

    globalTokenTracker.logCall('think', prompt, '', uncompressedPrompt);

    for (let i = 0; i < this.activeProviders.length + 1; i++) {
      const provider = this.activeProviders[this.providerIndex % this.activeProviders.length];
      this.providerIndex++;
      if (provider === 'local') continue;
      const now = Date.now();
      if (this.cooldowns[provider] && this.cooldowns[provider] > now) {
        console.warn(`NPCBrain: ${provider} on cooldown for ${((this.cooldowns[provider] - now) / 1000).toFixed(0)}s`);
        continue;
      }
      try {
        if (provider === 'ollama') {
          if (!this.relay) { console.warn('NPCBrain: ollama selected but no relay connected'); continue; }
          const result = await this.relay.queryOllama(prompt);
          if (!result) throw new Error('Ollama returned empty');
          this.failures['ollama'] = 0;
          return result;
        }
        const key = this.apiKeys[provider];
        if (!key) {
          console.warn(`NPCBrain: ${provider} selected but no API key set. Use Settings panel.`);
          continue;
        }
        console.log(`NPCBrain: querying ${provider}...`);
        const result = await QUERY_FN[provider](prompt, key);
        this.failures[provider] = 0;
        return result;
      } catch (err) {
        this.failures[provider] = (this.failures[provider] ?? 0) + 1;
        console.warn(`NPCBrain: ${provider} failed (${this.failures[provider]}x):`, err);
        if (this.failures[provider] >= 3) {
          this.cooldowns[provider] = now + 60_000;
          this.failures[provider] = 0;
          console.warn(`NPCBrain: ${provider} on 60s cooldown after 3 failures`);
        }
      }
    }
    return queryLocal();
  }

  /** Send a raw prompt (for reflections, planning, ToM) — longer output, no conversational framing */
  async thinkRaw(prompt: string): Promise<string> {
    const compressedPrompt = TokenCompressor.compressContext(prompt);
    globalTokenTracker.logCall('thinkRaw', compressedPrompt, '', prompt);

    for (let i = 0; i < this.activeProviders.length + 1; i++) {
      const provider = this.activeProviders[this.providerIndex % this.activeProviders.length];
      this.providerIndex++;
      if (provider === 'local') continue;
      const now = Date.now();
      if (this.cooldowns[provider] && this.cooldowns[provider] > now) {
        console.warn(`NPCBrain: ${provider} on cooldown (thinkRaw)`);
        continue;
      }
      try {
        if (provider === 'ollama') {
          if (!this.relay) { console.warn('NPCBrain: ollama selected but no relay (thinkRaw)'); continue; }
          const result = await this.relay.queryOllama(compressedPrompt);
          if (!result) throw new Error('Ollama returned empty');
          this.failures['ollama'] = 0;
          return result;
        }
        const key = this.apiKeys[provider];
        if (!key) {
          console.warn(`NPCBrain: ${provider} no key (thinkRaw)`);
          continue;
        }
        const result = await QUERY_FN[provider](compressedPrompt.replace(/\.\s*$/, '. Keep the response concise and specific.'), key, 200);
        this.failures[provider] = 0;
        return result;
      } catch (err) {
        this.failures[provider] = (this.failures[provider] ?? 0) + 1;
        if (this.failures[provider] >= 3) {
          this.cooldowns[provider] = now + 60_000;
          this.failures[provider] = 0;
        }
      }
    }
    return '[]';
  }

  getActiveProviders(): APIProvider[] {
    return [...this.activeProviders];
  }

  getStatus(): { provider: APIProvider; keySet: boolean; failures: number }[] {
    return this.activeProviders.map(p => ({
      provider: p,
      keySet: p === 'local' ? true : !!this.apiKeys[p],
      failures: this.failures[p] ?? 0,
    }));
  }
}
