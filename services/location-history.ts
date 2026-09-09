export type RecentLocation = { key: string; timestamp: number };
export interface LocationHistory {
  list(): Promise<RecentLocation[]>;
  record(key: string): Promise<void>;
}
export class MemoryLocationHistory implements LocationHistory {
  private entries: RecentLocation[] = [];
  constructor(private limit = 75) {}
  async list() {
    return this.entries.map((entry) => ({ ...entry }));
  }
  async record(key: string) {
    this.entries = [
      ...this.entries.filter((entry) => entry.key !== key),
      { key, timestamp: Date.now() },
    ].slice(-this.limit);
  }
}
