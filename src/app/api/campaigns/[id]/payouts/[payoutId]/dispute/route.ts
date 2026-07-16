import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrandId } from '@/lib/roles';
import { writeAudit } from '@/lib/audit';
import { trackEvent } from '@/lib/posthog/analytics';

type Ctx = { params: Promise<{ id: string; payoutId: string }> };

/**
 * POST /api/campaigns/[id]/payouts/[payoutId]/dispute
 * Brand disputes an AI-approved payout (ops reviews; no auto clawback).
 * Body: { reason }
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id: campaignId, payoutId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || '').trim();
    if (reason.length < 8) {
      return NextResponse.json(
        { error: 'reason required (min 8 characters)' },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { brand: { select: { ownerId: true, id: true, name: true, slug: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payout = await prisma.campaignPayout.findFirst({
      where: { id: payoutId, campaignId },
    });
    if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    if (payout.status === 'DISPUTED') {
      return NextResponse.json({ error: 'Already disputed', payout }, { status: 409 });
    }
    if (payout.status === 'CANCELED') {
      return NextResponse.json({ error: 'Cannot dispute a canceled payout' }, { status: 400 });
    }

    const updated = await prisma.campaignPayout.update({
      where: { id: payout.id },
      data: {
        status: 'DISPUTED',
        disputeReason: reason,
        disputedAt: new Date(),
      },
    });

    await writeAudit({
      actorId: profile.id,
      action: 'brand.payout.dispute',
      targetType: 'CampaignPayout',
      targetId: payout.id,
      meta: {
        campaignId,
        reason,
        priorStatus: payout.status,
        stripeTransferId: payout.stripeTransferId,
      },
    });

    const { notifyAsync } = await import('@/lib/notifications');
    notifyAsync({
      event: 'appointment.failed_audit',
      recipient: { userId: payout.repUserId },
      brand: {
        id: campaign.brand.id,
        name: campaign.brand.name,
        slug: campaign.brand.slug,
      },
      payload: {
        campaignTitle: campaign.title,
        campaignId,
        reason: `Brand disputed payout: ${reason}`,
        ctaUrl: '/gigs',
        forAudience: 'sdr',
      },
      idempotencyKey: `payout.dispute:brand:${payout.id}`,
    });

    trackEvent(profile.id, 'payout_disputed', {
      role: 'BRAND',
      campaignId,
      payoutId: payout.id,
      repUserId: payout.repUserId,
    });

    return NextResponse.json({
      ok: true,
      payout: updated,
      notice:
        'Dispute filed. Ops will review — Connect transfers already sent are not auto-reversed.',
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[payouts/dispute]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
