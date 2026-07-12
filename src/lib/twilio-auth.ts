import type { NextRequest } from 'next/server';
import { validateRequest } from 'twilio';

/** Validate Twilio webhook signature. Skipped in development when TWILIO_SKIP_SIGNATURE=1. */
export function validateTwilioRequest(request: NextRequest, params: Record<string, string>): boolean {
  if (process.env.TWILIO_SKIP_SIGNATURE === '1' || process.env.NODE_ENV === 'development') {
    return true;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[TwilioAuth] Missing TWILIO_AUTH_TOKEN');
    return false;
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return false;

  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const host =
    request.headers.get('host') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ||
    'localhost:3000';
  const url = `${protocol}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    return validateRequest(authToken, signature, url, params);
  } catch (e) {
    console.error('[TwilioAuth] Validation error:', e);
    return false;
  }
}

export function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}
