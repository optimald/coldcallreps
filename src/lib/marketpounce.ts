/**
 * Product auth lives on marketpounce.com.
 * This site never hosts login — see next.config.ts redirects for /sign-in|/sign-up.
 */
export const MARKETPOUNCE_ORIGIN = 'https://marketpounce.com';

export const MARKETPOUNCE_SIGN_IN = `${MARKETPOUNCE_ORIGIN}/sign-in`;

export function marketpounceSignUp(qs?: string): string {
  return `${MARKETPOUNCE_ORIGIN}/sign-up${qs ? `?${qs}` : ''}`;
}

/** Default SDR signup (primary CTA for this marketing site). */
export const MARKETPOUNCE_SIGN_UP_REP = marketpounceSignUp('role=REP');

/** Brand founder signup. */
export const MARKETPOUNCE_SIGN_UP_BRAND = marketpounceSignUp('role=BRAND');
