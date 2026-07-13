import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  BRAND_PHONE_POOL_MAX,
  areaCodeFromE164,
  configureBrandNumberWebhooks,
} from '@/lib/brand-phone';

/**
 * POST /api/brands/[id]/phones/purchase
 * Body: { areaCode: "312" } — search + buy one local DID on the platform Twilio account.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;

    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }
    if (profile.platformRole !== 'SUPERADMIN' && brand.ownerId !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio is not configured on this server' }, { status: 503 });
    }

    const count = await prisma.brandPhoneNumber.count({ where: { brandId: id, isActive: true } });
    if (count >= BRAND_PHONE_POOL_MAX) {
      return NextResponse.json(
        { error: `Pool max is ${BRAND_PHONE_POOL_MAX} active numbers` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const areaCode = String(body.areaCode || '')
      .replace(/\D/g, '')
      .slice(0, 3);
    if (areaCode.length !== 3) {
      return NextResponse.json({ error: 'areaCode must be 3 digits (e.g. 312)' }, { status: 400 });
    }

    const client = twilio(accountSid, authToken);
    const available = await client.availablePhoneNumbers('US').local.list({
      areaCode: parseInt(areaCode, 10),
      voiceEnabled: true,
      limit: 5,
    });

    if (!available.length) {
      return NextResponse.json(
        { error: `No local numbers available for area code ${areaCode}` },
        { status: 404 }
      );
    }

    const pick = available[0];
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: pick.phoneNumber,
      voiceUrl: `${appUrl}/api/twilio/inbound`,
      voiceMethod: 'POST',
      friendlyName: `CCR ${brand.slug} ${areaCode}`,
    });

    const e164 = purchased.phoneNumber;
    const npa = areaCodeFromE164(e164) || areaCode;
    const row = await prisma.brandPhoneNumber.create({
      data: {
        brandId: id,
        e164,
        twilioSid: purchased.sid,
        areaCode: npa,
        label: `Local ${npa}`,
        isActive: true,
      },
    });

    await configureBrandNumberWebhooks(purchased.sid);

    await prisma.brand.update({
      where: { id },
      data: { twilioPhoneE164: e164, twilioPhoneSid: purchased.sid },
    });

    return NextResponse.json({ number: row });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[brands/phones/purchase]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
