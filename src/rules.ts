import { HTTPMethod, Rule, httpMethods } from './types.js';

export type RuleCallbackMatcher = (path: string) => Rule | undefined;

export class RuleSet {
  /**
   * A map of endpoint rules to their corresponding rule.
   * The key is a combination of the HTTP method and the path.
   * For example: 'GET:/foo/bar'
   */
  private endpointRules: Map<string, Rule>;

  /**
   * A list of callback rules.
   * These rules are checked after the endpoint rules if no endpoint rule
   * matches.
   * The first rule that matches is used.
   */
  private callbackRules: RuleCallbackMatcher[];

  constructor(rules: Rule[]) {
    this.endpointRules = new Map();
    this.callbackRules = [];

    this.build(rules);
  }

  /**
   * This initializes the endpoint rules and the callback rules.
   */
  private build(rules: Rule[]) {
    for (const rule of rules) {
      const paths: string[] = [];

      const methods: HTTPMethod[] = [];

      if (typeof rule.method === 'string') {
        // check if method is string
        if (rule.method === '*') {
          for (const method of httpMethods) {
            methods.push(method);
          }
        } else {
          methods.push(rule.method);
        }
      } else if (Array.isArray(rule.method)) {
        // check if method is array
        for (const method of rule.method) {
          methods.push(method);
        }
      } else {
        throw new Error('method must be string or array');
      }

      if (typeof rule.path === 'string') {
        paths.push(rule.path);
      } else if (Array.isArray(rule.path)) {
        for (const path of rule.path) {
          paths.push(path);
        }
      } else if (typeof rule.path === 'function') {
        // if the path is a function, we add it to the callback rules
        // which will be checked after the endpoint rules
        const callback = (path: string): Rule | undefined => {
          const matcher = rule.path as (path: string) => boolean;
          const isMatch = matcher(path);
          if (isMatch) {
            return rule;
          }
        };

        this.callbackRules.push(callback);
      } else {
        throw new Error('path must be string or array');
      }

      for (const method of methods) {
        for (const key of paths) {
          this.endpointRules.set(`${method}:${key}`, rule);
        }
      }
    }
  }

  /**
   * Returns the rule that matches the given method and path.
   * If no rule matches, undefined is returned.
   */
  public get(method: HTTPMethod, path: string): Rule | undefined {
    const rule = this.endpointRules.get(`${method}:${path}`);
    if (rule) {
      return rule;
    }

    for (const callback of this.callbackRules) {
      const rule = callback(path);
      if (rule) {
        return rule;
      }
    }
  }
}
