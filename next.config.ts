import type { NextConfig } from 'next';

const MARKETPOUNCE = 'https://www.marketpounce.com';

/** Brand-hire / growth-desk paths consolidate permanently to MarketPounce. */
const MP_PATH_REDIRECTS: { source: string; destination: string }[] = [
  { source: '/alternatives', destination: `${MARKETPOUNCE}/alternatives` },
  { source: '/alternatives/:path*', destination: `${MARKETPOUNCE}/alternatives/:path*` },
  { source: '/for', destination: `${MARKETPOUNCE}/for` },
  { source: '/for/brands', destination: `${MARKETPOUNCE}/for/brands` },
  { source: '/for/founders', destination: `${MARKETPOUNCE}/for/founders` },
  { source: '/for/cmos', destination: `${MARKETPOUNCE}/for/cmos` },
  { source: '/for/trades', destination: `${MARKETPOUNCE}/for/trades` },
  { source: '/for/agencies', destination: `${MARKETPOUNCE}/for/agencies` },
  { source: '/for/professional', destination: `${MARKETPOUNCE}/for/professional` },
  {
    source: '/guides/hire-cold-callers',
    destination: `${MARKETPOUNCE}/guides/hire-cold-callers`,
  },
  {
    source: '/guides/hire-outbound-without-in-house-sdr',
    destination: `${MARKETPOUNCE}/guides/hire-outbound-without-in-house-sdr`,
  },
  {
    source: '/guides/cold-call-reps-vs-outbound-agency',
    destination: `${MARKETPOUNCE}/guides/cold-call-reps-vs-outbound-agency`,
  },
  {
    source: '/guides/appointment-setting-marketplace',
    destination: `${MARKETPOUNCE}/guides/appointment-setting-marketplace`,
  },
  {
    source: '/guides/pay-per-appointment-setting',
    destination: `${MARKETPOUNCE}/guides/pay-per-appointment-setting`,
  },
  {
    source: '/guides/campaign-escrow-and-claims',
    destination: `${MARKETPOUNCE}/guides/campaign-escrow-and-claims`,
  },
  {
    source: '/guides/platform-fees-and-payouts',
    destination: `${MARKETPOUNCE}/guides/platform-fees-and-payouts`,
  },
  {
    source: '/guides/how-campaigns-work',
    destination: `${MARKETPOUNCE}/guides/how-campaigns-work`,
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required so PostHog capture endpoints that use trailing slashes (e.g. /e/) work.
  skipTrailingSlashRedirect: true,
  async redirects() {
    // Auth lives on MarketPounce (Clerk app name: MarketPounce) — never host login/signup here.
    return [
      {
        source: '/sign-in',
        destination: `${MARKETPOUNCE}/sign-in?from=ccr`,
        permanent: true,
      },
      {
        source: '/sign-in/:path*',
        destination: `${MARKETPOUNCE}/sign-in?from=ccr`,
        permanent: true,
      },
      {
        source: '/sign-up',
        destination: `${MARKETPOUNCE}/sign-up?role=REP&from=ccr`,
        permanent: true,
      },
      {
        source: '/sign-up/:path*',
        destination: `${MARKETPOUNCE}/sign-up?role=REP&from=ccr`,
        permanent: true,
      },
      {
        source: '/login',
        destination: `${MARKETPOUNCE}/sign-in?from=ccr`,
        permanent: true,
      },
      {
        source: '/signup',
        destination: `${MARKETPOUNCE}/sign-up?role=REP&from=ccr`,
        permanent: true,
      },
      ...MP_PATH_REDIRECTS.map((r) => ({ ...r, permanent: true as const })),
    ];
  },
  async rewrites() {
    return [
      {
        source: '/ccr-ph/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ccr-ph/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ccr-ph/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  // Local .pnpm-store can exhaust macOS file watchers (EMFILE → every route 404s).
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/.pnpm-store/**',
          '**/qa/**',
        ],
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/auth.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/.well-known/api-catalog',
        headers: [
          { key: 'Content-Type', value: 'application/linkset+json; charset=utf-8' },
        ],
      },
      {
        source: '/.well-known/agent-skills/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ];
  },
};

export default nextConfig;
