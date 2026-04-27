import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('env loader', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws if SUPABASE_URL missing', async () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_KEY = 'x';
    process.env.SUPABASE_ANON_KEY = 'x';
    process.env.SUPABASE_JWT_SECRET = 'x';
    process.env.UPSTASH_REDIS_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'x';

    await expect(import('./env')).rejects.toThrow(/SUPABASE_URL/);
  });

  it('throws if SUPABASE_URL is not a URL', async () => {
    process.env.SUPABASE_URL = 'not-a-url';
    process.env.SUPABASE_SERVICE_KEY = 'x';
    process.env.SUPABASE_ANON_KEY = 'x';
    process.env.SUPABASE_JWT_SECRET = 'x';
    process.env.UPSTASH_REDIS_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'x';

    await expect(import('./env')).rejects.toThrow();
  });

  it('loads valid env', async () => {
    process.env.SUPABASE_URL = 'https://abc.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'svc';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_JWT_SECRET = 'jwt';
    process.env.UPSTASH_REDIS_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'tok';

    const { env } = await import('./env');
    expect(env.SUPABASE_URL).toBe('https://abc.supabase.co');
    expect(env.SUPABASE_SERVICE_KEY).toBe('svc');
  });
});
