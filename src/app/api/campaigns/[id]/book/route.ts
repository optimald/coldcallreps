import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import {
  createGoogleCalendarEvent,
  GOOGLE_CALENDAR_PROVIDER,
  googleCalendarConfigured,
  serializeCalendarConnection,
} from '@/lib/google-calendar';

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Book a meeting onto the campaign brand owner's Google Calendar.
 * Allowed: brand manager, or ACTIVE/ACCEPTED applicant (SDR handoff).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: campaignId } = await params;
    const body = await req.json();

    const title = String(body.title || '').trim().slice(0, 200);
    const description = body.description != null ? String(body.description).slice(0, 8000) : '';
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const applicationId = body.applicationId ? String(body.applicationId) : null;
    const timeZone = body.timeZone ? String(body.timeZone).slice(0, 80) : undefined;
    const createMeetLink = body.createMeetLink !== false;

    const attendeeEmails: string[] = Array.isArray(body.attendeeEmails)
      ? body.attendeeEmails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean)
      : typeof body.attendeeEmail === 'string'
        ? [body.attendeeEmail.trim().toLowerCase()]
        : [];

    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }
    if (!startsAtRaw || !endsAtRaw) {
      return NextResponse.json({ error: 'startsAt and endsAt required (ISO)' }, { status: 400 });
    }
    const startsAt = new Date(startsAtRaw);
    const endsAt = new Date(endsAtRaw);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: 'Invalid startsAt/endsAt' }, { status: 400 });
    }
    if (endsAt <= startsAt) {
      return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
    }
    if (attendeeEmails.length === 0 || !attendeeEmails.every(isEmail)) {
      return NextResponse.json({ error: 'Valid attendeeEmails required' }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        brand: { select: { id: true, name: true, ownerId: true } },
      },
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (!campaign.brand.ownerId) {
      return NextResponse.json(
        { error: 'Brand has no owner — cannot book on calendar' },
        { status: 400 }
      );
    }

    const manage = canManageBrand(profile, campaign.brand.ownerId);
    let application = null as Awaited<
      ReturnType<typeof prisma.campaignApplication.findFirst>
    >;

    if (applicationId) {
      application = await prisma.campaignApplication.findFirst({
        where: { id: applicationId, campaignId },
      });
      if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
    } else if (!manage) {
      application = await prisma.campaignApplication.findFirst({
        where: { campaignId, userId: profile.id },
      });
    }

    const appOk =
      application &&
      (application.status === 'ACTIVE' || application.status === 'ACCEPTED') &&
      (manage || application.userId === profile.id);

    if (!manage && !appOk) {
      return NextResponse.json(
        {
          error:
            'Only brand managers or ACTIVE applicants can book meetings for this campaign',
        },
        { status: 403 }
      );
    }

    if (!googleCalendarConfigured()) {
      return NextResponse.json(
        {
          error: 'Google Calendar OAuth is not configured on this server',
          code: 'NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const connection = await prisma.crmConnection.findFirst({
      where: {
        userId: campaign.brand.ownerId,
        provider: GOOGLE_CALENDAR_PROVIDER,
        status: 'connected',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection?.accessTokenEnc) {
      return NextResponse.json(
        {
          error:
            'Brand has not connected Google Calendar yet. Ask the brand to connect under Integrations.',
          code: 'CALENDAR_NOT_CONNECTED',
          connectPath: '/integrations',
        },
        { status: 409 }
      );
    }

    const event = await createGoogleCalendarEvent(connection, {
      title,
      description:
        description ||
        `Booked via Cold Call Reps · Campaign: ${campaign.title} · Brand: ${campaign.brand.name}`,
      startsAt,
      endsAt,
      attendeeEmails,
      timeZone,
      createMeetLink,
    });

    const booking = await prisma.calendarBooking.create({
      data: {
        campaignId,
        applicationId: application?.id || applicationId,
        brandId: campaign.brand.id,
        createdByUserId: profile.id,
        provider: GOOGLE_CALENDAR_PROVIDER,
        externalEventId: event.id,
        htmlLink: event.htmlLink,
        meetLink: event.meetLink,
        title,
        startsAt,
        endsAt,
        attendeeEmails: JSON.stringify(attendeeEmails),
      },
    });

    return NextResponse.json({
      booking: {
        id: booking.id,
        title: booking.title,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        htmlLink: booking.htmlLink,
        meetLink: booking.meetLink,
        attendeeEmails,
        provider: booking.provider,
      },
      notice: event.meetLink
        ? 'Meeting booked — Google Meet link included.'
        : 'Meeting booked on the brand calendar.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[campaigns/book]', error);
    return NextResponse.json({ error: error.message || 'Booking failed' }, { status: 500 });
  }
}

/** List bookings for a campaign (managers + participants). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id: campaignId } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { brand: { select: { ownerId: true } } },
    });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const manage = canManageBrand(profile, campaign.brand.ownerId);
    const myApp = await prisma.campaignApplication.findFirst({
      where: { campaignId, userId: profile.id },
      select: { id: true },
    });
    if (!manage && !myApp) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bookings = await prisma.calendarBooking.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const ownerConn = campaign.brand.ownerId
      ? await prisma.crmConnection.findFirst({
          where: {
            userId: campaign.brand.ownerId,
            provider: GOOGLE_CALENDAR_PROVIDER,
            status: 'connected',
          },
          orderBy: { updatedAt: 'desc' },
        })
      : null;

    return NextResponse.json({
      calendarConnected: Boolean(ownerConn?.accessTokenEnc),
      connection: ownerConn ? serializeCalendarConnection(ownerConn) : null,
      bookings: bookings.map((b) => ({
        id: b.id,
        title: b.title,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        htmlLink: b.htmlLink,
        meetLink: b.meetLink,
        attendeeEmails: JSON.parse(b.attendeeEmails || '[]'),
        applicationId: b.applicationId,
        createdAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
