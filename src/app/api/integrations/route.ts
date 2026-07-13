import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  GOOGLE_CALENDAR_PROVIDER,
  googleCalendarConfigured,
  serializeCalendarConnection,
} from '@/lib/google-calendar';
import { hubspotConfigured, HUBSPOT_PROVIDER } from '@/lib/crm/hubspot';
import { effectiveRole } from '@/lib/roles';

function sanitizeConnection(c: {
  id: string;
  userId: string;
  provider: string;
  status: string;
  externalId: string | null;
  accessTokenEnc?: string | null;
  refreshTokenEnc?: string | null;
  tokenExpiresAt?: Date | null;
  scopes?: string | null;
  metaJSON: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  if (c.provider === GOOGLE_CALENDAR_PROVIDER || c.provider === 'microsoft_calendar') {
    return serializeCalendarConnection(c as any);
  }
  return {
    id: c.id,
    provider: c.provider,
    status: c.status,
    externalId: c.externalId,
    metaJSON: c.metaJSON,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function GET() {
  try {
    const profile = await requireUser();
    const connections = await prisma.crmConnection.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    const role = effectiveRole(profile);
    return NextResponse.json({
      connections: connections.map(sanitizeConnection),
      calendar: {
        googleConfigured: googleCalendarConfigured(),
        microsoftAvailable: false,
        canConnectCalendar: role === 'BRAND' || role === 'SUPERADMIN',
      },
      crm: {
        hubspotConfigured: hubspotConfigured(),
        providers: [HUBSPOT_PROVIDER],
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Prefer Google Calendar / HubSpot connect routes for OAuth. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Use /api/integrations/hubspot/connect or /api/integrations/google_calendar/connect to start OAuth. Sync via POST /api/integrations/crm/sync.',
    },
    { status: 501 }
  );
}

/** Disconnect a CRM / calendar link. */
export async function DELETE(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const connection = await prisma.crmConnection.findFirst({
      where: { id, userId: profile.id },
    });
    if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.crmConnection.update({
      where: { id: connection.id },
      data: {
        status: 'disconnected',
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        scopes: null,
        metaJSON: JSON.stringify({ disconnectedAt: new Date().toISOString() }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
