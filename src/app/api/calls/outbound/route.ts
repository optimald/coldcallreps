import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toE164 } from '@/lib/twilio-auth';
import {
  assertCallbackLockAllowsDial,
  resolveCampaignCallerId,
  setCallbackLock,
} from '@/lib/brand-phone';

/** POST — create call log before Device.connect; resolve brand pool CallerId for campaigns. */
export async function POST(request: NextRequest) {
  try {
    const profile = await requireUser();
    const body = await request.json();
    const { prospectId, toNumber, fromNumber, campaignId } = body as {
      prospectId?: string;
      toNumber?: string;
      fromNumber?: string;
      campaignId?: string;
    };

    if (!toNumber || typeof toNumber !== 'string') {
      return NextResponse.json({ error: 'toNumber is required' }, { status: 400 });
    }

    const e164 = toE164(toNumber);
    if (e164.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    if (prospectId) {
      const prospect = await prisma.prospect.findUnique({
        where: { id: prospectId },
      });
      if (!prospect) {
        return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
      }
      const personal = prospect.userId === profile.id && !prospect.brandId;
      let allowed = personal;
      if (!allowed && prospect.brandId) {
        const { canManageBrandLeads, dialableBrandCampaigns } = await import('@/lib/brand-leads');
        if (await canManageBrandLeads(profile, prospect.brandId)) {
          allowed = true;
        } else {
          const camps = await dialableBrandCampaigns(profile.id);
          const brandIds = new Set(camps.map((c) => c.brandId));
          const campIds = new Set(camps.map((c) => c.id));
          allowed =
            brandIds.has(prospect.brandId) &&
            (!prospect.campaignId || campIds.has(prospect.campaignId));
        }
      }
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (campaignId || prospect.campaignId || prospect.brandId) {
        const lock = await assertCallbackLockAllowsDial(prospectId, profile.id);
        if ('error' in lock) {
          return NextResponse.json({ error: lock.error }, { status: lock.status });
        }
      }

      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: 'dialing' },
      });
    }

    let resolvedFrom = fromNumber ? toE164(fromNumber) : null;
    let brandId: string | null = null;
    let brandPhoneNumberId: string | null = null;
    let matchedLocal = false;
    let brandName: string | null = null;

    if (campaignId) {
      // Server resolves brand pool DID — ignore client-supplied personal CallerId
      const resolved = await resolveCampaignCallerId({
        userId: profile.id,
        campaignId,
        prospectE164: e164,
      });
      if ('error' in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }
      resolvedFrom = resolved.fromNumber;
      brandId = resolved.brandId;
      brandPhoneNumberId = resolved.brandPhoneNumberId;
      matchedLocal = resolved.matchedLocal;
      brandName = resolved.brandName;
    } else {
      resolvedFrom = resolvedFrom || process.env.TWILIO_FROM_NUMBER || null;
    }

    const log = await prisma.callLog.create({
      data: {
        userId: profile.id,
        prospectId: prospectId || null,
        campaignId: campaignId || null,
        brandId,
        brandPhoneNumberId,
        direction: 'outbound',
        status: 'initiated',
        toNumber: e164,
        fromNumber: resolvedFrom,
      },
    });

    if (prospectId && campaignId) {
      await setCallbackLock(prospectId, profile.id);
    }

    return NextResponse.json({
      callLogId: log.id,
      fromNumber: resolvedFrom,
      brandId,
      brandName,
      matchedLocal,
      callbackLockHours: campaignId ? 48 : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[calls/outbound POST]', error);
    return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
  }
}

/** PATCH — update call sid / duration / outcome after hangup. */
export async function PATCH(request: NextRequest) {
  try {
    const profile = await requireUser();
    const body = await request.json();
    const { callLogId, telephonyCallSid, duration, status, outcome, notes } = body as {
      callLogId?: string;
      telephonyCallSid?: string;
      duration?: number;
      status?: string;
      outcome?: string;
      notes?: string;
    };

    if (!callLogId) {
      return NextResponse.json({ error: 'callLogId is required' }, { status: 400 });
    }

    const existing = await prisma.callLog.findFirst({
      where: { id: callLogId, userId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Call log not found' }, { status: 404 });
    }

    const updated = await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        ...(telephonyCallSid ? { telephonyCallSid } : {}),
        ...(typeof duration === 'number' ? { duration } : {}),
        ...(status ? { status } : {}),
        ...(outcome !== undefined ? { outcome } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    if (existing.prospectId && (status === 'completed' || typeof duration === 'number')) {
      await prisma.prospect
        .update({
          where: { id: existing.prospectId },
          data: { status: outcome === 'interested' || outcome === 'callback' ? 'warming' : 'done' },
        })
        .catch(() => {});
    }

    // Refresh lock on wrap-up if this was a campaign dial
    if (existing.prospectId && existing.campaignId) {
      await setCallbackLock(existing.prospectId, profile.id).catch(() => {});
    }

    return NextResponse.json({ ok: true, callLog: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[calls/outbound PATCH]', error);
    return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
  }
}
