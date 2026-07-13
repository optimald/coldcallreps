/**
 * Canonical high-ticket demo brands — shared by brand-desk Demo mode and SDR practice seed.
 * Slugs match DB (`demo-*`) so portfolio links and /practice pickers stay aligned.
 */

export type DemoVertical = 'saas' | 'insurance' | 'home_services';

export type CanonicalDemoBrand = {
  /** Stable in-memory id for desk fixtures */
  id: string;
  /** DB + URL slug */
  slug: string;
  name: string;
  shortName: string;
  description: string;
  vertical: DemoVertical;
  verticalLabel: string;
  acvLabel: string;
  logoUrl: string | null;
  primaryCampaignId: string;
};

export const CANONICAL_DEMO_BRANDS: CanonicalDemoBrand[] = [
  {
    id: 'demo-brand-meridianops',
    slug: 'demo-meridianops',
    name: 'MeridianOps',
    shortName: 'MeridianOps',
    description:
      'B2B SaaS — revenue operations platform for mid-market / enterprise sales orgs ($28k–$90k ARR).',
    vertical: 'saas',
    verticalLabel: 'B2B SaaS / RevOps',
    acvLabel: '$28k–$90k ARR',
    logoUrl: null,
    primaryCampaignId: 'demo-camp-meridian-ql',
  },
  {
    id: 'demo-brand-harborline',
    slug: 'demo-harborline',
    name: 'Harborline Benefits',
    shortName: 'Harborline',
    description:
      'Insurance — high-ticket life, commercial, and Medicare Advantage enrollments ($3k–$25k+ case value).',
    vertical: 'insurance',
    verticalLabel: 'Life / commercial / MA',
    acvLabel: '$3k–$25k+ case',
    logoUrl: null,
    primaryCampaignId: 'demo-camp-harbor-life',
  },
  {
    id: 'demo-brand-summitshield',
    slug: 'demo-summitshield',
    name: 'SummitShield Home',
    shortName: 'SummitShield',
    description:
      'Home services — roofing, HVAC replacement, and residential solar ($8k–$45k projects).',
    vertical: 'home_services',
    verticalLabel: 'Roof / HVAC / solar',
    acvLabel: '$8k–$45k project',
    logoUrl: null,
    primaryCampaignId: 'demo-camp-summit-roof',
  },
];

export function isPlatformDemoSlug(slug: string | null | undefined): boolean {
  return Boolean(slug && slug.startsWith('demo-'));
}

export function canonicalDemoBrandBySlug(
  slug: string | null | undefined
): CanonicalDemoBrand | null {
  if (!slug) return null;
  const key = slug.toLowerCase();
  return (
    CANONICAL_DEMO_BRANDS.find((b) => b.slug === key || b.id === key) || null
  );
}

export function resolveDemoBrandKey(brandKey: string | null | undefined): string {
  const hit = canonicalDemoBrandBySlug(brandKey);
  if (hit) return hit.slug;
  // Legacy desk keys → map into canonical trio
  const legacy: Record<string, string> = {
    nike: 'demo-meridianops',
    'aegis-life': 'demo-harborline',
    'fleet-co': 'demo-summitshield',
    aegis: 'demo-harborline',
    fleet: 'demo-summitshield',
  };
  if (brandKey && legacy[brandKey]) return legacy[brandKey];
  return CANONICAL_DEMO_BRANDS[0].slug;
}

/** In-memory brand row when DB seed hasn't created demo-* yet. */
export function syntheticCanonicalBrand(idOrSlug: string): {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  ownerId: null;
} | null {
  const demo = canonicalDemoBrandBySlug(idOrSlug);
  if (!demo) return null;
  return {
    id: demo.id,
    slug: demo.slug,
    name: demo.name,
    logoUrl: demo.logoUrl,
    ownerId: null,
  };
}
