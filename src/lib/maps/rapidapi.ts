export interface MapsProspect {
  companyName: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  address?: string;
  reviewRating?: number;
  reviewCount?: number;
  industry?: string;
  placeId?: string;
  hasWebsite: boolean;
}

function normalizeWebsite(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'none' ||
    lower === 'null' ||
    lower === '-' ||
    lower.includes('facebook.com') ||
    lower.includes('instagram.com') ||
    lower.includes('yelp.com') ||
    lower.includes('linktr.ee')
  ) {
    // Social-only / placeholder — treat as no real website for $500 pitch
    return undefined;
  }
  return s;
}

/**
 * Slim Google Maps search via RapidAPI (maps-data.p.rapidapi.com).
 * Used to supply local leads — especially businesses with no website.
 */
export async function searchMapsProspects(
  query: string,
  location: string,
  maxResults = 10,
  opts: { noWebsiteOnly?: boolean } = {}
): Promise<MapsProspect[]> {
  const host = process.env.RAPIDAPI_MAPS_HOST || 'maps-data.p.rapidapi.com';
  const key = process.env.RAPIDAPI_MAPS_KEY;
  if (!key) {
    throw new Error(
      'RAPIDAPI_MAPS_KEY is not configured. Add your RapidAPI Maps key to Vercel + .env.local to search Google Maps leads.'
    );
  }

  // Over-fetch when filtering to no-website so we still return a useful list
  const fetchLimit = opts.noWebsiteOnly
    ? Math.min(Math.max(maxResults * 3, 20), 40)
    : Math.min(maxResults, 20);

  const searchQuery = query.toLowerCase().includes(location.toLowerCase())
    ? query
    : `${query} in ${location}`;
  const url = `https://${host}/searchmaps.php?query=${encodeURIComponent(searchQuery)}&limit=${fetchLimit}&offset=0`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': host,
      'x-rapidapi-key': key,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Maps API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const rows: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
        ? data.results
        : [];

  const mapped = rows.map((raw: any) => {
    const name = raw.name || raw.title || raw.business_name || 'Unknown Business';
    const fullAddress = raw.full_address || raw.address || raw.formatted_address || '';
    const parts = String(fullAddress)
      .split(',')
      .map((s: string) => s.trim());
    const website = normalizeWebsite(raw.website || raw.site || raw.url);
    return {
      companyName: name,
      phone: raw.phone || raw.phone_number || raw.international_phone || undefined,
      website,
      city: raw.city || parts[parts.length - 3] || undefined,
      state: raw.state || parts[parts.length - 2]?.split(' ')[0] || undefined,
      address: fullAddress || undefined,
      reviewRating: Number(raw.rating || raw.review_rating || 0) || undefined,
      reviewCount: Number(raw.review_count || raw.reviews || 0) || undefined,
      industry: raw.type || raw.types?.[0] || raw.category || query,
      placeId: raw.place_id || raw.placeId || undefined,
      hasWebsite: Boolean(website),
    } satisfies MapsProspect;
  });

  // Prefer no-website leads first (core $500 pitch ICP), then optionally filter
  const sorted = [...mapped].sort((a, b) => Number(a.hasWebsite) - Number(b.hasWebsite));
  const filtered = opts.noWebsiteOnly ? sorted.filter((p) => !p.hasWebsite) : sorted;
  return filtered.slice(0, maxResults);
}
