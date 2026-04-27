import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: {
      refreshSession: mocks.refreshSession,
      admin: { signOut: mocks.signOut },
    },
  }),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 even for unknown token (idempotent)', async () => {
    mocks.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'invalid token' },
    });

    const res = await POST(makeReq({ refresh_token: 'anything' }));

    expect(res.status).toBe(200);
  });

  it('calls signOut with access token + global scope', async () => {
    mocks.refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'access-jwt' } },
      error: null,
    });
    mocks.signOut.mockResolvedValueOnce({ error: null });

    const res = await POST(makeReq({ refresh_token: 'rt' }));

    expect(res.status).toBe(200);
    expect(mocks.signOut).toHaveBeenCalledWith('access-jwt', 'global');
  });
});
