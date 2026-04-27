import { NextResponse } from 'next/server';
import type { ErrorCode } from '@shared/types';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function err(
  code: ErrorCode,
  message: string,
  details?: unknown,
  status = 400,
): NextResponse {
  const body =
    details === undefined
      ? { ok: false, error: { code, message } }
      : { ok: false, error: { code, message, details } };

  return NextResponse.json(body, { status });
}
