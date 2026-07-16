import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/dashboard',
        '/settings',
        '/billing',
        '/onboarding',
        '/brands/',
        '/cold_calls',
        '/practice',
        '/trainer',
        '/earnings',
        '/subscribe',
        '/book/',
        '/restricted',
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
