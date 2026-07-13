import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildAttributionBookingUrl,
  campaignAllowsMeetings,
} from '@/lib/booking-attribution';

/**
 * POST /api/bookings/start
 * Create a pending AppointmentClaim + attribution token for Cal iframe / redirect.
 * Body: { campaignId, callLogId?, prospectId?, notes? }
 */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaignId ? String(body.campaignId) : '';
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        goalType: true,
        bookingLink: true,
        meetingDurationMinutes: true,
        title: true,
      },
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (!campaignAllowsMeetings(campaign.goalType)) {
      return NextResponse.json(
        { error: 'This campaign does not pay for booked meetings' },
        { status: 400 }
      );
    }
    if (!campaign.bookingLink?.trim()) {
      return NextResponse.json(
        { error: 'Campaign is missing a booking link. Ask the brand to add Calendly/Cal.com.' },
        { status: 400 }
      );
    }

    const app = await prisma.campaignApplication.findUnique({
      where: { campaignId_userId: { campaignId, userId: profile.id } },
    });
    if (!app || !['ACCEPTED', 'ACTIVE', 'COMPLETED'].includes(app.status)) {
      return NextResponse.json(
        { error: 'You must be an accepted SDR on this campaign' },
        { status: 403 }
      );
    }

    let prospectName: string | null = body.prospectName ? String(body.prospectName).slice(0, 200) : null;
    const prospectId = body.prospectId ? String(body.prospectId) : null;
    if (prospectId && !prospectName) {
      const prospect = await prisma.prospect.findUnique({
        where: { id: prospectId },
        select: { companyName: true, ownerName: true },
      });
      prospectName = prospect?.ownerName || prospect?.companyName || null;
    }

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

    const token = randomBytes(18).toString('base64url');
    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_ORIGIN || '')
      .replace(/\/$/, '')
      || new URL(req.url).origin;
    const doneUrl = `${origin}/book/${token}/done`;

    const { embedUrl, provider } = buildAttributionBookingUrl({
      bookingLink: campaign.bookingLink,
      doneUrl,
      prospectName,
    });

    const claim = await prisma.appointmentClaim.create({
      data: {
        campaignId,
        applicationId: app.id,
        repUserId: profile.id,
        callLogId,
        prospectId,
        prospectName,
        attributionToken: token,
        meetingDurationMinutes: campaign.meetingDurationMinutes,
        notes: body.notes ? String(body.notes).slice(0, 8000) : null,
        status: 'PENDING_AUDIT',
        bookedVia: null,
      },
      select: {
        id: true,
        attributionToken: true,
        meetingDurationMinutes: true,
        status: true,
      },
    });

    if (callLogId) {
      await prisma.callLog
        .updateMany({
          where: { id: callLogId, userId: profile.id },
          data: {
            status: 'APPOINTMENT_SET',
            outcome: 'appointment_set',
          },
        })
        .catch(() => null);
    }

    return NextResponse.json({
      claim,
      token,
      provider,
      embedUrl,
      doneUrl,
      bookPageUrl: `${origin}/book/${token}`,
      meetingDurationMinutes: campaign.meetingDurationMinutes,
      campaignTitle: campaign.title,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[bookings/start]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
