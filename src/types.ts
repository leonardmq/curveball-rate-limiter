import { Context } from '@curveball/kernel';

export type RateLimitAlgorithm = 'fixed-window';

export type HTTPMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE'
  | 'CONNECT';

export const httpMethods: HTTPMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'TRACE',
  'CONNECT',
];

export type PathMatcher = (path: string) => boolean;

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

export type RateLimitSettings = {
  /**
   * The store to use for rate limiting.
   */
  store: RateLimitStore;

  /**
   * The rules to apply.
   */
  rules: Rule[];
};

export type Rule = {
  /**
   * The algorithm to use for rate limiting.
   *
   * The default is 'fixed-window'.
   */
  algorithm?: RateLimitAlgorithm;

  /**
   * The path that this rule applies to.
   */
  path: string | string[] | PathMatcher | '*';

  /**
   * The HTTP method that this rule applies to.
   */
  method: HTTPMethod | HTTPMethod[] | '*';

  /**
   * The maximum number of requests that are allowed in the given window.
   */
  limit: number;

  /**
   * The time window in milliseconds.
   */
  window: number;

  /**
   * The message to return when the limit is exceeded.
   *
   * The default is 'Too many requests.'.
   */
  message?: string;

  /**
   * A function that returns a string that is used to group requests together.
   * For example, you could group requests by IP address.
   */
  getGroupIdentifier: (ctx: Context) => string;

  /*
   * A function that returns a boolean that is used to determine if the rate limit should be applied.
   * For example, you could disable rate limiting for requests that are authenticated or for certain users.
   *
   * The default implementation returns false.
   */
  bypass?: (ctx: Context) => boolean;
};
