import type { MetadataRoute } from 'next';
import { GUIDES, GUIDES_UPDATED_AT } from '@/lib/guides';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');

/**
 * Homepage last material content change. Bump this when the home page copy or
 * layout changes so the sitemap lastmod stays truthful.
 */
const HOME_UPDATED_AT = '2026-07-20';

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
  priority: number;
  /** Omit when we do not track a truthful last-modified date for the page. */
  lastModified?: string;
};

/** Public marketing URLs for search engines — SDR recruiting focus. */
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
    { path: '/for/reps', changeFrequency: 'weekly', priority: 0.95 },
    { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/llms.txt', changeFrequency: 'monthly', priority: 0.4 },
    ...guideEntries,
  ];

  return entries.map(({ path, changeFrequency, priority, lastModified }) => ({
    url: `${SITE}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  }));
}
