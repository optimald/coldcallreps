import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { auditAppointmentClaim } from '@/lib/appointment-audit';
import { releaseEscrowOutcome } from '@/lib/escrow';
import { calcPayoutSplit } from '@/lib/campaigns';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/campaigns/[id]/claims
 * SDR claims a booked meeting → AI audit → escrow release + Connect transfer when possible.
 * Body: { notes, transcriptSnippet?, prospectName?, meetingAt?, callLogId?, calendarEventId? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: campaignId } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { brand: { select: { id: true, ownerId: true, name: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const app = await prisma.campaignApplication.findUnique({
      where: { campaignId_userId: { campaignId, userId: profile.id } },
    });
    if (!app || !['ACCEPTED', 'ACTIVE', 'COMPLETED'].includes(app.status)) {
      return NextResponse.json(
        { error: 'You must be an accepted SDR on this campaign to claim appointments' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const notes = body.notes ? String(body.notes).slice(0, 8000) : null;
    const transcriptSnippet = body.transcriptSnippet
      ? String(body.transcriptSnippet).slice(0, 12000)
      : null;
    const prospectName = body.prospectName ? String(body.prospectName).slice(0, 200) : null;

    const audit = await auditAppointmentClaim({
      campaignTitle: campaign.title,
      icpText: campaign.icpText,
      goalType: campaign.goalType,
      notes,
      transcriptSnippet,
      prospectName,
    });

    const claim = await prisma.appointmentClaim.create({
      data: {
        campaignId,
        applicationId: app.id,
        repUserId: profile.id,
        callLogId: body.callLogId ? String(body.callLogId) : null,
        calendarEventId: body.calendarEventId ? String(body.calendarEventId) : null,
        prospectName,
        meetingAt: body.meetingAt ? new Date(body.meetingAt) : null,
        notes,
        transcriptSnippet,
        status: audit.passed ? 'PASSED' : 'FAILED',
        auditJSON: JSON.stringify(audit),
        auditScore: audit.score,
        failureReason: audit.passed ? null : audit.reasons.join('; '),
        verifiedAt: audit.passed ? new Date() : null,
      },
    });

    if (!audit.passed) {
      return NextResponse.json(
        {
          claim,
          audit,
          error: 'Appointment claim failed AI audit',
          code: 'AUDIT_FAILED',
        },
        { status: 422 }
      );
    }

    // Escrow release + payout record
    const split = calcPayoutSplit(campaign.payoutCents, campaign.platformFeeBps);
    try {
      await releaseEscrowOutcome({
        brandId: campaign.brandId,
        campaignId,
        amountCents: campaign.payoutCents,
        claimId: claim.id,
      });
    } catch (e: unknown) {
      return NextResponse.json(
        {
          claim,
          audit,
          error: e instanceof Error ? e.message : 'Escrow release failed',
          code: 'ESCROW_RELEASE_FAILED',
        },
        { status: 400 }
      );
    }

    const brandOwnerId = campaign.brand.ownerId || profile.id;
    let payout = await prisma.campaignPayout.findUnique({
      where: { applicationId: app.id },
    });

    if (!payout) {
      payout = await prisma.campaignPayout.create({
        data: {
          campaignId,
          applicationId: app.id,
          brandUserId: brandOwnerId,
          repUserId: profile.id,
          grossCents: split.grossCents,
          platformFeeCents: split.platformFeeCents,
          netCents: split.netCents,
          platformFeeBps: split.platformFeeBps,
          status: 'PENDING',
        },
      });
    }

    // Attempt Connect transfer if SDR is ready
    const rep = await prisma.userProfile.findUnique({
      where: { id: profile.id },
      select: {
        stripeConnectAccountId: true,
        stripeConnectPayoutsEnabled: true,
      },
    });

    if (rep?.stripeConnectAccountId && rep.stripeConnectPayoutsEnabled) {
      try {
        const stripe = getStripe();
        const transfer = await stripe.transfers.create({
          amount: split.netCents,
          currency: 'usd',
          destination: rep.stripeConnectAccountId,
          transfer_group: `claim_${claim.id}`,
          metadata: {
            campaignId,
            claimId: claim.id,
            applicationId: app.id,
          },
        });
        payout = await prisma.campaignPayout.update({
          where: { id: payout.id },
          data: {
            status: 'PAID',
            stripeTransferId: transfer.id,
            paidAt: new Date(),
          },
        });
        await prisma.appointmentClaim.update({
          where: { id: claim.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
        await prisma.campaignApplication.update({
          where: { id: app.id },
          data: { status: 'COMPLETED' },
        });
      } catch (e) {
        console.warn('[claims] Connect transfer failed — payout stays PENDING', e);
      }
    }

    return NextResponse.json({
      claim: { ...claim, status: payout.status === 'PAID' ? 'PAID' : claim.status },
      audit,
      payout,
      notice:
        payout.status === 'PAID'
          ? 'Appointment verified. Escrow released and paid to your Connect account.'
          : 'Appointment verified and escrow released. Connect Stripe under Earnings to receive the transfer.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[claims]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** GET — list claims for campaign (brand) or own claims (SDR). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { brand: { select: { ownerId: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const manage = canManageBrand(profile, campaign.brand.ownerId);

    const claims = await prisma.appointmentClaim.findMany({
      where: {
        campaignId: id,
        ...(manage ? {} : { repUserId: profile.id }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ claims, canManage: manage });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
