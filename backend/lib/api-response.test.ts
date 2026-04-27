import { describe, expect, it } from 'vitest';
import { err, ok } from './api-response';

describe('api-response', () => {
  it('ok() wraps data with ok:true and default 200', async () => {
    const res = ok({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { hello: 'world' } });
  });

  it('ok() honors explicit status', () => {
    const res = ok({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });

  it('err() wraps error with ok:false', async () => {
    const res = err('INVALID_CREDENTIALS', 'Bad login', undefined, 401);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Bad login' },
    });
  });

  it('err() includes details when provided', async () => {
    const res = err('PAYLOAD_MALFORMED', 'nope', { field: 'email' }, 400);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'PAYLOAD_MALFORMED', message: 'nope', details: { field: 'email' } },
    });
  });
});
