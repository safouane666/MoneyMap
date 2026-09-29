import type { NextConfig } from 'next';

/** Standalone is for Linux/Docker VPS. On Windows, symlinks in the standalone
 *  copy often fail with EPERM — keep a normal Next build for local smoke. */
const useStandalone =
  process.env.CM_STANDALONE === '1' ||
  process.platform !== 'win32' ||
  process.env.CI === 'true';

const nextConfig: NextConfig = {
  ...(useStandalone ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@clear-money/domain'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
