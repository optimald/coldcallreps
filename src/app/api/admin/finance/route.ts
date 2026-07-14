import { NextResponse } from 'next/server';
import type { CampaignPayoutStatus } from '@prisma/client';
import { requireOps } from '@/lib/auth';
import { loadAdminFinanceLedger } from '@/lib/admin-ops-data';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function errResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Finance access required' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    await requireOps('finance.ledger');
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || 'ALL').toUpperCase() as
      | CampaignPayoutStatus
      | 'ALL';
    const q = searchParams.get('q') || '';
    const data = await loadAdminFinanceLedger({ status, q });
    return NextResponse.json(data);
  } catch (error) {
    return errResponse(error);
  }
}

export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('finance.payouts');
    const body = await req.json();
    const payoutId = String(body.payoutId || '');
    const action = String(body.action || '');
    const reason = String(body.reason || '').trim();

    if (!payoutId) {
      return NextResponse.json({ error: 'payoutId required' }, { status: 400 });
    }
    if (reason.length < 3) {
      return NextResponse.json({ error: 'reason required (min 3 chars)' }, { status: 400 });
    }

    const payout = await prisma.campaignPayout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    if (payout.status === 'CANCELED') {
      return NextResponse.json(
        { error: `Cannot ${action} a ${payout.status} payout` },
        { status: 400 }
      );
    }
    if (payout.status === 'PAID' && action !== 'dispute') {
      return NextResponse.json(
        { error: `Cannot ${action} a PAID payout (use dispute)` },
        { status: 400 }
      );
    }

    let nextStatus: CampaignPayoutStatus = payout.status;
    const data: {
      status?: CampaignPayoutStatus;
      holdReason?: string | null;
      heldAt?: Date | null;
      heldById?: string | null;
      disputeReason?: string | null;
      disputedAt?: Date | null;
    } = {};

    if (action === 'hold') {
      nextStatus = 'HELD';
      data.status = 'HELD';
      data.holdReason = reason;
      data.heldAt = new Date();
      data.heldById = admin.id;
      data.disputeReason = null;
      data.disputedAt = null;
    } else if (action === 'dispute') {
      nextStatus = 'DISPUTED';
      data.status = 'DISPUTED';
      data.disputeReason = reason;
      data.disputedAt = new Date();
    } else if (action === 'release_hold') {
      nextStatus = 'PENDING';
      data.status = 'PENDING';
      data.holdReason = null;
      data.heldAt = null;
      data.heldById = null;
      data.disputeReason = null;
      data.disputedAt = null;
    } else if (action === 'cancel') {
      nextStatus = 'CANCELED';
      data.status = 'CANCELED';
      data.holdReason = reason;
    } else {
      return NextResponse.json(
        { error: 'action must be hold | dispute | release_hold | cancel' },
        { status: 400 }
      );
    }

    const updated = await prisma.campaignPayout.update({
      where: { id: payoutId },
      data,
    });

    await writeAudit({
      actorId: admin.id,
      action: `admin.payout.${action}`,
      targetType: 'CampaignPayout',
      targetId: payoutId,
      meta: {
        before: payout.status,
        after: nextStatus,
        reason,
        grossCents: payout.grossCents,
        netCents: payout.netCents,
      },
    });

    return NextResponse.json({ payout: updated });
  } catch (error) {
    return errResponse(error);
  }
}
