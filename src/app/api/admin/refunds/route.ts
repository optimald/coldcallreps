import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { creditWallet } from '@/lib/escrow';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function err(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Refund access required' }, { status: 403 });
  }
  console.error('[admin/refunds]', error);
  return NextResponse.json(
    { error: message || 'Internal server error' },
    { status: 500 }
  );
}

function money(cents: number, currency = 'usd') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

const OPEN_STATUSES = new Set([
  'needs_response',
  'warning_needs_response',
  'under_review',
  'warning_under_review',
]);

function mapDispute(d: {
  id: string;
  stripeDisputeId: string;
  chargeId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  reason: string | null;
  status: string;
  evidenceDueBy: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const due = d.evidenceDueBy;
  const dueMs = due ? due.getTime() - Date.now() : null;
  return {
    id: d.id,
    stripeDisputeId: d.stripeDisputeId,
    chargeId: d.chargeId,
    paymentIntentId: d.paymentIntentId,
    amountCents: d.amountCents,
    currency: d.currency,
    amountLabel: money(d.amountCents, d.currency),
    reason: d.reason,
    status: d.status,
    isOpen: OPEN_STATUSES.has(d.status),
    evidenceDueBy: due?.toISOString() ?? null,
    evidenceDueLabel: due ? due.toLocaleDateString() : null,
    evidenceOverdue: dueMs != null ? dueMs < 0 && OPEN_STATUSES.has(d.status) : false,
    evidenceDueSoon:
      dueMs != null ? dueMs >= 0 && dueMs < 3 * 86400000 && OPEN_STATUSES.has(d.status) : false,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    stripeUrl: `https://dashboard.stripe.com/disputes/${d.stripeDisputeId}`,
  };
}

/**
 * Admin refund tooling — Stripe payment refunds + escrow wallet credit.
 * Chargeback inbox: sync / accept (close) disputes; evidence stays in Stripe.
 */
export async function POST(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('finance.refunds');
    const body = await req.json();
    const kind = String(body.kind || '');
    const reason = String(body.reason || '').trim();
    if (reason.length < 3) {
      return NextResponse.json({ error: 'reason required' }, { status: 400 });
    }

    if (kind === 'stripe_payment') {
      const paymentIntentId = String(body.paymentIntentId || '');
      const amountCents = body.amountCents
        ? Math.floor(Number(body.amountCents))
        : undefined;
      if (!paymentIntentId) {
        return NextResponse.json({ error: 'paymentIntentId required' }, { status: 400 });
      }
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(amountCents ? { amount: amountCents } : {}),
        reason: 'requested_by_customer',
        metadata: {
          adminId: admin.id,
          note: reason.slice(0, 450),
        },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.refund.stripe',
        targetType: 'StripeRefund',
        targetId: refund.id,
        meta: { paymentIntentId, amountCents: refund.amount, reason },
      });
      return NextResponse.json({
        refund: { id: refund.id, amount: refund.amount, status: refund.status },
      });
    }

    if (kind === 'escrow_wallet') {
      const brandId = String(body.brandId || '');
      const amountCents = Math.floor(Number(body.amountCents) || 0);
      if (!brandId || amountCents < 1) {
        return NextResponse.json(
          { error: 'brandId and amountCents required' },
          { status: 400 }
        );
      }
      await creditWallet({
        brandId,
        amountCents,
        type: 'ESCROW_REFUND',
        note: `admin_refund:${reason}`,
        campaignId: body.campaignId ? String(body.campaignId) : undefined,
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.refund.escrow',
        targetType: 'Brand',
        targetId: brandId,
        meta: { amountCents, reason },
      });
      return NextResponse.json({ ok: true });
    }

    if (kind === 'minutes') {
      const userId = String(body.userId || '');
      const minutes = Math.floor(Number(body.minutes) || 0);
      if (!userId || minutes < 1) {
        return NextResponse.json(
          { error: 'userId and minutes required' },
          { status: 400 }
        );
      }
      const user = await prisma.userProfile.update({
        where: { id: userId },
        data: { minutesRemaining: { increment: minutes } },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.refund.minutes',
        targetType: 'UserProfile',
        targetId: userId,
        meta: { minutes, reason, after: user.minutesRemaining },
      });
      return NextResponse.json({ user });
    }

    return NextResponse.json(
      { error: 'kind must be stripe_payment | escrow_wallet | minutes' },
      { status: 400 }
    );
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('finance.refunds');
    const body = await req.json();
    const action = String(body.action || '');
    const disputeId = String(body.disputeId || body.id || '');
    const note = String(body.note || body.reason || '').trim();

    if (!disputeId && action !== 'sync_open') {
      return NextResponse.json({ error: 'disputeId required' }, { status: 400 });
    }

    const stripe = getStripe();

    if (action === 'sync' || action === 'sync_open') {
      if (action === 'sync_open') {
        const listed = await stripe.disputes.list({ limit: 25 });
        let upserted = 0;
        for (const dispute of listed.data) {
          const evidenceDue =
            dispute.evidence_details?.due_by != null
              ? new Date(dispute.evidence_details.due_by * 1000)
              : null;
          await prisma.stripeDisputeRecord.upsert({
            where: { stripeDisputeId: dispute.id },
            create: {
              stripeDisputeId: dispute.id,
              chargeId:
                typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id,
              paymentIntentId:
                typeof dispute.payment_intent === 'string'
                  ? dispute.payment_intent
                  : dispute.payment_intent?.id || null,
              amountCents: dispute.amount,
              currency: dispute.currency,
              reason: dispute.reason,
              status: dispute.status,
              evidenceDueBy: evidenceDue,
              rawJSON: JSON.stringify(dispute).slice(0, 8000),
            },
            update: {
              status: dispute.status,
              reason: dispute.reason,
              evidenceDueBy: evidenceDue,
              amountCents: dispute.amount,
              rawJSON: JSON.stringify(dispute).slice(0, 8000),
            },
          });
          upserted += 1;
        }
        await writeAudit({
          actorId: admin.id,
          action: 'admin.dispute.sync_open',
          targetType: 'StripeDispute',
          meta: { upserted },
        });
        return NextResponse.json({ ok: true, upserted });
      }

      const row = await prisma.stripeDisputeRecord.findUnique({
        where: { id: disputeId },
      });
      if (!row) {
        return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
      }
      const dispute = await stripe.disputes.retrieve(row.stripeDisputeId);
      const evidenceDue =
        dispute.evidence_details?.due_by != null
          ? new Date(dispute.evidence_details.due_by * 1000)
          : null;
      const updated = await prisma.stripeDisputeRecord.update({
        where: { id: row.id },
        data: {
          status: dispute.status,
          reason: dispute.reason,
          evidenceDueBy: evidenceDue,
          amountCents: dispute.amount,
          currency: dispute.currency,
          chargeId:
            typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id,
          paymentIntentId:
            typeof dispute.payment_intent === 'string'
              ? dispute.payment_intent
              : dispute.payment_intent?.id || null,
          rawJSON: JSON.stringify(dispute).slice(0, 8000),
        },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.dispute.sync',
        targetType: 'StripeDispute',
        targetId: updated.stripeDisputeId,
        meta: { status: updated.status },
      });
      return NextResponse.json({ dispute: mapDispute(updated) });
    }

    if (action === 'accept') {
      if (note.length < 3) {
        return NextResponse.json(
          { error: 'note required (why accepting)' },
          { status: 400 }
        );
      }
      const row = await prisma.stripeDisputeRecord.findUnique({
        where: { id: disputeId },
      });
      if (!row) {
        return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
      }
      if (!OPEN_STATUSES.has(row.status) && row.status !== 'warning_closed') {
        // still allow close attempt if Stripe says open
      }
      const closed = await stripe.disputes.close(row.stripeDisputeId);
      const evidenceDue =
        closed.evidence_details?.due_by != null
          ? new Date(closed.evidence_details.due_by * 1000)
          : null;
      const updated = await prisma.stripeDisputeRecord.update({
        where: { id: row.id },
        data: {
          status: closed.status,
          reason: closed.reason,
          evidenceDueBy: evidenceDue,
          rawJSON: JSON.stringify(closed).slice(0, 8000),
        },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.dispute.accept',
        targetType: 'StripeDispute',
        targetId: updated.stripeDisputeId,
        meta: { note, status: updated.status },
      });
      return NextResponse.json({ dispute: mapDispute(updated) });
    }

    return NextResponse.json(
      { error: 'action must be sync | sync_open | accept' },
      { status: 400 }
    );
  } catch (e) {
    return err(e);
  }
}

export async function GET(req: Request) {
  try {
    await requireOps('finance.refunds');
    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get('filter') || 'open').toLowerCase();

    const where =
      filter === 'all'
        ? {}
        : filter === 'closed'
          ? {
              status: {
                in: ['won', 'lost', 'charge_refunded', 'warning_closed'],
              },
            }
          : {
              status: {
                in: [
                  'needs_response',
                  'warning_needs_response',
                  'under_review',
                  'warning_under_review',
                ],
              },
            };

    const disputes = await prisma.stripeDisputeRecord.findMany({
      where,
      orderBy: [{ evidenceDueBy: 'asc' }, { createdAt: 'desc' }],
      take: 60,
    });

    const all = await prisma.stripeDisputeRecord.findMany({
      select: { status: true, amountCents: true },
      take: 500,
    });
    const openRows = all.filter((d) => OPEN_STATUSES.has(d.status));
    const openCents = openRows.reduce((s, d) => s + d.amountCents, 0);

    return NextResponse.json({
      kpis: {
        openCount: openRows.length,
        openLabel: money(openCents),
        totalSynced: all.length,
        needsResponse: all.filter((d) =>
          ['needs_response', 'warning_needs_response'].includes(d.status)
        ).length,
      },
      filter,
      disputes: disputes.map(mapDispute),
    });
  } catch (e) {
    return err(e);
  }
}
