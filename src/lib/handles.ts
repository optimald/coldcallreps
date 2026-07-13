/** Shared handle helpers safe for Edge middleware (no Prisma). */

export const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'app',
  'arena',
  'billing',
  'brand',
  'brands',
  'campaigns',
  'clips',
  'dashboard',
  'developers',
  'for',
  'gigs',
  'h',
  'help',
  'hiring',
  'jobs',
  'leaderboard',
  'leads',
  'login',
  'me',
  'onboarding',
  'outbound',
  'cold_calls',
  'practice',
  'pricing',
  'privacy',
  'profile',
  'prospects',
  'r',
  'recruiter',
  'reps',
  'recruiters',
  'sessions',
  'settings',
  'sign-in',
  'sign-up',
  'signup',
  'support',
  't',
  'team',
  'teams',
  'terms',
  'tournaments',
  'trainer',
  'www',
]);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/** Validate a user-chosen handle (after slugify). */
export function validateHandle(
  raw: string
): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = slugify(raw);
  if (!handle || handle.length < 3) {
    return { ok: false, error: 'Handle must be at least 3 characters (a–z, 0–9).' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    return { ok: false, error: 'Use letters, numbers, and hyphens only.' };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: 'That handle is reserved.' };
  }
  return { ok: true, handle };
}
