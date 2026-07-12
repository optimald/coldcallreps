import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioRequest } from '@/lib/twilio-auth';
import { prisma } from '@/lib/prisma';

/** Optional status callback for inbound legs — updates CallLog when CallSid matches. */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());

  if (!validateTwilioRequest(request, params)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 });
  }

  const callSid = params.CallSid;
  if (callSid) {
    const status = (params.CallStatus || params.DialCallStatus || '').toLowerCase();
    const duration = params.CallDuration ? parseInt(params.CallDuration, 10) : undefined;
    await prisma.callLog
      .updateMany({
        where: { telephonyCallSid: callSid },
        data: {
          ...(status ? { status } : {}),
          ...(typeof duration === 'number' && !Number.isNaN(duration) ? { duration } : {}),
        },
      })
      .catch(() => {});
  }

  return new NextResponse('OK', { status: 200 });
}
