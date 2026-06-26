export interface DiscoveredAgent {
  name: string;
  provider: string;
  baseUrl: string;
  models?: string[];
  batchSupport: boolean;
}

export interface PendingThought {
  npcName: string;
  prompt: string;
  resolve: (value: string) => void;
}

/**
 * AgentRelay discovers local AI agents (Ollama, LocalAI, etc.) on common ports
 * and provides a batch-thought relay that groups NPC thinking into fewer API calls.
 */
export class AgentRelay {
  private agents: DiscoveredAgent[] = [];
  private pending: PendingThought[] = [];
  private drainTimer = 0;
  private discovered = false;

  readonly knownPorts = [
    { port: 11434, name: 'Ollama',     provider: 'ollama' },
    { port: 8080,  name: 'LocalAI',    provider: 'localai' },
    { port: 5000,  name: 'TextGenUI',  provider: 'local' },
    { port: 7860,  name: 'SD WebUI',   provider: 'local' },
  ];

  /** Scan localhost ports for running AI agents */
  async discover(timeoutMs = 2000): Promise<DiscoveredAgent[]> {
    if (this.discovered) return this.agents;
    this.discovered = true;

    const results = await Promise.allSettled(
      this.knownPorts.map(async ({ port, name, provider }) => {
        const baseUrl = `http://localhost:${port}`;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          await fetch(baseUrl, { signal: controller.signal, mode: 'no-cors' });
          clearTimeout(timer);
          // no-cors means we get an opaque response, but if it didn't throw, something is listening
          const agent: DiscoveredAgent = { name, provider, baseUrl, batchSupport: false };
          // Try Ollama-specific discovery
          if (provider === 'ollama') {
            try {
              const tagsRes = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1000) });
              if (tagsRes.ok) {
                const tags = await tagsRes.json();
                agent.models = (tags.models ?? []).map((m: { name: string }) => m.name);
                agent.batchSupport = true;
              }
            } catch { /* not Ollama or no models */ }
          }
          return agent;
        } catch {
          return null;
        }
      }),
    );

    this.agents = results
      .filter((r): r is PromiseFulfilledResult<DiscoveredAgent | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((a): a is DiscoveredAgent => a !== null);

    if (this.agents.length > 0) {
      console.log(`AgentRelay: discovered ${this.agents.map(a => a.name).join(', ')}`);
    }
    return this.agents;
  }

  /** Queue a thought for batch processing */
  addThought(npcName: string, prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.pending.push({ npcName, prompt, resolve });
    });
  }

  /** Called every frame; drains queued thoughts in batches */
  async update(dt: number): Promise<string[]> {
    this.drainTimer += dt;
    if (this.drainTimer < 2 || this.pending.length === 0) return [];
    this.drainTimer = 0;

    const batch = this.pending.splice(0);
    const replies = await this.sendBatch(batch.map(t => ({ name: t.npcName, prompt: t.prompt })));
    for (let i = 0; i < batch.length; i++) {
      batch[i].resolve(replies[i] ?? '...');
    }
    return replies;
  }

  private async sendBatch(thoughts: { name: string; prompt: string }[]): Promise<string[]> {
    // Prefer Ollama for batch
    const ollama = this.agents.find(a => a.provider === 'ollama');
    if (ollama && thoughts.length > 0) {
      try {
        return await this.queryOllamaBatch(ollama.baseUrl, thoughts);
      } catch { /* fall through */ }
    }
    // Fallback: individual local responses
    return thoughts.map(() => this.fallbackLocal());
  }

  private async queryOllamaBatch(baseUrl: string, thoughts: { name: string; prompt: string }[]): Promise<string[]> {
    // Ollama doesn't have a native batch endpoint, so we send sequentially but concurrently
    const results = await Promise.allSettled(
      thoughts.map(({ prompt }) =>
        fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama3.2:1b', prompt, stream: false, options: { num_predict: 80, temperature: 0.8 } }),
        }).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
          .then(data => (data.response ?? '').trim())
      ),
    );
    return results.map(r => r.status === 'fulfilled' ? r.value : '...');
  }

  /** Try a single Ollama generate call (for non-batched use) */
  async queryOllama(prompt: string): Promise<string | null> {
    const ollama = this.agents.find(a => a.provider === 'ollama');
    if (!ollama) return null;
    try {
      const res = await fetch(`${ollama.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2:1b', prompt, stream: false, options: { num_predict: 80, temperature: 0.8 } }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.response ?? '').trim() || null;
    } catch {
      return null;
    }
  }

  private fallbackLocal(): string {
    const responses = [
      'Hey, how\'s it going?', 'This house is crazy, right?', 'Anyone seen the remote?',
      'Today has been exhausting.', 'I wonder what they\'re cooking for dinner.',
      'Let\'s just relax for a bit.', 'Not much to do around here.',
      'I miss my family.', 'Anyone want to play a game?', 'I\'m feeling good today.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  get discoveredAgents(): ReadonlyArray<DiscoveredAgent> {
    return this.agents;
  }
}
