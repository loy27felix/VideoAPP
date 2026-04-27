import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid-token') {
          return { data: { user: { id: 'user-uuid', email: 'test@beva.com' } }, error: null };
        }

        return { data: { user: null }, error: { message: 'invalid token' } };
      }),
    },
  }),
}));

import { requireUser } from './auth-guard';

describe('requireUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without Authorization header', async () => {
    const result = await requireUser(new Request('http://localhost/api/anything'));
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });

  it('rejects malformed Authorization header', async () => {
    const result = await requireUser(
      new Request('http://localhost/api/anything', {
        headers: { authorization: 'NotBearer xxx' },
      }),
    );

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });

  it('accepts valid token and returns user', async () => {
    const result = await requireUser(
      new Request('http://localhost/api/anything', {
        headers: { authorization: 'Bearer valid-token' },
      }),
    );

    expect(result).toEqual({ user_id: 'user-uuid', email: 'test@beva.com' });
  });

  it('rejects invalid token with 401', async () => {
    const result = await requireUser(
      new Request('http://localhost/api/anything', {
        headers: { authorization: 'Bearer invalid-token' },
      }),
    );

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
    }
  });
});
