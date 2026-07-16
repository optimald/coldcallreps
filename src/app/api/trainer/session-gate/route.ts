import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { rateLimitAsync } from '@/lib/rate-limit';
import { newGateJti, signGateToken, verifyGateToken } from '@/lib/gate-token';
import { createMinuteHold, getMinuteBalance, markHoldStarted } from '@/lib/minutes';
import { prisma } from '@/lib/prisma';
import { captureException } from '@/lib/observability';
import { isFirstTrainerSession, trackEvent, trackReturnSession } from '@/lib/posthog/analytics';

/**
 * Pre-call gate: reserves 1 minute via MinuteHold + signed token.
 * GET ?token=… — worker verifies (marks hold started; single-use start).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || '';
  const payload = verifyGateToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired gate token' }, { status: 401 });
  }

  const hold = await prisma.minuteHold.findUnique({ where: { id: payload.j } });
  if (!hold || hold.userId !== payload.u) {
    return NextResponse.json({ ok: false, error: 'Gate hold not found' }, { status: 401 });
  }
  if (hold.consumedAt) {
    return NextResponse.json({ ok: false, error: 'Gate already consumed' }, { status: 401 });
  }
  if (hold.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'Gate expired' }, { status: 401 });
  }
  // Allow re-verify of an already-started hold (worker retries) but not a second parallel start
  // after expiry window — startedAt is set once.
  const ok = await markHoldStarted(payload.j);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Gate hold invalid' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    userId: payload.u,
    minutesRemaining: payload.m,
    exp: payload.exp,
    holdId: payload.j,
    brandId: hold.brandId || payload.brandId || null,
    packId: hold.packId || payload.packId || null,
  });
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const rl = rateLimit({
      key: `session-gate:${profile.id}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many session starts. Wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    let brandId: string | null = null;
    let packId: string | null = null;
    try {
      const body = await req.json();
      brandId = body.brandId ? String(body.brandId).slice(0, 64) : null;
      packId = body.packId ? String(body.packId).slice(0, 64) : null;
    } catch {
      // empty body ok
    }

    // Validate pack belongs to brand when both provided
    if (packId) {
      const pack = await prisma.productPack.findFirst({
        where: { id: packId, active: true, ...(brandId ? { brandId } : {}) },
        select: { id: true, brandId: true },
      });
      if (!pack) {
        return NextResponse.json({ error: 'Invalid brand pack' }, { status: 400 });
      }
      brandId = pack.brandId;
      packId = pack.id;
    } else if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
      if (!brand) {
        return NextResponse.json({ error: 'Invalid brand' }, { status: 400 });
      }
    }

    if (brandId) {
      const { assertTrainerBrandAccess } = await import('@/lib/trainer-brand-access');
      const access = await assertTrainerBrandAccess(profile, brandId);
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
    }

    const jti = newGateJti();
    const held = await createMinuteHold({
      jti,
      userId: profile.id,
      minutes: 1,
      brandId,
      packId,
      ttlMs: 5 * 60_000,
    });

    if (!held.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: held.error,
          minutesRemaining: held.available,
        },
        { status: 402 }
      );
    }

    const balance = await getMinuteBalance(profile);
    const gateToken = signGateToken({
      u: profile.id,
      m: Math.max(held.available, 1),
      exp: Date.now() + 5 * 60_000,
      j: jti,
      brandId,
      packId,
    });

    const firstSession = await isFirstTrainerSession(profile.id);
    trackReturnSession(profile.id, profile.lastSessionDate, 'practice', {
      isFirstSession: firstSession,
    });
    trackEvent(profile.id, 'practice_session_started', {
      role: 'REP',
      brandId,
      packId,
      isFirstSession: firstSession,
      minutesRemaining: held.available,
    });

    return NextResponse.json({
      ok: true,
      minutesRemaining: held.available,
      personal: balance.personal,
      orgPool: balance.orgPool,
      source: balance.source,
      userId: profile.id,
      gateToken,
      holdId: jti,
      brandId,
      packId,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
