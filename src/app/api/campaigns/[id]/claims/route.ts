import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import { auditAppointmentClaim } from '@/lib/appointment-audit';

/**
 * POST /api/campaigns/[id]/claims
 * SDR claims a booked meeting → AI audit → brand must confirm payout.
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

    const callLogId = body.callLogId ? String(body.callLogId) : null;
    if (callLogId) {
      const ownedLog = await prisma.callLog.findFirst({
        where: { id: callLogId, userId: profile.id, campaignId },
        select: { id: true },
      });
      if (!ownedLog) {
        return NextResponse.json(
          { error: 'callLogId must belong to you on this campaign' },
          { status: 403 }
        );
      }
    }

    const claim = await prisma.appointmentClaim.create({
      data: {
        campaignId,
        applicationId: app.id,
        repUserId: profile.id,
        callLogId,
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
      if (callLogId) {
        await prisma.callLog
          .updateMany({
            where: {
              id: callLogId,
              userId: profile.id,
              campaignId,
            },
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

    if (callLogId) {
      await prisma.callLog
        .updateMany({
          where: {
            id: callLogId,
            userId: profile.id,
            campaignId,
          },
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

    // AI pass attributes the claim — brand must confirm before escrow/payout.
    const { notifyAsync } = await import('@/lib/notifications');
    const brandCtx = {
      id: campaign.brand.id,
      name: campaign.brand.name,
      slug: campaign.brand.slug,
    };
    if (campaign.brand.ownerId) {
      notifyAsync({
        event: 'appointment.booked',
        recipient: { userId: campaign.brand.ownerId },
        brand: brandCtx,
        payload: {
          campaignTitle: campaign.title,
          campaignId,
          prospectName: prospectName || undefined,
          ctaUrl: `/brands/${campaign.brand.slug}/sdrs/payouts`,
          forAudience: 'brand',
        },
        idempotencyKey: `appointment.claim:brand:${claim.id}`,
      });
    }
    notifyAsync({
      event: 'appointment.booked',
      recipient: { userId: profile.id },
      brand: brandCtx,
      payload: {
        campaignTitle: campaign.title,
        campaignId,
        ctaUrl: '/gigs',
        forAudience: 'sdr',
      },
      idempotencyKey: `appointment.claim:sdr:${claim.id}`,
    });

    return NextResponse.json({
      claim,
      audit,
      code: 'PAYOUT_PENDING_BRAND_CONFIRM',
      notice:
        'Appointment claim passed AI audit. Brand must confirm before escrow release and payout.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[claims]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
