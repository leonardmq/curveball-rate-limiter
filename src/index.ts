import { Middleware } from '@curveball/kernel';
import { TooManyRequests } from '@curveball/http-errors';

import { RateLimitSettings, HTTPMethod, Rule } from './types.js';
import { RuleSet } from './rules.js';
import { RateLimiterProvider } from './rate-limit.js';

const DEFAULT_TOO_MANY_REQUESTS_MESSAGE = 'Too many requests.';

function getEndpointKey(method: HTTPMethod, path: string): string {
  return `${method}:${path}`;
}

function getMessage(rule: Rule): string {
  return rule.message ?? DEFAULT_TOO_MANY_REQUESTS_MESSAGE;
}

/**
 * This middleware implements rate limiting.
 *
 * It uses a set of rules to determine if a request should be rate limited.
 * If a request is rate limited, a TooManyRequests error is thrown.
 *
 * @param settings The settings for the rate limiter.
 */
export default function (settings: RateLimitSettings): Middleware {
  const store = settings.store;
  const rules = new RuleSet(settings.rules);

  // allow us to dynamically create rate limiters based on the algorithm
  // specified in the rule
  const factory = new RateLimiterProvider(store);

  return async (ctx, next) => {
    const rule = rules.get(ctx.method as HTTPMethod, ctx.path);
    if (!rule || rule.bypass?.(ctx)) {
      return await next();
    }

    const limiter = factory.get(rule.algorithm ?? 'fixed-window');
    const endpoint = getEndpointKey(ctx.method as HTTPMethod, ctx.path);
    const actor = rule.getActor(ctx);

    const result = await limiter.check(endpoint, rule, actor);
    if (result.isOveruse) {
      throw new TooManyRequests(getMessage(rule), result.retryAfter);
    }

    await next();
  };
}

export { RedisRateLimitStore, MemoryRateLimitStore } from './stores';
