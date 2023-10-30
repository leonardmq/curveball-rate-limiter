import { Context } from '@curveball/kernel';
import { millisecondsToSeconds } from './time.js';
import { RateLimitAlgorithm, Rule } from './types.js';
import { RateLimitStore } from './stores/index.js';

export interface RateLimiterCheckResult {
  /**
   * The timestamp after which the request should be retried.
   */
  retryAfter: number;

  /**
   * True if the request is over the limit.
   */
  isOveruse: boolean;
}

export interface RateLimiter {
  /**
   * Returns true if the request should be rate limited.
   *
   * @param ctx The request context.
   * @param rule The rule that matched.
   * @param group The group identifier.
   * @returns True if the request should be rate limited. False otherwise.
   */
  check: (
    ctx: Context,
    rule: Rule,
    group: string,
  ) => Promise<RateLimiterCheckResult>;
}

export class FixedWindowRateLimiter implements RateLimiter {
  private store: RateLimitStore;

  constructor(store: RateLimitStore) {
    this.store = store;
  }

  /**
   * Returns the index of the window that the given timestamp falls into.
   *
   * The index is the number of windows of size windowSize that have passed
   *
   * @param ts The timestamp in milliseconds.
   * @param windowSize The size of the window in milliseconds.
   * @returns The index of the window.
   */
  private getWindowIdx(ts: number, windowSize: number): number {
    return Math.floor(ts / windowSize);
  }

  /**
   * Returns the timestamp of the end of the window with the given index.
   *
   * @param windowIdx The index of the window.
   * @param windowSize The size of the window in milliseconds.
   * @returns The timestamp of the end of the window.
   */
  private getWindowEnd(windowIdx: number, windowSize: number): number {
    // the end of the window is the start of the next window
    return (windowIdx + 1) * windowSize;
  }

  public async check(
    ctx: Context,
    rule: Rule,
    group: string,
  ): Promise<RateLimiterCheckResult> {
    const now = Date.now();

    const currWindowIdx = this.getWindowIdx(now, rule.window);
    const currWindowEnd = this.getWindowEnd(currWindowIdx, rule.window);

    const path = ctx.path;
    const method = ctx.method;
    const key = `${group}:${path}:${method}:${currWindowIdx}`;

    // increment the counter for the current window and expire it when the
    // window ends
    const ttl = millisecondsToSeconds(currWindowEnd - now);
    const count = await this.store.increment(key, ttl);

    return {
      retryAfter: currWindowEnd,
      isOveruse: count > rule.limit,
    };
  }
}

export class RateLimitFactory {
  private store: RateLimitStore;

  private algorithms: Map<string, RateLimiter> = new Map();

  constructor(store: RateLimitStore) {
    this.store = store;
  }

  public get(algorithm: RateLimitAlgorithm): RateLimiter {
    if (!this.algorithms.has(algorithm)) {
      switch (algorithm) {
        case 'fixed-window': {
          this.algorithms.set(
            algorithm,
            new FixedWindowRateLimiter(this.store),
          );
          break;
        }
        default:
          throw new Error(`Unknown algorithm: ${algorithm}`);
      }
    }

    return this.algorithms.get(algorithm) as RateLimiter;
  }
}
