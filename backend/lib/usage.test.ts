import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertSpy = vi.hoisted(() => vi.fn());

vi.mock('./supabase-admin', () => ({
  supabaseAdmin: () => ({ from: () => ({ insert: insertSpy }) }),
}));

import { logUsage } from './usage';

describe('logUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a row with all provided fields', async () => {
    insertSpy.mockResolvedValueOnce({ error: null });

    await logUsage({
      userId: 'u',
      provider: 'r2',
      action: 'upload',
      bytesTransferred: 1024,
      episodeId: 'ep',
      requestId: 'req-1',
    });

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u',
        provider: 'r2',
        action: 'upload',
        bytes_transferred: 1024,
        episode_id: 'ep',
        request_id: 'req-1',
      }),
    );
  });

  it('swallows insert errors (must not block business flow)', async () => {
    insertSpy.mockResolvedValueOnce({ error: { message: 'db down' } });

    await expect(
      logUsage({ userId: 'u', provider: 'r2', action: 'upload' }),
    ).resolves.toBeUndefined();
  });
});
