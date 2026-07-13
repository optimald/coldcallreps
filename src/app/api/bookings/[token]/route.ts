import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  parseMeetingAtFromCalendlyPayload,
  parseMeetingAtFromParams,
} from '@/lib/booking-attribution';
import { auditAppointmentClaim } from '@/lib/appointment-audit';
import { dispatchPipelineTask, runAuditCallInline, AUDIT_CALL_TASK_ID } from '@/trigger/tasks';

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/bookings/[token]
 * Complete attribution from Calendly/Cal.com redirect or iframe postMessage.
 * Opaque token alone is not enough for payout — require provider evidence
 * (redirect params / calendly payload) or an authenticated brand manager.
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
    let evidence: 'payload' | 'params' | 'manual' | null = null;

    if (body.payload) {
      meetingAt = parseMeetingAtFromCalendlyPayload(body.payload);
      if (meetingAt) evidence = 'payload';
    }
    if (!meetingAt && body.params && typeof body.params === 'object') {
      meetingAt = parseMeetingAtFromParams(body.params as Record<string, string | undefined>);
      if (meetingAt) evidence = 'params';
    }

    // Bare client meetingAt only for authenticated brand managers (manual confirm).
    if (!meetingAt && body.meetingAt) {
      try {
        const profile = await requireUser();
        const ownerId = claim.campaign.brand.ownerId;
        const { canManageBrand, isSuperadmin } = await import('@/lib/roles');
        if (isSuperadmin(profile) || (ownerId && canManageBrand(profile, ownerId))) {
          const d = new Date(String(body.meetingAt));
          if (!Number.isNaN(d.getTime())) {
            meetingAt = d;
            evidence = 'manual';
          }
        }
      } catch {
        /* unauthenticated — ignore bare meetingAt */
      }
    }

    if (!meetingAt || !evidence) {
      return NextResponse.json(
        {
          error:
            'Booking not confirmed — complete Calendly/Cal.com scheduling, or ask the brand to confirm.',
          code: 'BOOKING_EVIDENCE_REQUIRED',
        },
        { status: 400 }
      );
    }

    const now = Date.now();
    const delta = meetingAt.getTime() - now;
    if (delta < -7 * 24 * 60 * 60 * 1000 || delta > 365 * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Meeting time is out of acceptable range', code: 'INVALID_MEETING_AT' },
        { status: 400 }
      );
    }

    const bookedVia = body.bookedVia
      ? String(body.bookedVia).slice(0, 40)
      : evidence === 'manual'
        ? 'manual'
        : 'redirect';

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
        .updateMany({
          where: { id: claim.callLogId, userId: claim.repUserId },
          data: {
            status: 'APPOINTMENT_SET',
            outcome: 'appointment_set',
            isAudited: true,
            needsManualReview: !audit.passed,
            aiAuditResult: JSON.stringify(audit),
          },
        })
        .catch(() => null);

      void dispatchPipelineTask(
        AUDIT_CALL_TASK_ID,
        () => runAuditCallInline({ callLogId: claim.callLogId! }),
        { payload: { callLogId: claim.callLogId! }, wait: false }
      ).catch((e) => console.error('[bookings] audit dispatch failed', e));
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

    // Forgeable redirect/postMessage evidence attributes the meeting but does not
    // move money — brand must confirm payout (or complete via manual evidence).
    const autoPay = evidence === 'manual';
    if (!autoPay) {
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
            ctaUrl: `/brands/${brand.slug}/sdrs/payouts`,
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
        code: 'PAYOUT_PENDING_BRAND_CONFIRM',
        notice:
          'Meeting attributed. Brand must confirm before escrow release and payout.',
      });
    }

    const { releaseAppointmentClaimPayout } = await import('@/lib/claim-payout');
    const paid = await releaseAppointmentClaimPayout(updated.id);
    if (!paid.ok) {
      console.warn('[bookings/complete] payout', paid.error);
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

    const fresh = await prisma.appointmentClaim.findUnique({ where: { id: updated.id } });
    return NextResponse.json({
      claim: fresh || updated,
      audit,
      meetingAt: meetingAt.toISOString(),
      payoutStatus: paid.ok ? paid.payoutStatus : 'PENDING',
    });
  } catch (e: unknown) {
    console.error('[bookings/complete]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
