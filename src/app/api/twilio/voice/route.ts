import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioRequest, toE164 } from '@/lib/twilio-auth';
import { prisma } from '@/lib/prisma';
import { parseVoiceClientUserId } from '@/lib/brand-phone';

/**
 * TwiML Voice webhook for the browser dialer (TwiML App Voice URL).
 * Outbound must include CallLogId from /api/calls/outbound — dials are
 * authorized against that log (To, CallerId, client identity).
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
  const callLogId = (params.CallLogId || params.callLogId || '').trim();
  const fromClient = params.From || params.Caller || '';

  let xml: string;

  if (toNumber && !toNumber.startsWith('client:')) {
    if (!callLogId) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Call authorization missing. Start the dial from Cold Call Reps.</Say>
  <Hangup/>
</Response>`;
    } else {
      const log = await prisma.callLog.findUnique({
        where: { id: callLogId },
        select: {
          id: true,
          userId: true,
          toNumber: true,
          fromNumber: true,
          status: true,
          direction: true,
        },
      });

      const clientUserId = parseVoiceClientUserId(fromClient);
      const dest = toE164(toNumber);
      const logTo = log?.toNumber ? toE164(log.toNumber) : null;
      const callerId = log?.fromNumber ? toE164(log.fromNumber) : '';

      const allowed =
        log &&
        log.direction === 'outbound' &&
        ['initiated', 'in-progress', 'ringing'].includes(log.status) &&
        clientUserId === log.userId &&
        logTo &&
        dest === logTo &&
        Boolean(callerId);

      if (!allowed || !callerId) {
        xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This outbound call is not authorized.</Say>
  <Hangup/>
</Response>`;
      } else {
        const safeTo = dest.replace(/[<>&'"]/g, '');
        const safeCaller = callerId.replace(/[<>&'"]/g, '');
        xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${safeCaller}" answerOnBridge="true" timeout="30">
    <Number>${safeTo}</Number>
  </Dial>
</Response>`;
      }
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
