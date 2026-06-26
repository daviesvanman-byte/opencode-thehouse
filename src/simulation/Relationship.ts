export class Relationship {
  private affinity: Map<string, number> = new Map();

  set(name: string, value: number) {
    this.affinity.set(name, Math.max(-1, Math.min(1, value)));
  }

  get(name: string): number {
    return this.affinity.get(name) ?? 0;
  }

  adjust(name: string, delta: number) {
    this.set(name, this.get(name) + delta);
  }

  getAll(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, val] of this.affinity) out[name] = val;
    return out;
  }
}

export class RelationshipGraph {
  private edges: Map<string, Relationship> = new Map();

  private key(a: string, b: string) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  get(a: string, b: string): number {
    return this.edges.get(this.key(a, b))?.get(a) ?? 0;
  }

  adjust(a: string, b: string, delta: number) {
    const k = this.key(a, b);
    if (!this.edges.has(k)) this.edges.set(k, new Relationship());
    this.edges.get(k)!.adjust(a, delta);
  }

  set(a: string, b: string, value: number) {
    const k = this.key(a, b);
    if (!this.edges.has(k)) this.edges.set(k, new Relationship());
    this.edges.get(k)!.set(a, value);
  }

  /** Get all edges as [a, b, value] triples (from a's perspective) */
  getAllEdges(): [string, string, number][] {
    const out: [string, string, number][] = [];
    for (const [k, rel] of this.edges) {
      const [a, b] = k.split('|');
      const val = rel.get(a);
      if (val !== 0) out.push([a, b, val]);
    }
    return out;
  }

  /** Bulk-restore edges from save data */
  restoreEdges(edges: [string, string, number][]) {
    this.edges.clear();
    for (const [a, b, val] of edges) {
      this.set(a, b, val);
    }
  }
}
