import type { MetadataRoute } from 'next';
import { GUIDES, GUIDES_UPDATED_AT } from '@/lib/guides';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * Homepage last material content change. Bump this when the home page copy or
 * layout changes so the sitemap lastmod stays truthful.
 */
const HOME_UPDATED_AT = '2026-09-22';

/** Recruiting landing for “hire cold callers” (rep-side) — brand-side guide lives on MarketPounce. */
const HIRE_LANDING_UPDATED_AT = '2026-09-22';

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
  priority: number;
  /** Omit when we do not track a truthful last-modified date for the page. */
  lastModified?: string;
};

/** Public marketing URLs for search engines — SDR recruiting focus (apex only). */
export default function sitemap(): MetadataRoute.Sitemap {
  const guideEntries: Entry[] = [
    { path: '/guides', changeFrequency: 'weekly', priority: 0.7, lastModified: GUIDES_UPDATED_AT },
    ...GUIDES.map((guide) => ({
      path: `/guides/${guide.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      lastModified: guide.updatedAt,
    })),
  ];

  const entries: Entry[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1, lastModified: HOME_UPDATED_AT },
    { path: '/for/reps', changeFrequency: 'weekly', priority: 0.95, lastModified: HOME_UPDATED_AT },
    {
      path: '/hire-cold-callers',
      changeFrequency: 'weekly',
      priority: 0.9,
      lastModified: HIRE_LANDING_UPDATED_AT,
    },
    { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/llms.txt', changeFrequency: 'monthly', priority: 0.4 },
    ...guideEntries,
  ];

  return entries.map(({ path, changeFrequency, priority, lastModified }) => ({
    url: `${SITE_ORIGIN}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  }));
}
