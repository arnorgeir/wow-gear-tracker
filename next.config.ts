import type { NextConfig } from 'next';
import { FRAME_HEADERS } from './src/server/frame-headers';

const nextConfig: NextConfig = {
  experimental: {
    // Next cuts the proxy's copy of a body at this cap without an error. Keeping it above the
    // proxy's 1 MB limit means an oversized body still shows the proxy more than 1 MB.
    proxyClientMaxBodySize: '2mb',
  },
  headers: async () => [{ source: '/:path*', headers: FRAME_HEADERS }],
};

export default nextConfig;
