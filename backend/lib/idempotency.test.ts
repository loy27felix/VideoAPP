import { beforeEach, describe, expect, it, vi } from 'vitest';

const supaMocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('./supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: () => ({ maybeSingle: async () => supaMocks.select() }),
          }),
        }),
      }),
      insert: supaMocks.insert,
      delete: () => ({ lt: vi.fn(async () => ({ error: null })) }),
    }),
  }),
}));

import { lookupIdempotency, recordIdempotencySuccess } from './idempotency';

describe('lookupIdempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no row', async () => {
    supaMocks.select.mockResolvedValueOnce({ data: null, error: null });

    expect(await lookupIdempotency('key', 'user')).toBeNull();
  });

  it('returns cached result when found', async () => {
    supaMocks.select.mockResolvedValueOnce({
      data: { result_json: { x: 1 }, status: 'success' },
      error: null,
    });

    expect(await lookupIdempotency('key', 'user')).toEqual({
      status: 'success',
      result: { x: 1 },
    });
  });
});

describe('recordIdempotencySuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a success row', async () => {
    supaMocks.insert.mockResolvedValueOnce({ error: null });

    await recordIdempotencySuccess('k', 'u', { foo: 'bar' });

    expect(supaMocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotency_key: 'k',
        user_id: 'u',
        status: 'success',
      }),
    );
  });
});
