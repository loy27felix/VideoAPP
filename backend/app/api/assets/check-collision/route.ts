export const runtime = 'edge';

import { z } from 'zod';
import { err, ok } from '@/lib/api-response';
import { requireUser } from '@/lib/auth-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';

const bodySchema = z.object({
  episode_id: z.uuid(),
  final_filename: z.string().min(1),
});

interface CollisionRow {
  id: string;
  version: number;
  pushed_at: string | null;
  author?: {
    display_name?: string | null;
  } | null;
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);

  if (auth instanceof Response) {
    return auth;
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400);
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return err('PAYLOAD_MALFORMED', parsed.error.issues[0]?.message ?? 'Invalid payload', undefined, 400);
  }

  const { data } = await supabaseAdmin()
    .from('assets')
    .select('id,version,pushed_at,author:author_id(display_name)')
    .eq('episode_id', parsed.data.episode_id)
    .eq('final_filename', parsed.data.final_filename)
    .eq('status', 'pushed')
    .maybeSingle<CollisionRow>();

  if (!data) {
    return ok({});
  }

  return ok({
    existing: {
      id: data.id,
      version: data.version,
      author_name: data.author?.display_name,
      pushed_at: data.pushed_at,
    },
  });
}
