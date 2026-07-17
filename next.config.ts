import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required so PostHog capture endpoints that use trailing slashes (e.g. /e/) work.
  skipTrailingSlashRedirect: true,
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
};

export default nextConfig;
