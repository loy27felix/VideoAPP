export const runtime = 'edge';

import { err, ok } from '@/lib/api-response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logoutSchema } from '@/lib/validators';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400);
  }

  const parsed = logoutSchema.safeParse(body);

  if (!parsed.success) {
    return err('PAYLOAD_MALFORMED', parsed.error.issues[0]?.message ?? 'Invalid payload', undefined, 400);
  }

  const admin = supabaseAdmin();
  const { data } = await admin.auth.refreshSession({
    refresh_token: parsed.data.refresh_token,
  });
  const accessToken = data.session?.access_token;

  if (accessToken) {
    await admin.auth.admin.signOut(accessToken, 'global').catch(() => {});
  }

  return ok({});
}
