/** Superadmin Live / Demo desk mode (mirrors brand desk mode). */
export const ADMIN_DESK_MODE_KEY = 'ccr-admin-desk-mode';
export const ADMIN_DESK_MODE_COOKIE = 'ccr-admin-desk-mode';

export type AdminDeskMode = 'live' | 'demo';

export function readAdminDeskMode(): AdminDeskMode {
  if (typeof window === 'undefined') return 'live';
  try {
    const v = localStorage.getItem(ADMIN_DESK_MODE_KEY);
    return v === 'demo' ? 'demo' : 'live';
  } catch {
    return 'live';
  }
}

function syncAdminDeskModeCookie(mode: AdminDeskMode) {
  try {
    document.cookie = `${ADMIN_DESK_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function writeAdminDeskMode(mode: AdminDeskMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_DESK_MODE_KEY, mode);
    syncAdminDeskModeCookie(mode);
    window.dispatchEvent(new CustomEvent('ccr-admin-desk-mode', { detail: mode }));
  } catch {
    /* ignore */
  }
}

/** Server / API: read desk mode from Cookie header or Next cookies value. */
export function parseAdminDeskModeCookie(
  cookieHeaderOrValue: string | null | undefined
): AdminDeskMode {
  if (!cookieHeaderOrValue) return 'live';
  // Full Cookie header
  if (cookieHeaderOrValue.includes('=')) {
    const match = cookieHeaderOrValue.match(
      new RegExp(`(?:^|;\\s*)${ADMIN_DESK_MODE_COOKIE}=(demo|live)`)
    );
    return match?.[1] === 'demo' ? 'demo' : 'live';
  }
  return cookieHeaderOrValue === 'demo' ? 'demo' : 'live';
}
