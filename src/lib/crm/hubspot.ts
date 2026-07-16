import type { CrmConnection, Prospect } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret, integrationCryptoConfigured } from '@/lib/crypto-secrets';
import {
  signOAuthState,
  verifyOAuthState,
} from '@/lib/google-calendar';

export const HUBSPOT_PROVIDER = 'hubspot';

const HUBSPOT_SCOPES = [
  'crm.objects.contacts.write',
  'crm.objects.contacts.read',
  'crm.objects.companies.write',
  'crm.objects.companies.read',
  'oauth',
].join(' ');

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');
}

export function hubspotConfigured(): boolean {
  return Boolean(
    process.env.HUBSPOT_CLIENT_ID &&
      process.env.HUBSPOT_CLIENT_SECRET &&
      integrationCryptoConfigured()
  );
}

export function hubspotRedirectUri(): string {
  return (
    process.env.HUBSPOT_REDIRECT_URI ||
    `${appBaseUrl()}/api/integrations/hubspot/callback`
  );
}

export function buildHubspotAuthUrl(userId: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  if (!clientId) throw new Error('HUBSPOT_CLIENT_ID not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: hubspotRedirectUri(),
    scope: HUBSPOT_SCOPES,
    state: signOAuthState(userId),
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
  message?: string;
};

async function exchangeCode(code: string): Promise<TokenResponse> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('HubSpot OAuth not configured');

  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: hubspotRedirectUri(),
      code,
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || data.error_description || data.error || 'Token exchange failed');
  }
  return data;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('HubSpot OAuth not configured');

  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || data.error_description || data.error || 'Refresh failed');
  }
  return data;
}

export async function upsertHubspotConnection(
  userId: string,
  tokens: TokenResponse,
  externalId?: string | null
) {
  const expiresAt =
    tokens.expires_in != null
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

  const existing = await prisma.crmConnection.findFirst({
    where: { userId, provider: HUBSPOT_PROVIDER },
  });

  const data = {
    status: 'connected',
    externalId: externalId || existing?.externalId || null,
    accessTokenEnc: encryptSecret(tokens.access_token!),
    refreshTokenEnc: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing?.refreshTokenEnc || null,
    tokenExpiresAt: expiresAt,
    scopes: HUBSPOT_SCOPES,
  };

  if (existing) {
    return prisma.crmConnection.update({ where: { id: existing.id }, data });
  }
  return prisma.crmConnection.create({
    data: { userId, provider: HUBSPOT_PROVIDER, ...data },
  });
}

export async function completeHubspotOAuth(code: string, state: string) {
  const userId = verifyOAuthState(state);
  if (!userId) throw new Error('Invalid OAuth state');
  const tokens = await exchangeCode(code);

  // HubSpot token info for portal id
  let portalId: string | null = null;
  try {
    const infoRes = await fetch(
      `https://api.hubapi.com/oauth/v1/access-tokens/${tokens.access_token}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (infoRes.ok) {
      const info = (await infoRes.json()) as { hub_id?: number };
      if (info.hub_id != null) portalId = String(info.hub_id);
    }
  } catch {
    /* optional */
  }

  const connection = await upsertHubspotConnection(userId, tokens, portalId);
  const { trackEvent } = await import('@/lib/posthog/analytics');
  trackEvent(userId, 'integration_connected', {
    role: 'BRAND',
    provider: 'hubspot',
    portalId,
  });
  return connection;
}

async function getAccessToken(connection: CrmConnection): Promise<string> {
  if (!connection.accessTokenEnc) throw new Error('HubSpot not connected');

  const expiresSoon =
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

  if (!expiresSoon) {
    return decryptSecret(connection.accessTokenEnc);
  }

  if (!connection.refreshTokenEnc) {
    return decryptSecret(connection.accessTokenEnc);
  }

  const tokens = await refreshAccessToken(decryptSecret(connection.refreshTokenEnc));
  await upsertHubspotConnection(connection.userId, {
    ...tokens,
    refresh_token: tokens.refresh_token || decryptSecret(connection.refreshTokenEnc),
  });
  return tokens.access_token!;
}

type MetaShape = {
  prospectMap?: Record<string, string>;
  lastSyncAt?: string;
  lastSyncError?: string | null;
};

function parseMeta(raw: string | null | undefined): MetaShape {
  try {
    return JSON.parse(raw || '{}') as MetaShape;
  } catch {
    return {};
  }
}

/** Push a ColdCallReps prospect into HubSpot as a contact (create or update). */
export async function pushProspectToHubspot(
  connection: CrmConnection,
  prospect: Prospect
): Promise<{ externalId: string }> {
  const token = await getAccessToken(connection);
  const meta = parseMeta(connection.metaJSON);
  const existingId = meta.prospectMap?.[prospect.id];

  const props: Record<string, string> = {
    company: prospect.companyName || '',
    phone: prospect.phone || '',
    website: prospect.website || '',
    city: prospect.city || '',
    state: prospect.state || '',
    jobtitle: prospect.ownerTitle || '',
  };
  if (prospect.ownerName) {
    const parts = prospect.ownerName.trim().split(/\s+/);
    props.firstname = parts[0] || '';
    props.lastname = parts.slice(1).join(' ') || parts[0] || 'Contact';
  } else {
    props.firstname = prospect.companyName || 'Lead';
    props.lastname = 'Contact';
  }

  let contactId = existingId;
  if (contactId) {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: props }),
      }
    );
    if (!res.ok) {
      // Fall through to create if contact was deleted
      if (res.status !== 404) {
        const err = await res.text();
        throw new Error(`HubSpot update failed: ${err.slice(0, 200)}`);
      }
      contactId = undefined;
    }
  }

  if (!contactId) {
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: props }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !data.id) {
      throw new Error(data.message || 'HubSpot create failed');
    }
    contactId = data.id;
  }

  meta.prospectMap = { ...(meta.prospectMap || {}), [prospect.id]: contactId };
  meta.lastSyncAt = new Date().toISOString();
  meta.lastSyncError = null;
  await prisma.crmConnection.update({
    where: { id: connection.id },
    data: { metaJSON: JSON.stringify(meta) },
  });

  return { externalId: contactId };
}

/** Pull recent HubSpot contact updates into matching mapped prospects (phone/company). */
export async function pullHubspotContacts(connection: CrmConnection, limit = 50) {
  const token = await getAccessToken(connection);
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts?limit=${Math.min(limit, 100)}&properties=firstname,lastname,phone,company,website,city,jobtitle`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = (await res.json()) as {
    results?: { id: string; properties?: Record<string, string | null> }[];
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message || 'HubSpot pull failed');
  }

  const meta = parseMeta(connection.metaJSON);
  const reverse = new Map(
    Object.entries(meta.prospectMap || {}).map(([pid, eid]) => [eid, pid])
  );

  let updated = 0;
  for (const row of data.results || []) {
    const prospectId = reverse.get(row.id);
    if (!prospectId) continue;
    const p = row.properties || {};
    const ownerName = [p.firstname, p.lastname].filter(Boolean).join(' ').trim();
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        ...(p.phone ? { phone: p.phone } : {}),
        ...(p.company ? { companyName: p.company } : {}),
        ...(p.website ? { website: p.website } : {}),
        ...(p.city ? { city: p.city } : {}),
        ...(ownerName ? { ownerName } : {}),
        ...(p.jobtitle ? { ownerTitle: p.jobtitle } : {}),
      },
    });
    updated += 1;
  }

  meta.lastSyncAt = new Date().toISOString();
  meta.lastSyncError = null;
  await prisma.crmConnection.update({
    where: { id: connection.id },
    data: { metaJSON: JSON.stringify(meta) },
  });

  return { pulled: data.results?.length || 0, updated };
}
