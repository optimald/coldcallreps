import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

/** Restricted user submits a ban/suspension appeal. */
export async function POST(req: Request) {
  try {
    const profile = await requireUser({ allowSuspended: true });
    if (profile.accountStatus !== 'SUSPENDED' && profile.accountStatus !== 'BANNED') {
      return NextResponse.json({ error: 'Account is not restricted' }, { status: 400 });
    }

    const body = await req.json();
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) {
      return NextResponse.json({ error: 'reason required (min 5 chars)' }, { status: 400 });
    }

    const existing = await prisma.banAppeal.findFirst({
      where: { userId: profile.id, status: 'PENDING' },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'You already have a pending appeal', appeal: existing },
        { status: 409 }
      );
    }

    const appeal = await prisma.banAppeal.create({
      data: { userId: profile.id, reason },
    });

    await writeAudit({
      actorId: profile.id,
      action: 'user.appeal.create',
      targetType: 'BanAppeal',
      targetId: appeal.id,
      meta: { reason },
    });

    return NextResponse.json({ appeal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
