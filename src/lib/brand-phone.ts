import 'server-only';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { toE164 } from '@/lib/twilio-auth';

const E164_RE = /^\+[1-9]\d{7,14}$/;

export const BRAND_PHONE_POOL_MAX = 10;
export const CALLBACK_LOCK_HOURS = 48;

/** Normalize and validate brand tracking DID. Returns null if empty. */
export function parseBrandPhoneE164(raw: unknown): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const e164 = toE164(trimmed);
  if (!E164_RE.test(e164)) {
    throw new Error('Phone must be E.164 (e.g. +14155551234)');
  }
  return e164;
}

/** Stable Twilio Voice Client identity for inbound callback routing. */
export function voiceClientIdentity(userId: string): string {
  return `user_${userId}`;
}

export function parseVoiceClientUserId(identity: string): string | null {
  if (!identity.startsWith('user_')) return null;
  return identity.slice(5) || null;
}

/** Extract NANP area code (NPA) from E.164 / national digits. */
export function areaCodeFromE164(e164: string): string | null {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  if (digits.length > 10) return digits.slice(-10, -7);
  return null;
}

/**
 * If Twilio account creds exist, look up IncomingPhoneNumber SID for this E.164.
 */
export async function lookupTwilioPhoneSid(e164: string): Promise<string | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) return null;

  try {
    const client = twilio(accountSid, authToken);
    const list = await client.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 1 });
    return list[0]?.sid ?? null;
  } catch (e) {
    console.warn('[brand-phone] Twilio SID lookup failed', e);
    return null;
  }
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Point a Twilio IncomingPhoneNumber Voice URL at our inbound webhook. */
export async function configureBrandNumberWebhooks(twilioSid: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken || !twilioSid) return;

  const voiceUrl = `${appBaseUrl()}/api/twilio/inbound`;
  try {
    const client = twilio(accountSid, authToken);
    await client.incomingPhoneNumbers(twilioSid).update({
      voiceUrl,
      voiceMethod: 'POST',
      statusCallback: `${appBaseUrl()}/api/twilio/inbound/status`,
      statusCallbackMethod: 'POST',
    });
  } catch (e) {
    console.warn('[brand-phone] Failed to configure number webhooks', twilioSid, e);
  }
}

export type PickedDid = {
  id: string;
  e164: string;
  areaCode: string;
  brandId: string;
  matchedLocal: boolean;
};

/** Prefer pool DID matching prospect NPA; else first active pool number. */
export async function pickLocalPresenceDid(
  brandId: string,
  prospectE164: string
): Promise<PickedDid | null> {
  const numbers = await prisma.brandPhoneNumber.findMany({
    where: { brandId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, e164: true, areaCode: true, brandId: true },
  });
  if (numbers.length === 0) {
    // Legacy fallback: single Brand.twilioPhoneE164
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { twilioPhoneE164: true },
    });
    const legacy = brand?.twilioPhoneE164?.trim();
    if (legacy) {
      const ac = areaCodeFromE164(legacy) || '000';
      return {
        id: '',
        e164: toE164(legacy),
        areaCode: ac,
        brandId,
        matchedLocal: areaCodeFromE164(prospectE164) === ac,
      };
    }
    return null;
  }

  const npa = areaCodeFromE164(prospectE164);
  const local = npa ? numbers.find((n) => n.areaCode === npa) : null;
  const pick = local || numbers[0];
  return {
    id: pick.id,
    e164: pick.e164,
    areaCode: pick.areaCode,
    brandId: pick.brandId,
    matchedLocal: Boolean(local),
  };
}

export type ResolveCallerOk = {
  fromNumber: string;
  brandId: string;
  brandName: string;
  brandPhoneNumberId: string | null;
  matchedLocal: boolean;
};

/**
 * Resolve Twilio Dial callerId for a campaign outbound dial from the brand pool.
 * Requires ACCEPTED/ACTIVE application.
 */
export async function resolveCampaignCallerId(opts: {
  userId: string;
  campaignId: string;
  prospectE164: string;
}): Promise<ResolveCallerOk | { error: string; status: number }> {
  const app = await prisma.campaignApplication.findUnique({
    where: {
      campaignId_userId: { campaignId: opts.campaignId, userId: opts.userId },
    },
    select: {
      status: true,
      campaign: {
        select: {
          id: true,
          brandId: true,
          brand: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!app) {
    return { error: 'Not accepted on this campaign', status: 403 };
  }
  if (app.status !== 'ACCEPTED' && app.status !== 'ACTIVE') {
    return { error: 'Campaign dials unlock after the brand accepts you', status: 403 };
  }

  const brand = app.campaign.brand;
  const picked = await pickLocalPresenceDid(brand.id, opts.prospectE164);
  if (!picked) {
    return {
      error: 'Brand has no phone pool yet — add local numbers on the brand desk before SDRs can dial',
      status: 400,
    };
  }

  return {
    fromNumber: picked.e164,
    brandId: brand.id,
    brandName: brand.name,
    brandPhoneNumberId: picked.id || null,
    matchedLocal: picked.matchedLocal,
  };
}

/** True if this E.164 is the platform default or an active brand pool DID (or legacy). */
export async function isAllowedCallerId(e164: string): Promise<boolean> {
  const normalized = toE164(e164);
  const platform = process.env.TWILIO_FROM_NUMBER?.trim();
  if (platform && toE164(platform) === normalized) return true;

  const poolHit = await prisma.brandPhoneNumber.findFirst({
    where: { e164: normalized, isActive: true },
    select: { id: true },
  });
  if (poolHit) return true;

  const legacy = await prisma.brand.findFirst({
    where: { twilioPhoneE164: normalized },
    select: { id: true },
  });
  return Boolean(legacy);
}

export async function setCallbackLock(prospectId: string, userId: string): Promise<Date> {
  const until = new Date(Date.now() + CALLBACK_LOCK_HOURS * 60 * 60 * 1000);
  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      callbackLockedUntil: until,
      callbackLockedByUserId: userId,
    },
  });
  return until;
}

/**
 * Block dial if another SDR holds an active 48h callback lock on this prospect.
 * Same SDR may redial (refreshes lock).
 */
export async function assertCallbackLockAllowsDial(
  prospectId: string,
  userId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: {
      callbackLockedUntil: true,
      callbackLockedByUserId: true,
    },
  });
  if (!prospect?.callbackLockedUntil || !prospect.callbackLockedByUserId) {
    return { ok: true };
  }
  if (prospect.callbackLockedUntil.getTime() <= Date.now()) {
    return { ok: true };
  }
  if (prospect.callbackLockedByUserId === userId) {
    return { ok: true };
  }
  return {
    error: 'This lead is locked to another rep for callbacks (48h). Pick a different lead.',
    status: 409,
  };
}

export async function findBrandPhoneByE164(e164: string) {
  const normalized = toE164(e164);
  return prisma.brandPhoneNumber.findFirst({
    where: { e164: normalized, isActive: true },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          fallbackPhoneE164: true,
          inboundGreeting: true,
        },
      },
    },
  });
}

/** Find prospect matching inbound From for a brand (phone digits). */
export async function findProspectForInboundCallback(opts: {
  brandId: string;
  fromE164: string;
}) {
  const digits = opts.fromE164.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  const prospects = await prisma.prospect.findMany({
    where: {
      brandId: opts.brandId,
      phone: { not: null },
      callbackLockedUntil: { gt: new Date() },
      callbackLockedByUserId: { not: null },
    },
    select: {
      id: true,
      phone: true,
      companyName: true,
      ownerName: true,
      campaignId: true,
      callbackLockedByUserId: true,
      callbackLockedUntil: true,
    },
    take: 80,
  });

  return (
    prospects.find((p) => {
      const pDigits = (p.phone || '').replace(/\D/g, '');
      return pDigits.slice(-10) === last10 || pDigits === digits;
    }) || null
  );
}
