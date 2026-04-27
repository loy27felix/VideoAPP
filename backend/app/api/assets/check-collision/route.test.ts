import { beforeEach, describe, expect, it, vi } from 'vitest';

const EPISODE_ID = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  selectCollision: vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => mocks.selectCollision() }),
          }),
        }),
      }),
    }),
  }),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/assets/check-collision', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assets/check-collision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u-1', email: 'a@beva.com' } },
      error: null,
    });
  });

  it('returns existing when collision exists', async () => {
    mocks.selectCollision.mockResolvedValueOnce({
      data: {
        id: 'asset-1',
        version: 2,
        pushed_at: '2026-04-27T00:00:00Z',
        author: { display_name: 'Felix' },
      },
      error: null,
    });

    const res = await POST(
      makeReq({
        episode_id: EPISODE_ID,
        final_filename: '童话剧_侏儒怪_SCRIPT.md',
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data.existing).toEqual({
      id: 'asset-1',
      version: 2,
      author_name: 'Felix',
      pushed_at: '2026-04-27T00:00:00Z',
    });
  });

  it('returns no existing when collision is absent', async () => {
    mocks.selectCollision.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST(
      makeReq({
        episode_id: EPISODE_ID,
        final_filename: '童话剧_侏儒怪_SCRIPT.md',
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data.existing).toBeUndefined();
  });
});
