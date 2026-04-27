import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ auth: { refreshSession: mocks.refresh } }),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 on empty refresh_token', async () => {
    const res = await POST(makeReq({ refresh_token: '' }));

    expect(res.status).toBe(400);
  });

  it('401 on invalid refresh_token', async () => {
    mocks.refresh.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'expired' },
    });

    const res = await POST(makeReq({ refresh_token: 'bad' }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('200 on success returns new access + refresh', async () => {
    mocks.refresh.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'new-at',
          refresh_token: 'new-rt',
          expires_at: 1_700_000_500,
        },
      },
      error: null,
    });

    const res = await POST(makeReq({ refresh_token: 'old-rt' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_at: 1_700_000_500,
      },
    });
  });
});
