import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // UILensAI worker must load via Node createRequire — do not bundle.
  serverExternalPackages: ['@optimald/uilensai'],
};

export default nextConfig;
