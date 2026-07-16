import type { MetadataRoute } from 'next';
import { GUIDE_SLUGS } from '@/lib/guides';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');

/** Public marketing URLs for search engines. Auth/app desks are omitted. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const guideEntries = [
    { path: '/guides', changeFrequency: 'weekly' as const, priority: 0.7 },
    ...GUIDE_SLUGS.map((slug) => ({
      path: `/guides/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  const entries: { path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }[] =
    [
      { path: '/', changeFrequency: 'weekly', priority: 1 },
      { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
      { path: '/for', changeFrequency: 'monthly', priority: 0.8 },
      { path: '/for/reps', changeFrequency: 'monthly', priority: 0.9 },
      { path: '/for/brands', changeFrequency: 'monthly', priority: 0.9 },
      { path: '/for/teams', changeFrequency: 'monthly', priority: 0.7 },
      { path: '/for/recruiters', changeFrequency: 'monthly', priority: 0.6 },
      { path: '/developers', changeFrequency: 'monthly', priority: 0.5 },
      { path: '/gigs', changeFrequency: 'daily', priority: 0.85 },
      { path: '/leaderboard', changeFrequency: 'daily', priority: 0.6 },
      { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
      { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
      { path: '/sign-up', changeFrequency: 'monthly', priority: 0.8 },
      { path: '/sign-in', changeFrequency: 'monthly', priority: 0.5 },
      { path: '/llms.txt', changeFrequency: 'monthly', priority: 0.4 },
      ...guideEntries,
    ];

  return entries.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
