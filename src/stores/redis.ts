import { Cluster } from 'ioredis';
import { RateLimitStore } from './store.js';

export class RedisRateLimitStore implements RateLimitStore {
  private redis: Cluster;

  constructor(redis: Cluster) {
    this.redis = redis;
  }

  public async increment(key: string, expire: number): Promise<number> {
    const result = await this.redis
      .multi()
      .incr(key)
      .expire(key, expire)
      .exec();

    if (!result) {
      throw new Error('Redis returned null');
    }

    if (result[0][0]) {
      throw result[0][0];
    }

    return parseInt(result[0][1] as string, 10);
  }
}
