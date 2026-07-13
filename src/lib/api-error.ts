import { NextResponse } from 'next/server';

/**
 * Map caught errors to safe JSON responses.
 * Never return raw Prisma/Stripe/internal messages to clients on 500s.
 */
export function jsonCaughtError(
  error: unknown,
  fallback = 'Internal server error'
): NextResponse {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  console.error('[api]', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
