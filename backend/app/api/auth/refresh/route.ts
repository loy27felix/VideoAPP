export const runtime = 'edge';

import { err, ok } from '@/lib/api-response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { refreshSchema } from '@/lib/validators';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400);
  }

  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    return err('PAYLOAD_MALFORMED', parsed.error.issues[0]?.message ?? 'Invalid payload', undefined, 400);
  }

  const { data, error } = await supabaseAdmin().auth.refreshSession({
    refresh_token: parsed.data.refresh_token,
  });

  if (error || !data.session) {
    return err('INVALID_REFRESH_TOKEN', 'Refresh token invalid or expired', undefined, 401);
  }

  return ok({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? 0,
  });
}
