import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { effectiveRole } from '@/lib/roles';
import {
  buildGoogleAuthUrl,
  GOOGLE_CALENDAR_PROVIDER,
  googleCalendarConfigured,
} from '@/lib/google-calendar';
import { buildHubspotAuthUrl, hubspotConfigured, HUBSPOT_PROVIDER } from '@/lib/crm/hubspot';

/**
 * Start Google Calendar OAuth for brands, or return coming-soon for CRM / Microsoft.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(
    /\/$/,
    ''
  );

  try {
    const profile = await requireUser();
    const { provider: raw } = await params;
    const provider = String(raw || '').toLowerCase().slice(0, 40);

    if (provider === GOOGLE_CALENDAR_PROVIDER || provider === 'google') {
      const role = effectiveRole(profile);
      if (role !== 'BRAND' && role !== 'SUPERADMIN') {
        return NextResponse.redirect(
          `${appUrl}/integrations?error=${encodeURIComponent('Google Calendar is for Brand accounts')}`
        );
      }
      if (!googleCalendarConfigured()) {
        return NextResponse.redirect(
          `${appUrl}/integrations?error=${encodeURIComponent('Google Calendar OAuth is not configured on this server yet')}`
        );
      }
      return NextResponse.redirect(buildGoogleAuthUrl(profile.id));
    }

    if (provider === 'microsoft_calendar' || provider === 'microsoft') {
      return NextResponse.redirect(
        `${appUrl}/integrations?error=${encodeURIComponent('Microsoft Calendar coming soon')}`
      );
    }

    if (provider === HUBSPOT_PROVIDER) {
      if (!hubspotConfigured()) {
        return NextResponse.redirect(
          `${appUrl}/integrations?error=${encodeURIComponent(
            'HubSpot OAuth is not configured on this server yet'
          )}`
        );
      }
      return NextResponse.redirect(buildHubspotAuthUrl(profile.id));
    }

    // Remaining CRM adapters — sync only; ColdCallReps leads stay the source of truth
    const crmSoon = ['close', 'close_com', 'salesforce', 'pipedrive'];
    if (crmSoon.includes(provider)) {
      return NextResponse.redirect(
        `${appUrl}/integrations?error=${encodeURIComponent('CRM sync coming soon')}`
      );
    }

    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.redirect(`${appUrl}/sign-in?redirect_url=/integrations`);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
