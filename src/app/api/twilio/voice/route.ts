import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioRequest, toE164 } from '@/lib/twilio-auth';
import { isAllowedCallerId } from '@/lib/brand-phone';

/**
 * TwiML Voice webhook for the browser dialer (TwiML App Voice URL).
 * Outbound: Device.connect({ params: { To, CallerId } }) → <Dial><Number>
 * CallerId must be platform default or an active brand pool DID.
 *
 * Must be public (Twilio server-to-server). No Clerk auth.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());

  if (!validateTwilioRequest(request, params)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 });
  }

  const toNumber = params.To;
  const fromNumber = params.From || params.Caller;
  const callerIdOverride = params.CallerId;
  let callerId =
    callerIdOverride ||
    (fromNumber?.startsWith('+') ? fromNumber : null) ||
    process.env.TWILIO_FROM_NUMBER ||
    '';

  if (callerId) {
    try {
      const normalized = toE164(callerId);
      const allowed = await isAllowedCallerId(normalized);
      if (!allowed) {
        const platform = process.env.TWILIO_FROM_NUMBER?.trim();
        callerId = platform || '';
      } else {
        callerId = normalized;
      }
    } catch {
      callerId = process.env.TWILIO_FROM_NUMBER || '';
    }
  }

  let xml: string;

  if (toNumber && !toNumber.startsWith('client:')) {
    const safeTo = toNumber.replace(/[<>&'"]/g, '');
    const safeCaller = callerId.replace(/[<>&'"]/g, '');
    if (!safeCaller) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Outbound caller ID is not configured.</Say>
  <Hangup/>
</Response>`;
    } else {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${safeCaller}" answerOnBridge="true" timeout="30">
    <Number>${safeTo}</Number>
  </Dial>
</Response>`;
    }
  } else {
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No destination number was provided.</Say>
  <Hangup/>
</Response>`;
  }

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
