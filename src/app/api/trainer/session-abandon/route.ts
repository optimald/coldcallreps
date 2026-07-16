import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { settleAbandonedHold } from '@/lib/minutes';
import { trackEvent } from '@/lib/posthog/analytics';

/**
 * POST — bill elapsed minutes when a practice call ends without a scorecard.
 * Body: { gateHoldId, durationSecs? }
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const rl = rateLimit({
      key: `session-abandon:${profile.id}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const holdId = String(body.gateHoldId || body.holdId || '').trim();
    if (!holdId) {
      return NextResponse.json({ error: 'gateHoldId required' }, { status: 400 });
    }
    const durationSecs =
      typeof body.durationSecs === 'number'
        ? Math.max(0, Math.min(3600, Math.floor(body.durationSecs)))
        : undefined;

    const result = await settleAbandonedHold({
      userId: profile.id,
      holdId,
      durationSecs,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.billed && !result.alreadySettled) {
      trackEvent(profile.id, 'practice_session_abandoned', {
        role: 'REP',
        holdId,
        durationSecs: durationSecs ?? null,
        minutesBilled: result.billed,
      });
    }

    return NextResponse.json({
      ok: true,
      billed: result.billed,
      minutesRemaining: result.remaining,
      alreadySettled: result.alreadySettled || false,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[session-abandon]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
