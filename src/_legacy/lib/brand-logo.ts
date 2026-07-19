/** Well-known local assets under /public/brands/{slug}.svg */
const LOCAL_LOGO_SLUGS = new Set<string>([]);

/** First letter(s) for monogram avatars — Acme Corp → AC */
export function brandInitials(name: string): string {
  const cleaned = name.replace(/^Demo\s*[·•]\s*/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Resolve display logo: stored logoUrl wins; else known local SVG by slug.
 * Returns null when the UI should show a monogram instead.
 */
export function resolveBrandLogoUrl(brand: {
  slug?: string | null;
  logoUrl?: string | null;
}): string | null {
  const url = brand.logoUrl?.trim();
  if (url) return url;
  const slug = brand.slug?.trim().toLowerCase();
  if (slug && LOCAL_LOGO_SLUGS.has(slug)) return `/brands/${slug}.svg`;
  return null;
}
