import { supabaseAdmin } from './supabase-admin';

export interface IdempotencyHit {
  status: 'success' | 'dead_letter';
  result: unknown;
}

export async function lookupIdempotency(
  key: string,
  userId: string,
): Promise<IdempotencyHit | null> {
  const { data, error } = await supabaseAdmin()
    .from('push_idempotency')
    .select('result_json,status')
    .eq('idempotency_key', key)
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    status: data.status as 'success' | 'dead_letter',
    result: data.result_json,
  };
}

export async function recordIdempotencySuccess(
  key: string,
  userId: string,
  result: unknown,
): Promise<void> {
  await supabaseAdmin().from('push_idempotency').insert({
    idempotency_key: key,
    user_id: userId,
    result_json: result as object,
    status: 'success',
  });
}

export async function recordIdempotencyDeadLetter(
  key: string,
  userId: string,
  error: unknown,
): Promise<void> {
  await supabaseAdmin().from('push_idempotency').insert({
    idempotency_key: key,
    user_id: userId,
    result_json: { error: String(error) },
    status: 'dead_letter',
  });
}

export async function cleanupExpiredIdempotency(): Promise<void> {
  await supabaseAdmin()
    .from('push_idempotency')
    .delete()
    .lt('expires_at', new Date().toISOString());
}
