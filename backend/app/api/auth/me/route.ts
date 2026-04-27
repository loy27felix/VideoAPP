export const runtime = 'edge';

import { err, ok } from '@/lib/api-response';
import { requireUser } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireUser(req);

  if (auth instanceof Response) {
    return auth;
  }

  const { data, error } = await supabaseAdmin()
    .from('users')
    .select('id,email,display_name,team,role')
    .eq('id', auth.user_id)
    .single();

  if (error || !data) {
    return err('INTERNAL_ERROR', 'User row missing', undefined, 500);
  }

  return ok({
    user: {
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      team: data.team,
      role: data.role,
    },
  });
}
