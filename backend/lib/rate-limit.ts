import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
}

export interface InMemoryOpts {
  limit: number;
  windowMs: number;
  now?: () => number;
}

const memoryLimiters = new Map<string, RateLimiter>();

export function createInMemoryRateLimiter(opts: InMemoryOpts): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const buckets = new Map<string, number[]>();

  return {
    async consume(key) {
      const timestamp = now();
      const cutoff = timestamp - opts.windowMs;
      const hits = (buckets.get(key) ?? []).filter((hit) => hit > cutoff);

      if (hits.length >= opts.limit) {
        const earliest = hits[0] ?? timestamp;
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((earliest + opts.windowMs - timestamp) / 1000)),
          remaining: 0,
        };
      }

      hits.push(timestamp);
      buckets.set(key, hits);

      return {
        allowed: true,
        retryAfterSec: 0,
        remaining: opts.limit - hits.length,
      };
    },
  };
}

function createUpstashLimiter(prefix: string, limit: number, windowSec: number): RateLimiter {
  const redis = new Redis({ url: env.UPSTASH_REDIS_URL, token: env.UPSTASH_REDIS_TOKEN });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix,
  });

  return {
    async consume(key) {
      const result = await limiter.limit(key);
      return {
        allowed: result.success,
        retryAfterSec: result.success
          ? 0
          : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        remaining: result.remaining,
      };
    },
  };
}

function isPlaceholder(): boolean {
  return env.UPSTASH_REDIS_URL.includes('example-placeholder');
}

export function getLimiter(name: 'signup-ip' | 'login-ip' | 'login-email'): RateLimiter {
  const configs = {
    'signup-ip': { limit: 10, windowSec: 3600 },
    'login-ip': { limit: 10, windowSec: 60 },
    'login-email': { limit: 5, windowSec: 60 },
  } as const;
  const cfg = configs[name];

  if (isPlaceholder()) {
    const existing = memoryLimiters.get(name);
    if (existing) {
      return existing;
    }

    const limiter = createInMemoryRateLimiter({
      limit: cfg.limit,
      windowMs: cfg.windowSec * 1000,
    });
    memoryLimiters.set(name, limiter);
    return limiter;
  }

  return createUpstashLimiter(`fg:${name}`, cfg.limit, cfg.windowSec);
}

export function extractClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
