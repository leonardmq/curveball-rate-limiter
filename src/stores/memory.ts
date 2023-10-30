import { RateLimitStore } from '../types';

export class MemoryRateLimitStore implements RateLimitStore {
  private memory: Map<string, number>;

  private deletionsScheduled: Set<string>;

  constructor() {
    this.memory = new Map();
    this.deletionsScheduled = new Set();
  }

  private clear(key: string): void {
    this.memory.delete(key);
    this.deletionsScheduled.delete(key);
  }

  private scheduleDeletion(key: string, expire: number): void {
    this.deletionsScheduled.add(key);

    // add some slack to the deletion timing to deal with potential concurrency issues
    const slack = 5000;
    setTimeout(() => {
      this.clear(key);
    }, expire * 1000 + slack);
  }

  public async increment(key: string, expire: number): Promise<number> {
    const value = this.memory.get(key);
    const newValue = (value ?? 0) + 1;

    this.memory.set(key, newValue);

    // schedule the deletion of the key if it is not already scheduled
    if (!this.deletionsScheduled.has(key)) {
      this.scheduleDeletion(key, expire);
    }

    return newValue;
  }
}
