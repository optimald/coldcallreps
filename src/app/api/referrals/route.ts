import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PLAN, REFERRAL_BONUS_MINUTES, REFERRAL_REWARD_LABEL } from '@/lib/product';

/** GET — your referral code + stats */
export async function GET() {
  try {
    const profile = await requireUser();
    const referrals = await prisma.referral.findMany({
      where: { referrerId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const rewarded = referrals.filter((r) => r.status === 'rewarded').length;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com';
    return NextResponse.json({
      code: profile.referralCode,
      link: `${appUrl}/sign-up?ref=${profile.referralCode}`,
      bonusMinutes: REFERRAL_BONUS_MINUTES,
      rewardLabel: REFERRAL_REWARD_LABEL,
      planLabel: PLAN.STARTER.label,
      planMinutes: PLAN.STARTER.minutes,
      rewardedCount: rewarded,
      referredByCode: profile.referredByCode || null,
      referrals,
      minutesRemaining: profile.minutesRemaining,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST — apply a referral code (referee). Idempotent if already applied. */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code required' }, { status: 400 });
    }

    if (profile.referredByCode) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        bonusMinutes: 0,
        message: 'Referral already applied',
      });
    }

    const existingRef = await prisma.referral.findUnique({
      where: { refereeId: profile.id },
    });
    if (existingRef) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        bonusMinutes: 0,
        message: 'Referral already applied',
      });
    }

    const normalized = code.trim().toUpperCase();
    if (normalized === profile.referralCode) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
    }

    const referrer = await prisma.userProfile.findUnique({
      where: { referralCode: normalized },
    });
    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    try {
      await prisma.$transaction([
        prisma.userProfile.update({
          where: { id: profile.id },
          data: {
            referredByCode: normalized,
            minutesRemaining: { increment: REFERRAL_BONUS_MINUTES },
          },
        }),
        prisma.userProfile.update({
          where: { id: referrer.id },
          data: { minutesRemaining: { increment: REFERRAL_BONUS_MINUTES } },
        }),
        prisma.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId: profile.id,
            code: normalized,
            status: 'rewarded',
            bonusMinutes: REFERRAL_BONUS_MINUTES,
            completedAt: new Date(),
          },
        }),
      ]);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json({
          ok: true,
          idempotent: true,
          bonusMinutes: 0,
          message: 'Referral already applied',
        });
      }
      throw err;
    }

    return NextResponse.json({
      ok: true,
      bonusMinutes: REFERRAL_BONUS_MINUTES,
      rewardLabel: REFERRAL_REWARD_LABEL,
      message: `You and your friend each got ${REFERRAL_REWARD_LABEL}.`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
