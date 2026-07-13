import { NextResponse } from 'next/server';
import { completeHubspotOAuth } from '@/lib/crm/hubspot';

/** HubSpot OAuth callback — exchange code, store encrypted tokens. */
export async function GET(req: Request) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(
    /\/$/,
    ''
  );

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${appUrl}/integrations?error=${encodeURIComponent(error)}`
      );
    }
    if (!code || !state) {
      return NextResponse.redirect(
        `${appUrl}/integrations?error=${encodeURIComponent('Missing OAuth code')}`
      );
    }

    await completeHubspotOAuth(code, state);
    return NextResponse.redirect(
      `${appUrl}/integrations?connected=${encodeURIComponent('hubspot')}`
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'HubSpot connect failed';
    return NextResponse.redirect(
      `${appUrl}/integrations?error=${encodeURIComponent(message)}`
    );
  }
}
