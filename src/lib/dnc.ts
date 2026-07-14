import 'server-only';

import { prisma } from '@/lib/prisma';
import { toE164 } from '@/lib/twilio-auth';

/** True if phone is on global or brand DNC list, or prospect.doNotCall. */
export async function isOnDoNotCall(opts: {
  phone: string;
  brandId?: string | null;
  prospectId?: string | null;
}): Promise<{ blocked: boolean; reason?: string }> {
  const e164 = toE164(opts.phone);
  if (opts.prospectId) {
    const p = await prisma.prospect.findUnique({
      where: { id: opts.prospectId },
      select: { doNotCall: true, doNotCallReason: true, consentStatus: true },
    });
    if (p?.doNotCall) {
      return { blocked: true, reason: p.doNotCallReason || 'Prospect marked DNC' };
    }
    if (p?.consentStatus === 'denied' || p?.consentStatus === 'revoked') {
      return { blocked: true, reason: `Consent ${p.consentStatus}` };
    }
  }

  const entries = await prisma.doNotCallEntry.findMany({
    where: {
      phoneE164: e164,
      OR: [
        { scope: 'global', brandId: null },
        ...(opts.brandId
          ? [{ scope: 'brand' as const, brandId: opts.brandId }]
          : []),
      ],
    },
    take: 1,
  });
  if (entries[0]) {
    return { blocked: true, reason: entries[0].reason || 'DNC list' };
  }
  return { blocked: false };
}
