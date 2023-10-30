import { Middleware } from '@curveball/kernel';
import { TooManyRequests } from '@curveball/http-errors';

import { RateLimitSettings, HTTPMethod } from './types.js';
import { RuleSet } from './rules.js';
import { RateLimitFactory } from './rate-limit.js';

const DEFAULT_TOO_MANY_REQUESTS_MESSAGE = 'Too many requests.';

export default function (settings: RateLimitSettings): Middleware {
  const store = settings.store;
  const rules = new RuleSet(settings.rules);

  // allow us to dynamically create rate limiters
  const factory = new RateLimitFactory(store);

  return async (ctx, next) => {
    // we retrieve the rule that matches the request
    const rule = rules.get(ctx.method as HTTPMethod, ctx.path);

    // if no rule matches or the request should be bypassed, we don't rate limit
    if (!rule || rule.bypass?.(ctx)) {
      return await next();
    }

    // we get the value we want to group requests by
    const group = rule.getGroupIdentifier(ctx);

    // we create the limiter
    const limiter = factory.get(rule.algorithm ?? 'fixed-window');

    // we check if the request is over the limit
    const result = await limiter.check(ctx, rule, group);

    if (result.isOveruse) {
      const m = rule.message ?? DEFAULT_TOO_MANY_REQUESTS_MESSAGE;
      throw new TooManyRequests(m, result.retryAfter);
    }

    await next();
  };
}

export { RedisRateLimitStore, MemoryRateLimitStore } from './stores';
