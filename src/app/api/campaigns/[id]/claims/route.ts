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
      include: { brand: { select: { id: true, ownerId: true, name: true, slug: true } } },
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
      if (body.callLogId) {
        await prisma.callLog
          .update({
            where: { id: String(body.callLogId) },
            data: {
              isAudited: true,
              needsManualReview: true,
              aiAuditResult: JSON.stringify(audit),
              transcript: transcriptSnippet || undefined,
            },
          })
          .catch(() => null);
      }
      const { notifyAsync } = await import('@/lib/notifications');
      const brand = campaign.brand;
      if (brand.ownerId) {
        notifyAsync({
          event: 'appointment.failed_audit',
          recipient: { userId: brand.ownerId },
          brand: { id: brand.id, name: brand.name, slug: brand.slug },
          payload: {
            campaignTitle: campaign.title,
            campaignId,
            prospectName: prospectName || undefined,
            reason: audit.reasons?.join('; ') || 'Audit failed',
            ctaUrl: `/brands/${brand.slug}/calls`,
            forAudience: 'brand',
          },
          idempotencyKey: `appointment.failed_audit:${claim.id}`,
        });
      }
      notifyAsync({
        event: 'appointment.failed_audit',
        recipient: { userId: profile.id },
        brand: { id: brand.id, name: brand.name, slug: brand.slug },
        payload: {
          campaignTitle: campaign.title,
          campaignId,
          reason: audit.reasons?.join('; ') || 'Audit failed',
          ctaUrl: '/gigs',
          forAudience: 'sdr',
        },
        idempotencyKey: `appointment.failed_audit:sdr:${claim.id}`,
      });
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

    if (body.callLogId) {
      await prisma.callLog
        .update({
          where: { id: String(body.callLogId) },
          data: {
            status: 'APPOINTMENT_SET',
            outcome: 'appointment_set',
            isAudited: true,
            needsManualReview: false,
            aiAuditResult: JSON.stringify(audit),
            transcript: transcriptSnippet || undefined,
          },
        })
        .catch(() => null);
    }

    // Escrow release + payout record (respect spend caps — live calls already finished)
    const split = calcPayoutSplit(campaign.payoutCents, campaign.platformFeeBps);
    const { isCampaignDialEligible } = await import('@/lib/campaigns');
    const { loadOneCampaignSpend } = await import('@/lib/campaign-spend');
    const spend = await loadOneCampaignSpend(campaignId);
    const budgetGate = isCampaignDialEligible({
      status: 'OPEN', // award gate ignores pause for already-verified claims? Plan: gate new awards when daily remaining hits 0
      startsAt: campaign.startsAt,
      endsAt: null, // allow awards after end for in-flight results
      budgetCents: campaign.budgetCents,
      budgetMode: campaign.budgetMode,
      dailyBudgetCents: campaign.dailyBudgetCents,
      spentCents: spend.spentCents,
      spentTodayCents: spend.spentTodayCents,
      nextAwardCents: split.grossCents,
    });
    if (!budgetGate.ok) {
      return NextResponse.json(
        {
          claim,
          audit,
          error: budgetGate.reason || 'Budget exhausted',
          code: 'BUDGET_EXCEEDED',
        },
        { status: 400 }
      );
    }

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

    const { notifyAsync } = await import('@/lib/notifications');
    const { formatPayout } = await import('@/lib/campaigns');
    const brandCtx = {
      id: campaign.brand.id,
      name: campaign.brand.name,
      slug: campaign.brand.slug,
    };
    if (campaign.brand.ownerId) {
      notifyAsync({
        event: 'appointment.verified',
        recipient: { userId: campaign.brand.ownerId },
        brand: brandCtx,
        payload: {
          campaignTitle: campaign.title,
          campaignId,
          prospectName: prospectName || undefined,
          amountLabel: formatPayout(split.grossCents),
          ctaUrl: `/brands/${campaign.brand.slug}/sdrs/payouts`,
          forAudience: 'brand',
        },
        idempotencyKey: `appointment.verified:brand:${claim.id}`,
      });
    }
    notifyAsync({
      event: payout.status === 'PAID' ? 'payout.paid' : 'appointment.verified',
      recipient: { userId: profile.id },
      brand: brandCtx,
      payload: {
        campaignTitle: campaign.title,
        campaignId,
        amountLabel: formatPayout(
          payout.status === 'PAID' ? split.netCents : split.grossCents
        ),
        ctaUrl: '/billing',
        forAudience: 'sdr',
      },
      idempotencyKey: `appointment.verified:sdr:${claim.id}:${payout.status}`,
    });

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
