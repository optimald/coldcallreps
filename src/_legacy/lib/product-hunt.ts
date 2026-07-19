/**
 * Product Hunt launch ingest — founder outbound pipeline.
 * Uses PH public GraphQL (no key) when available; falls back to curated stub list.
 */

export type PhLaunch = {
  phId: string;
  name: string;
  tagline: string;
  url: string;
  votesCount: number;
  featuredAt: string | null;
};

const FALLBACK_LAUNCHES: PhLaunch[] = [
  {
    phId: 'ph-demo-1',
    name: 'LaunchPad CRM',
    tagline: 'Pipeline for bootstrapped B2B founders',
    url: 'https://www.producthunt.com',
    votesCount: 120,
    featuredAt: new Date().toISOString(),
  },
  {
    phId: 'ph-demo-2',
    name: 'InboxZero Ops',
    tagline: 'Shared inbox for early sales teams',
    url: 'https://www.producthunt.com',
    votesCount: 85,
    featuredAt: new Date().toISOString(),
  },
  {
    phId: 'ph-demo-3',
    name: 'ShipLog',
    tagline: 'Changelog + waitlist for indie SaaS',
    url: 'https://www.producthunt.com',
    votesCount: 64,
    featuredAt: new Date().toISOString(),
  },
];

/** Fetch recent Product Hunt posts (best-effort). */
export async function fetchRecentProductHuntLaunches(limit = 30): Promise<PhLaunch[]> {
  const token = process.env.PRODUCTHUNT_API_TOKEN?.trim();
  if (token) {
    try {
      const query = `
        query {
          posts(first: ${Math.min(limit, 50)}, order: VOTES) {
            edges {
              node {
                id
                name
                tagline
                url
                votesCount
                createdAt
              }
            }
          }
        }`;
      const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        const edges = data?.data?.posts?.edges || [];
        return edges.map((e: { node: Record<string, unknown> }) => ({
          phId: String(e.node.id),
          name: String(e.node.name || 'Untitled'),
          tagline: String(e.node.tagline || ''),
          url: String(e.node.url || ''),
          votesCount: Number(e.node.votesCount) || 0,
          featuredAt: e.node.createdAt ? String(e.node.createdAt) : null,
        }));
      }
    } catch (e) {
      console.warn('[product-hunt] API failed', e);
    }
  }

  // Public Atom-ish scrape via unofficial endpoint often blocked — return demos tagged clearly
  return FALLBACK_LAUNCHES.slice(0, limit).map((l) => ({
    ...l,
    tagline: `${l.tagline} (demo ingest — set PRODUCTHUNT_API_TOKEN for live data)`,
  }));
}
