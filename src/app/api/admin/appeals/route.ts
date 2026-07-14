import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminAppealsQueue } from '@/lib/admin-ops-data';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function errResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Trust access required' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  try {
    await requireOps('trust.appeals');
    const data = await loadAdminAppealsQueue();
    return NextResponse.json(data);
  } catch (error) {
    return errResponse(error);
  }
}

export async function POST(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    // Users (or support on their behalf) open an appeal
    const admin = await requireOps('users.read');
    const body = await req.json();
    const userId = String(body.userId || '');
    const reason = String(body.reason || '').trim();
    if (!userId || reason.length < 5) {
      return NextResponse.json(
        { error: 'userId and reason (min 5 chars) required' },
        { status: 400 }
      );
    }

    const user = await prisma.userProfile.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.accountStatus === 'ACTIVE') {
      return NextResponse.json({ error: 'User is not restricted' }, { status: 400 });
    }

    const existing = await prisma.banAppeal.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (existing) {
      return NextResponse.json({ error: 'Pending appeal already exists', appeal: existing }, { status: 409 });
    }

    const appeal = await prisma.banAppeal.create({
      data: { userId, reason },
    });

    await writeAudit({
      actorId: admin.id,
      action: 'admin.appeal.create',
      targetType: 'BanAppeal',
      targetId: appeal.id,
      meta: { userId, reason },
    });

    return NextResponse.json({ appeal });
  } catch (error) {
    return errResponse(error);
  }
}

export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('trust.appeals');
    const body = await req.json();
    const appealId = String(body.appealId || '');
    const decision = String(body.decision || '').toUpperCase();
    const response = String(body.response || '').trim();

    if (!appealId || !['APPROVED', 'DENIED'].includes(decision)) {
      return NextResponse.json(
        { error: 'appealId and decision (APPROVED|DENIED) required' },
        { status: 400 }
      );
    }
    if (response.length < 3) {
      return NextResponse.json({ error: 'response required' }, { status: 400 });
    }

    const appeal = await prisma.banAppeal.findUnique({ where: { id: appealId } });
    if (!appeal || appeal.status !== 'PENDING') {
      return NextResponse.json({ error: 'Pending appeal not found' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.banAppeal.update({
        where: { id: appealId },
        data: {
          status: decision as 'APPROVED' | 'DENIED',
          response,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      if (decision === 'APPROVED') {
        await tx.userProfile.update({
          where: { id: appeal.userId },
          data: {
            accountStatus: 'ACTIVE',
            statusReason: null,
            statusChangedAt: new Date(),
            statusChangedById: admin.id,
          },
        });
      }
      return a;
    });

    await writeAudit({
      actorId: admin.id,
      action: `admin.appeal.${decision.toLowerCase()}`,
      targetType: 'BanAppeal',
      targetId: appealId,
      meta: { userId: appeal.userId, response, decision },
    });

    return NextResponse.json({ appeal: updated });
  } catch (error) {
    return errResponse(error);
  }
}
