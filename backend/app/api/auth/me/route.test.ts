import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  selectSingle: vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => mocks.selectSingle() }) }),
    }),
  }),
}));

import { GET } from './route';

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 without Bearer token', async () => {
    const res = await GET(new Request('http://localhost/api/auth/me'));

    expect(res.status).toBe(401);
  });

  it('401 with bad token', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'bad' },
    });

    const res = await GET(
      new Request('http://localhost/api/auth/me', {
        headers: { authorization: 'Bearer bad-token' },
      }),
    );

    expect(res.status).toBe(401);
  });

  it('200 with valid token returns user row', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: { id: 'uid-9', email: 'x@beva.com' } },
      error: null,
    });
    mocks.selectSingle.mockResolvedValueOnce({
      data: {
        id: 'uid-9',
        email: 'x@beva.com',
        display_name: '林',
        team: 'FableGlitch',
        role: 'member',
      },
      error: null,
    });

    const res = await GET(
      new Request('http://localhost/api/auth/me', {
        headers: { authorization: 'Bearer good-token' },
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data.user.display_name).toBe('林');
  });
});
