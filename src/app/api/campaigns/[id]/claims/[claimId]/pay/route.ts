import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { releaseAppointmentClaimPayout } from '@/lib/claim-payout';

type Ctx = { params: Promise<{ id: string; claimId: string }> };

/**
 * POST /api/campaigns/[id]/claims/[claimId]/pay
 * Retry escrow release / Connect transfer after AI pass
 * (e.g. SDR finished Connect onboarding). Primary path auto-pays on audit pass.
 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id: campaignId, claimId } = await ctx.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { brand: { select: { ownerId: true, id: true, name: true, slug: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, campaign.brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const claim = await prisma.appointmentClaim.findFirst({
      where: { id: claimId, campaignId },
      select: { id: true, status: true, repUserId: true },
    });
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });

    const result = await releaseAppointmentClaimPayout(claim.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    const { notifyAsync } = await import('@/lib/notifications');
    notifyAsync({
      event: result.payoutStatus === 'PAID' ? 'payout.paid' : 'appointment.verified',
      recipient: { userId: claim.repUserId },
      brand: {
        id: campaign.brand.id,
        name: campaign.brand.name,
        slug: campaign.brand.slug,
      },
      payload: {
        campaignTitle: campaign.title,
        campaignId,
        ctaUrl: '/billing',
        forAudience: 'sdr',
      },
      idempotencyKey: `claim.pay:sdr:${claim.id}:${result.payoutStatus}`,
    });

    return NextResponse.json({
      ok: true,
      claimStatus: result.claimStatus,
      payoutStatus: result.payoutStatus,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[claims/pay]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
