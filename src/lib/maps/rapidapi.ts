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
}

/**
 * Slim Google Maps search via RapidAPI (maps-data.p.rapidapi.com).
 * Extracted from TROJAN maps-scraper for ColdCallReps lead gen.
 */
export async function searchMapsProspects(
  query: string,
  location: string,
  maxResults = 10
): Promise<MapsProspect[]> {
  const host = process.env.RAPIDAPI_MAPS_HOST || 'maps-data.p.rapidapi.com';
  const key = process.env.RAPIDAPI_MAPS_KEY;
  if (!key) {
    throw new Error('RAPIDAPI_MAPS_KEY is not configured');
  }

  const searchQuery = query.toLowerCase().includes(location.toLowerCase())
    ? query
    : `${query} in ${location}`;
  const url = `https://${host}/searchmaps.php?query=${encodeURIComponent(searchQuery)}&limit=${Math.min(maxResults, 20)}&offset=0`;

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

  return rows.slice(0, maxResults).map((raw: any) => {
    const name = raw.name || raw.title || raw.business_name || 'Unknown Business';
    const fullAddress = raw.full_address || raw.address || raw.formatted_address || '';
    const parts = String(fullAddress).split(',').map((s: string) => s.trim());
    return {
      companyName: name,
      phone: raw.phone || raw.phone_number || raw.international_phone || undefined,
      website: raw.website || raw.site || raw.url || undefined,
      city: raw.city || parts[parts.length - 3] || undefined,
      state: raw.state || parts[parts.length - 2]?.split(' ')[0] || undefined,
      address: fullAddress || undefined,
      reviewRating: Number(raw.rating || raw.review_rating || 0) || undefined,
      reviewCount: Number(raw.review_count || raw.reviews || 0) || undefined,
      industry: raw.type || raw.types?.[0] || raw.category || query,
      placeId: raw.place_id || raw.placeId || undefined,
    } satisfies MapsProspect;
  });
}
