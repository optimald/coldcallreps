/**
 * UTM parameter capture and URL merge utilities.
 *
 * Captures first-touch UTMs (utm_*) and click IDs (gclid, fbclid) from incoming
 * traffic and persists them in sessionStorage so CTAs across the session carry
 * attribution params to the signup flow.
 */

const SESSION_KEY = 'ccr_utm_first_touch';

const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAM_EXACT = ['gclid', 'fbclid', 'msclkid', 'dclid', 'twclid', 'li_fat_id'];

/**
 * Extract tracking params (utm_*, gclid, fbclid, etc.) from a search string.
 */
export function extractTrackingParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const tracking: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    const lowerKey = key.toLowerCase();
    const isPrefix = TRACKING_PARAM_PREFIXES.some((p) => lowerKey.startsWith(p));
    const isExact = TRACKING_PARAM_EXACT.includes(lowerKey);
    if ((isPrefix || isExact) && value) {
      tracking[key] = value;
    }
  }

  return tracking;
}

/**
 * Build the rep signup URL with tracking params appended.
 * Always preserves role=REP and from=ccr — incoming params cannot override them.
 */
export function buildSignupUrl(
  baseUrl: string,
  trackingParams: Record<string, string>
): string {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(trackingParams)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'role' || lowerKey === 'from') {
      continue;
    }
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

/**
 * Read stored first-touch tracking params from sessionStorage.
 */
export function getStoredTrackingParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Store first-touch tracking params in sessionStorage.
 * Only writes if no existing value — preserves first-touch attribution.
 */
export function storeTrackingParams(params: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  if (Object.keys(params).length === 0) return;

  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (!existing) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(params));
    }
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — fail silently
  }
}

/**
 * Capture first-touch tracking params from the current URL and store them.
 * Call this once on app mount.
 */
export function captureFirstTouchUtms(): void {
  if (typeof window === 'undefined') return;
  const params = extractTrackingParams(window.location.search);
  storeTrackingParams(params);
}

/**
 * Get all tracking params (from sessionStorage, merged with current URL).
 * First-touch (stored) params take precedence.
 */
export function getTrackingParams(): Record<string, string> {
  const stored = getStoredTrackingParams();
  const current =
    typeof window !== 'undefined'
      ? extractTrackingParams(window.location.search)
      : {};

  return { ...current, ...stored };
}
