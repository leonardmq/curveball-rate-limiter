import * as sinon from 'sinon';
import { expect } from 'chai';
import { Context } from '@curveball/kernel';

import {
  FixedWindowRateLimiter,
  RateLimiterCheckResult,
} from '../src/rate-limit.js';
import { MemoryRateLimitStore } from '../src/stores/index.js';
import { Rule } from '../src/types.js';

describe('FixedWindowRateLimiter', () => {
  const store = new MemoryRateLimitStore();
  const rateLimiter = new FixedWindowRateLimiter(store);

  let dateNowStub: sinon.SinonStub<[], number>;

  beforeEach(() => {
    dateNowStub = sinon.stub(Date, 'now').returns(1000000000000); // mock current time
  });

  afterEach(() => {
    dateNowStub.restore();
    store.clearAll();
  });

  it('should correctly identify window', () => {
    const timestamp = 1000000;
    const windowSize = 60000;
    const expectedStart = 960000; // 60,000 * 16
    const windowStart = rateLimiter['getWindowStart'](timestamp, windowSize);
    expect(windowStart).to.be.equal(expectedStart);
  });

  it('should correctly identify window end', () => {
    const timestamp = 1000000;
    const windowSize = 60000;
    const expected = 1020000; // 60,000 * 17
    const end = rateLimiter['getWindowEnd'](timestamp, windowSize);
    expect(end).to.be.equal(expected);
  });

  it('should return isOveruse as true when over limit', async () => {
    const stub = sinon.stub(store, 'increment').resolves(11);

    const context: any = {
      method: 'GET',
      path: '/test',
      request: {
        headers: {
          'x-forwarded-for': '10.0.0.1',
        },
      },
    };

    const rule: Rule = {
      limit: 10,
      windowSize: 60000,
      path: '',
      method: 'GET',
      getActor: function (ctx: Context<any, any>): string {
        return ctx.ip(true) || '';
      },
    };

    const result: RateLimiterCheckResult = await rateLimiter.check(
      context,
      rule,
      '10.0.0.1',
    );

    stub.restore();

    expect(result.isOveruse).to.be.equal(true);
  });

  it('should return isOveruse as false when within limit', async () => {
    const stub = sinon.stub(store, 'increment').resolves(11);

    const context: any = {
      method: 'GET',
      path: '/test',
      request: {
        headers: {
          'x-forwarded-for': '10.0.0.1',
        },
      },
    };

    const rule: Rule = {
      limit: 15,
      windowSize: 60000,
      path: '',
      method: 'GET',
      getActor: function (ctx: Context<any, any>): string {
        return ctx.ip(true) || '';
      },
    };

    const result: RateLimiterCheckResult = await rateLimiter.check(
      context,
      rule,
      '10.0.0.1',
    );

    stub.restore();

    expect(result.isOveruse).to.be.equal(false);
  });
});
