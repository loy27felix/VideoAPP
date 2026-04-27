import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRateLimiter } from './rate-limit';

describe('rate-limit (in-memory)', () => {
  let clock = 0;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_700_000_000_000;
  });

  it('allows up to N requests, then blocks', async () => {
    const limiter = createInMemoryRateLimiter({ limit: 3, windowMs: 60_000, now });

    for (let index = 0; index < 3; index += 1) {
      const result = await limiter.consume('key-a');
      expect(result.allowed).toBe(true);
    }

    const blocked = await limiter.consume('key-a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after window expires', async () => {
    const limiter = createInMemoryRateLimiter({ limit: 2, windowMs: 60_000, now });

    await limiter.consume('key-b');
    await limiter.consume('key-b');
    expect((await limiter.consume('key-b')).allowed).toBe(false);

    clock += 60_001;
    expect((await limiter.consume('key-b')).allowed).toBe(true);
  });

  it('tracks keys independently', async () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 60_000, now });

    expect((await limiter.consume('x')).allowed).toBe(true);
    expect((await limiter.consume('y')).allowed).toBe(true);
    expect((await limiter.consume('x')).allowed).toBe(false);
  });
});
