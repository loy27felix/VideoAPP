export const runtime = 'edge';

import type { ErrorCode, AuthResult } from '@shared/types';
import { err, ok } from '@/lib/api-response';
import { extractClientIp, getLimiter } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signupSchema } from '@/lib/validators';

function validationErrorCode(path: string): ErrorCode {
  if (path === 'email') {
    return 'INVALID_EMAIL_DOMAIN';
  }

  if (path === 'password') {
    return 'WEAK_PASSWORD';
  }

  if (path === 'display_name') {
    return 'DISPLAY_NAME_REQUIRED';
  }

  return 'PAYLOAD_MALFORMED';
}

export async function POST(req: Request): Promise<Response> {
  const ip = extractClientIp(req);
  const rateLimit = await getLimiter('signup-ip').consume(ip);

  if (!rateLimit.allowed) {
    const res = err('RATE_LIMITED', 'Too many signup attempts', undefined, 429);
    res.headers.set('retry-after', String(rateLimit.retryAfterSec));
    return res;
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400);
  }

  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '';
    return err(validationErrorCode(path), first?.message ?? 'Invalid payload', { path }, 400);
  }

  const { email, password, display_name } = parsed.data;
  const admin = supabaseAdmin();
  const { data: createResult, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !createResult.user) {
    const message = createError?.message ?? 'Unknown signup failure';

    if (/already been registered|already exists/i.test(message)) {
      return err('EMAIL_ALREADY_EXISTS', 'Email already registered', undefined, 409);
    }

    return err('INTERNAL_ERROR', message, undefined, 500);
  }

  const userId = createResult.user.id;
  const { error: insertError } = await admin.from('users').insert({
    id: userId,
    email,
    display_name,
    team: 'FableGlitch',
    role: 'member',
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return err('INTERNAL_ERROR', insertError.message, undefined, 500);
  }

  const { data: signInResult, error: signInError } = await admin.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInResult.session) {
    return err('INTERNAL_ERROR', signInError?.message ?? 'Session issue failed', undefined, 500);
  }

  const result: AuthResult = {
    user: {
      id: userId,
      email,
      display_name,
      team: 'FableGlitch',
      role: 'member',
    },
    session: {
      access_token: signInResult.session.access_token,
      refresh_token: signInResult.session.refresh_token,
      expires_at: signInResult.session.expires_at ?? 0,
    },
  };

  return ok(result, 201);
}
