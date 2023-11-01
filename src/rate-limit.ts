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
   * @param endpoint An arbitrary identifier for the endpoint that was requested (e.g. 'GET:/foo/bar').
   * @param rule The rule that matched.
   * @param actor An arbitrary identifier for the actor that made the request.
   * @returns True if the request should be rate limited. False otherwise.
   */
  check: (
    endpoint: string,
    rule: Rule,
    actor: string,
  ) => Promise<RateLimiterCheckResult>;
}

export class FixedWindowRateLimiter implements RateLimiter {
  private store: RateLimitStore;

  constructor(store: RateLimitStore) {
    this.store = store;
  }

  /**
   * Returns the timestamp of the start of the window that the given timestamp falls into.
   *
   * @param ts The timestamp in milliseconds.
   * @param windowSize The size of the window in milliseconds.
   * @returns The index of the window.
   */
  private getWindowStart(ts: number, windowSize: number): number {
    return Math.floor(ts / windowSize) * windowSize;
  }

  /**
   * Returns the timestamp of the end of the window with the given index.
   *
   * @param windowIdx The index of the window.
   * @param windowSize The size of the window in milliseconds.
   * @returns The timestamp of the end of the window.
   */
  private getWindowEnd(windowStart: number, windowSize: number): number {
    // the end of the window is the start of the next window
    return windowStart + windowSize;
  }

  public async check(
    endpoint: string,
    rule: Rule,
    actor: string,
  ): Promise<RateLimiterCheckResult> {
    const now = Date.now();

    const windowSize = rule.windowSize;
    const currWindowStart = this.getWindowStart(now, windowSize);
    const currWindowEnd = this.getWindowEnd(currWindowStart, windowSize);

    const key = `${actor}:${endpoint}:${currWindowStart}`;

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

export class RateLimiterProvider {
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
