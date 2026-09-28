import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@clear-money/domain'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
