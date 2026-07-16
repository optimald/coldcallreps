import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import {
  googleCalendarConfigured,
  upsertGoogleCalendarConnection,
  verifyOAuthState,
} from '@/lib/google-calendar';

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');
}

/**
 * Google OAuth callback — exchanges code, stores encrypted tokens on CrmConnection.
 * Redirect URI (default): {NEXT_PUBLIC_APP_URL}/api/integrations/google_calendar/callback
 */
export async function GET(req: Request) {
  const base = appUrl();
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const error = searchParams.get('error');
    if (error) {
      return NextResponse.redirect(
        `${base}/integrations?error=${encodeURIComponent(error)}`
      );
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      return NextResponse.redirect(
        `${base}/integrations?error=${encodeURIComponent('Missing OAuth code')}`
      );
    }

    const stateUserId = verifyOAuthState(state);
    if (!stateUserId || stateUserId !== profile.id) {
      return NextResponse.redirect(
        `${base}/integrations?error=${encodeURIComponent('Invalid OAuth state')}`
      );
    }

    if (!googleCalendarConfigured()) {
      return NextResponse.redirect(
        `${base}/integrations?error=${encodeURIComponent('Google Calendar not configured')}`
      );
    }

    await upsertGoogleCalendarConnection(profile.id, code);
    const { trackEvent } = await import('@/lib/posthog/analytics');
    trackEvent(profile.id, 'integration_connected', {
      role: 'BRAND',
      provider: 'google_calendar',
    });
    return NextResponse.redirect(`${base}/integrations?connected=google_calendar`);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.redirect(`${base}/sign-in?redirect_url=/integrations`);
    }
    console.error('[google_calendar/callback]', error);
    return NextResponse.redirect(
      `${base}/integrations?error=${encodeURIComponent(error.message || 'OAuth failed')}`
    );
  }
}
