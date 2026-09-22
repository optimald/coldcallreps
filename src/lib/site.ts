/**
 * Canonical public origin for Cold Call Reps.
 * Apex only — www redirects to apex (see middleware).
 */
export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com'
).replace(/\/$/, '');

export const SITE_HOST = 'coldcallreps.com';
export const SITE_WWW_HOST = 'www.coldcallreps.com';
