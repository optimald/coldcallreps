import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioRequest, toE164 } from '@/lib/twilio-auth';
import { prisma } from '@/lib/prisma';

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
 * Dial action when Client leg does not complete — ring brand fallback.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());

  if (!validateTwilioRequest(request, params)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 });
  }

  const dialStatus = (params.DialCallStatus || params.DialStatus || '').toLowerCase();
  if (dialStatus === 'completed' || dialStatus === 'answered') {
    return twiml('<Hangup/>');
  }

  const brandId =
    request.nextUrl.searchParams.get('brandId') ||
    params.brandId ||
    '';
  if (!brandId) {
    return twiml('<Say>Unable to route your call.</Say><Hangup/>');
  }

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      name: true,
      fallbackPhoneE164: true,
      inboundGreeting: true,
      phoneNumbers: {
        where: { isActive: true },
        take: 1,
        select: { e164: true },
      },
    },
  });

  if (!brand?.fallbackPhoneE164) {
    return twiml(
      `<Say>Thanks for calling ${xmlEscape(brand?.name || 'us')}. No one is available. Please try again later.</Say><Hangup/>`
    );
  }

  const callerId = brand.phoneNumbers[0]?.e164 || process.env.TWILIO_FROM_NUMBER || '';
  const say = xmlEscape(
    brand.inboundGreeting?.trim() ||
      `Thanks for calling ${brand.name}. Connecting you to our team.`
  );

  return twiml(`
  <Say>${say}</Say>
  <Dial timeout="30" answerOnBridge="true"${callerId ? ` callerId="${xmlEscape(toE164(callerId))}"` : ''}>
    <Number>${xmlEscape(toE164(brand.fallbackPhoneE164))}</Number>
  </Dial>`);
}

export async function GET(request: NextRequest) {
  return POST(request);
}
