import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { requireUser } from '@/lib/auth';
import { voiceClientIdentity } from '@/lib/brand-phone';

/**
 * GET /api/twilio/token — Voice access token for browser dialer.
 * Stable identity `user_{profileId}` enables inbound callback routing.
 * Returns { token: null } when voice is not configured (UI shows setup hint).
 */
export async function GET() {
  try {
    const profile = await requireUser();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return NextResponse.json({
        token: null,
        reason: 'voice_not_configured',
        configured: false,
      });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const identity = voiceClientIdentity(profile.id);

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity,
      ttl: 3600,
    });
    token.addGrant(voiceGrant);

    return NextResponse.json({
      token: token.toJwt(),
      configured: true,
      identity,
      fromNumber: process.env.TWILIO_FROM_NUMBER || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Twilio Token]', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
