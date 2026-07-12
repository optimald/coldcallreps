import { createHmac, timingSafeEqual } from 'crypto';
import type { CrmConnection } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret, integrationCryptoConfigured } from '@/lib/crypto-secrets';

export const GOOGLE_CALENDAR_PROVIDER = 'google_calendar';

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
].join(' ');

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');
}

export function googleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      integrationCryptoConfigured()
  );
}

export function googleCalendarRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${appBaseUrl()}/api/integrations/google_calendar/callback`
  );
}

function oauthStateSecret(): string {
  return (
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.TRAINER_GATE_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    'dev-oauth-state'
  );
}

/** Signed OAuth state: userId.timestamp.sig */
export function signOAuthState(userId: string): string {
  const ts = Date.now().toString(36);
  const body = `${userId}.${ts}`;
  const sig = createHmac('sha256', oauthStateSecret()).update(body).digest('hex').slice(0, 32);
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string, maxAgeMs = 15 * 60 * 1000): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  if (!userId || !ts || !sig) return null;
  const body = `${userId}.${ts}`;
  const expected = createHmac('sha256', oauthStateSecret()).update(body).digest('hex').slice(0, 32);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const issued = parseInt(ts, 36);
  if (!Number.isFinite(issued) || Date.now() - issued > maxAgeMs) return null;
  return userId;
}

export function buildGoogleAuthUrl(userId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleCalendarRedirectUri(),
    response_type: 'code',
    scope: CALENDAR_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: signOAuthState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

async function exchangeCode(code: string): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleCalendarRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }
  return data;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Token refresh failed');
  }
  return data;
}

export async function upsertGoogleCalendarConnection(
  userId: string,
  code: string
): Promise<CrmConnection> {
  const tokens = await exchangeCode(code);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  let email: string | null = null;
  try {
    const me = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (me.ok) {
      const info = (await me.json()) as { email?: string };
      email = info.email || null;
    }
  } catch {
    /* optional */
  }

  const existing = await prisma.crmConnection.findFirst({
    where: { userId, provider: GOOGLE_CALENDAR_PROVIDER },
    orderBy: { createdAt: 'desc' },
  });

  const data = {
    status: 'connected',
    externalId: email,
    accessTokenEnc: encryptSecret(tokens.access_token),
    refreshTokenEnc: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing?.refreshTokenEnc || null,
    tokenExpiresAt: expiresAt,
    scopes: tokens.scope || CALENDAR_SCOPES,
    metaJSON: JSON.stringify({
      connectedAt: new Date().toISOString(),
      email,
      mode: 'oauth',
    }),
  };

  if (existing) {
    return prisma.crmConnection.update({ where: { id: existing.id }, data });
  }
  return prisma.crmConnection.create({
    data: { userId, provider: GOOGLE_CALENDAR_PROVIDER, ...data },
  });
}

/** Valid access token for a connection, refreshing if needed. */
export async function getValidGoogleAccessToken(
  connection: CrmConnection
): Promise<string> {
  if (!connection.accessTokenEnc) {
    throw new Error('Google Calendar not connected');
  }

  const skewMs = 60_000;
  const stillValid =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() - skewMs > Date.now();

  if (stillValid) {
    return decryptSecret(connection.accessTokenEnc);
  }

  if (!connection.refreshTokenEnc) {
    throw new Error('Google Calendar session expired — reconnect');
  }

  const refreshToken = decryptSecret(connection.refreshTokenEnc);
  const tokens = await refreshAccessToken(refreshToken);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await prisma.crmConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEnc: encryptSecret(tokens.access_token),
      tokenExpiresAt: expiresAt,
      status: 'connected',
      scopes: tokens.scope || connection.scopes,
    },
  });

  return tokens.access_token;
}

export type CreateCalendarEventInput = {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  attendeeEmails: string[];
  timeZone?: string;
  createMeetLink?: boolean;
};

export type CreatedCalendarEvent = {
  id: string;
  htmlLink: string | null;
  meetLink: string | null;
  status: string | null;
};

export async function createGoogleCalendarEvent(
  connection: CrmConnection,
  input: CreateCalendarEventInput
): Promise<CreatedCalendarEvent> {
  const accessToken = await getValidGoogleAccessToken(connection);
  const timeZone = input.timeZone || 'America/Los_Angeles';
  const attendees = input.attendeeEmails
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email }));

  const body: Record<string, unknown> = {
    summary: input.title.slice(0, 200),
    description: (input.description || '').slice(0, 8000),
    start: { dateTime: input.startsAt.toISOString(), timeZone },
    end: { dateTime: input.endsAt.toISOString(), timeZone },
    attendees,
  };

  if (input.createMeetLink !== false) {
    body.conferenceData = {
      createRequest: {
        requestId: `ccr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  if (input.createMeetLink !== false) {
    url.searchParams.set('conferenceDataVersion', '1');
  }
  url.searchParams.set('sendUpdates', 'all');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    id?: string;
    htmlLink?: string;
    status?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
    error?: { message?: string };
  };

  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Google Calendar API error (${res.status})`);
  }

  const meetFromEntry =
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri || null;

  return {
    id: data.id,
    htmlLink: data.htmlLink || null,
    meetLink: data.hangoutLink || meetFromEntry,
    status: data.status || null,
  };
}

/** Public-safe connection shape (no tokens). */
export function serializeCalendarConnection(c: CrmConnection) {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(c.metaJSON || '{}');
  } catch {
    meta = {};
  }
  return {
    id: c.id,
    provider: c.provider,
    status: c.status,
    externalId: c.externalId,
    email: typeof meta.email === 'string' ? meta.email : c.externalId,
    connectedAt: typeof meta.connectedAt === 'string' ? meta.connectedAt : c.updatedAt,
    scopes: c.scopes,
    hasRefreshToken: Boolean(c.refreshTokenEnc),
  };
}
