/** Client-side selected brand for brand-role IA (sidebar + redirects). */
export const SELECTED_BRAND_KEY = 'ccr-selected-brand';
/** Cookie mirror so server redirects can prefer the same brand. */
export const SELECTED_BRAND_COOKIE = 'ccr-selected-brand';
/** Brand desk data mode: live = real campaign CRM; demo = in-memory sample fixtures. */
export const BRAND_DESK_MODE_KEY = 'ccr-brand-desk-mode';
/** Cookie mirror so SSR / first paint match Live vs Demo without waiting on localStorage. */
export const BRAND_DESK_MODE_COOKIE = 'ccr-brand-desk-mode';

export type BrandDeskMode = 'live' | 'demo';

export type BrandRef = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
};

/** Prefer slug in URLs; fall back to id. */
export function brandPathKey(brand: Pick<BrandRef, 'id' | 'slug'>): string {
  return brand.slug || brand.id;
}

export function brandHref(
  brand: Pick<BrandRef, 'id' | 'slug'> | string,
  ...segments: string[]
): string {
  const key = typeof brand === 'string' ? brand : brandPathKey(brand);
  const rest = segments.filter(Boolean).join('/');
  return rest ? `/brands/${key}/${rest}` : `/brands/${key}`;
}

export function readSelectedBrandKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(SELECTED_BRAND_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function writeSelectedBrandKey(key: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SELECTED_BRAND_KEY, key);
    window.dispatchEvent(new CustomEvent('ccr-selected-brand', { detail: key }));
  } catch {
    /* ignore */
  }
}

export function readBrandDeskMode(): BrandDeskMode {
  if (typeof window === 'undefined') return 'live';
  try {
    const v = localStorage.getItem(BRAND_DESK_MODE_KEY);
    return v === 'demo' ? 'demo' : 'live';
  } catch {
    return 'live';
  }
}

function syncDeskModeCookie(mode: BrandDeskMode) {
  try {
    document.cookie = `${BRAND_DESK_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export function writeBrandDeskMode(mode: BrandDeskMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BRAND_DESK_MODE_KEY, mode);
    syncDeskModeCookie(mode);
    window.dispatchEvent(new CustomEvent('ccr-brand-desk-mode', { detail: mode }));
  } catch {
    /* ignore */
  }
}

/** Resolve selected brand from storage + owned list (slug or id match). */
export function resolveSelectedBrand(
  brands: BrandRef[],
  preferredKey?: string | null
): BrandRef | null {
  if (!brands.length) return null;
  const key = preferredKey ?? readSelectedBrandKey();
  if (key) {
    const hit = brands.find((b) => b.slug === key || b.id === key);
    if (hit) return hit;
  }
  return brands[0];
}
