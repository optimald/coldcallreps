import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioRequest, toE164 } from '@/lib/twilio-auth';
import { prisma } from '@/lib/prisma';
import {
  findBrandPhoneByE164,
  findProspectForInboundCallback,
  voiceClientIdentity,
} from '@/lib/brand-phone';

function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, '');
}

function twiml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * Inbound voice on brand pool DIDs.
 * Routes callbacks to the SDR who holds the 48h lock; else brand fallback / greeting.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());

  if (!validateTwilioRequest(request, params)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 });
  }

  const toRaw = params.To || params.Called || '';
  const fromRaw = params.From || params.Caller || '';
  let toE: string;
  let fromE: string;
  try {
    toE = toE164(toRaw);
    fromE = toE164(fromRaw);
  } catch {
    return twiml('<Say>Invalid phone number.</Say><Hangup/>');
  }

  const brandPhone = await findBrandPhoneByE164(toE);
  if (!brandPhone) {
    return twiml('<Say>This number is not configured for callbacks.</Say><Hangup/>');
  }

  const brand = brandPhone.brand;
  const prospect = await findProspectForInboundCallback({
    brandId: brand.id,
    fromE164: fromE,
  });

  const lockedUserId = prospect?.callbackLockedByUserId || null;
  const brandRow = await prisma.brand.findUnique({
    where: { id: brand.id },
    select: { ownerId: true },
  });
  const logUserId = lockedUserId || brandRow?.ownerId;
  if (logUserId) {
    await prisma.callLog.create({
      data: {
        userId: logUserId,
        prospectId: prospect?.id || null,
        campaignId: prospect?.campaignId || null,
        brandId: brand.id,
        brandPhoneNumberId: brandPhone.id,
        direction: 'inbound',
        status: 'ringing',
        toNumber: toE,
        fromNumber: fromE,
        telephonyCallSid: params.CallSid || null,
        notes: prospect
          ? `Inbound callback: ${prospect.ownerName || 'Contact'} from ${prospect.companyName}`
          : 'Inbound to brand pool (no active lock)',
      },
    }).catch(() => {});
  }
  const greeting =
    brand.inboundGreeting?.trim() ||
    `Thanks for calling back ${brand.name}. Please hold while we connect you.`;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const fallbackUrl = `${appUrl}/api/twilio/inbound/fallback?brandId=${encodeURIComponent(brand.id)}`;

  if (lockedUserId) {
    const clientId = xmlEscape(voiceClientIdentity(lockedUserId));
    const say = xmlEscape(greeting);
    // Dial SDR browser; if no answer, action → fallback
    return twiml(`
  <Say>${say}</Say>
  <Dial timeout="25" answerOnBridge="true" action="${xmlEscape(fallbackUrl)}" method="POST">
    <Client>${clientId}</Client>
  </Dial>`);
  }

  const fallback = brand.fallbackPhoneE164?.trim();
  if (fallback) {
    const say = xmlEscape(greeting);
    const safeFallback = xmlEscape(toE164(fallback));
    return twiml(`
  <Say>${say}</Say>
  <Dial timeout="30" answerOnBridge="true" callerId="${xmlEscape(toE)}">
    <Number>${safeFallback}</Number>
  </Dial>`);
  }

  return twiml(
    `<Say>${xmlEscape(greeting)} No agents are available right now. Please try again later.</Say><Hangup/>`
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
