export interface RateLimitStore {
  /**
   * Increment the value of the key by 1 and return the new value.
   * If the key does not exist, create it with a value of 1.
   *
   * @param key The key to increment
   * @param ttl The time to live in seconds
   */
  increment(key: string, ttl: number): Promise<number>;
}
