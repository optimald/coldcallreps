import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  parseMeetingAtFromCalendlyPayload,
  parseMeetingAtFromParams,
} from '@/lib/booking-attribution';
import { auditAppointmentClaim } from '@/lib/appointment-audit';
import { releaseEscrowOutcome } from '@/lib/escrow';
import { calcPayoutSplit } from '@/lib/campaigns';
import { getStripe } from '@/lib/stripe';
import { dispatchPipelineTask, auditCallTask } from '@/trigger/tasks';

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/bookings/[token]
 * Poll claim status (wrap-up waits for booking success). Auth required.
 */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { token } = await ctx.params;
    const claim = await prisma.appointmentClaim.findFirst({
      where: { attributionToken: token, repUserId: profile.id },
      select: {
        id: true,
        status: true,
        meetingAt: true,
        bookedVia: true,
        auditScore: true,
        failureReason: true,
        verifiedAt: true,
      },
    });
    if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ claim });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/[token]
 * Complete attribution from Calendly/Cal.com redirect or iframe postMessage.
 * Auth optional — prospect redirect uses the opaque token as the credential.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const claim = await prisma.appointmentClaim.findFirst({
      where: { attributionToken: token },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            icpText: true,
            goalType: true,
            payoutCents: true,
            platformFeeBps: true,
            brandId: true,
            brand: { select: { ownerId: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (claim.meetingAt && (claim.status === 'PASSED' || claim.status === 'PAID')) {
      return NextResponse.json({
        claim: {
          id: claim.id,
          status: claim.status,
          meetingAt: claim.meetingAt,
        },
        alreadyComplete: true,
      });
    }

    let meetingAt: Date | null = null;
    if (body.meetingAt) {
      const d = new Date(String(body.meetingAt));
      if (!Number.isNaN(d.getTime())) meetingAt = d;
    }
    if (!meetingAt && body.payload) {
      meetingAt = parseMeetingAtFromCalendlyPayload(body.payload);
    }
    if (!meetingAt && body.params && typeof body.params === 'object') {
      meetingAt = parseMeetingAtFromParams(body.params as Record<string, string | undefined>);
    }
    if (!meetingAt) meetingAt = new Date();

    const bookedVia = body.bookedVia ? String(body.bookedVia).slice(0, 40) : 'redirect';

    const audit = await auditAppointmentClaim({
      campaignTitle: claim.campaign.title,
      icpText: claim.campaign.icpText,
      goalType: claim.campaign.goalType,
      notes: claim.notes,
      transcriptSnippet: claim.transcriptSnippet,
      prospectName: claim.prospectName,
    });

    const updated = await prisma.appointmentClaim.update({
      where: { id: claim.id },
      data: {
        meetingAt,
        bookedVia,
        calendarEventId: body.calendarEventId
          ? String(body.calendarEventId).slice(0, 200)
          : claim.calendarEventId,
        status: audit.passed ? 'PASSED' : 'FAILED',
        auditJSON: JSON.stringify(audit),
        auditScore: audit.score,
        failureReason: audit.passed ? null : audit.reasons.join('; '),
        verifiedAt: audit.passed ? new Date() : null,
      },
    });

    if (claim.callLogId) {
      await prisma.callLog
        .update({
          where: { id: claim.callLogId },
          data: {
            status: 'APPOINTMENT_SET',
            outcome: 'appointment_set',
            isAudited: true,
            needsManualReview: !audit.passed,
            aiAuditResult: JSON.stringify(audit),
          },
        })
        .catch(() => null);

      void dispatchPipelineTask('audit-call-task', () =>
        auditCallTask({ callLogId: claim.callLogId! })
      );
    }

    if (claim.prospectId) {
      await prisma.prospect
        .update({ where: { id: claim.prospectId }, data: { status: 'done' } })
        .catch(() => null);
    }

    if (!audit.passed) {
      return NextResponse.json({
        claim: updated,
        audit,
        meetingAt: meetingAt.toISOString(),
        code: 'AUDIT_FAILED',
      });
    }

    const split = calcPayoutSplit(claim.campaign.payoutCents, claim.campaign.platformFeeBps);
    try {
      await releaseEscrowOutcome({
        brandId: claim.campaign.brandId,
        campaignId: claim.campaignId,
        amountCents: claim.campaign.payoutCents,
        claimId: updated.id,
      });
    } catch (escrowErr) {
      console.warn('[bookings/complete] escrow', escrowErr);
    }

    const brandOwnerId = claim.campaign.brand.ownerId;
    let payout = await prisma.campaignPayout.findUnique({
      where: { applicationId: claim.applicationId },
    });
    if (!payout && brandOwnerId) {
      payout = await prisma.campaignPayout.create({
        data: {
          campaignId: claim.campaignId,
          applicationId: claim.applicationId,
          brandUserId: brandOwnerId,
          repUserId: claim.repUserId,
          grossCents: split.grossCents,
          platformFeeCents: split.platformFeeCents,
          netCents: split.netCents,
          platformFeeBps: split.platformFeeBps,
          status: 'PENDING',
        },
      });
    }

    const rep = await prisma.userProfile.findUnique({
      where: { id: claim.repUserId },
      select: {
        stripeConnectAccountId: true,
        stripeConnectPayoutsEnabled: true,
      },
    });

    if (payout && rep?.stripeConnectAccountId && rep.stripeConnectPayoutsEnabled) {
      try {
        const stripe = getStripe();
        const transfer = await stripe.transfers.create({
          amount: split.netCents,
          currency: 'usd',
          destination: rep.stripeConnectAccountId,
          transfer_group: `claim_${updated.id}`,
          metadata: {
            campaignId: claim.campaignId,
            claimId: updated.id,
            applicationId: claim.applicationId,
          },
        });
        await prisma.campaignPayout.update({
          where: { id: payout.id },
          data: {
            status: 'PAID',
            stripeTransferId: transfer.id,
            paidAt: new Date(),
          },
        });
        await prisma.appointmentClaim.update({
          where: { id: updated.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
      } catch (transferErr) {
        console.warn('[bookings/complete] transfer', transferErr);
      }
    }

    const { notifyAsync } = await import('@/lib/notifications');
    const brand = claim.campaign.brand;
    const brandCtx = {
      id: claim.campaign.brandId,
      name: brand.name,
      slug: brand.slug,
    };
    const meetingLabel = meetingAt.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    if (brand.ownerId) {
      notifyAsync({
        event: 'appointment.booked',
        recipient: { userId: brand.ownerId },
        brand: brandCtx,
          payload: {
            campaignTitle: claim.campaign.title,
            campaignId: claim.campaignId,
            prospectName: claim.prospectName || undefined,
            meetingAtLabel: meetingLabel,
            ctaUrl: `/brands/${brand.slug}/calls`,
            forAudience: 'brand',
          },
          idempotencyKey: `appointment.booked:brand:${updated.id}`,
        });
      }
      notifyAsync({
        event: 'appointment.booked',
        recipient: { userId: claim.repUserId },
        brand: brandCtx,
        payload: {
          campaignTitle: claim.campaign.title,
          campaignId: claim.campaignId,
          prospectName: claim.prospectName || undefined,
          meetingAtLabel: meetingLabel,
          ctaUrl: '/cold_calls',
          forAudience: 'sdr',
        },
        idempotencyKey: `appointment.booked:sdr:${updated.id}`,
      });

    return NextResponse.json({
      claim: updated,
      audit,
      meetingAt: meetingAt.toISOString(),
    });
  } catch (e: unknown) {
    console.error('[bookings/complete]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not complete booking' },
      { status: 500 }
    );
  }
}
