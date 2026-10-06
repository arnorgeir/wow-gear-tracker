import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Next cuts the proxy's copy of a body at this cap without an error. Keeping it above the
    // proxy's 1 MB limit means an oversized body still shows the proxy more than 1 MB.
    proxyClientMaxBodySize: '2mb',
  },
};

export default nextConfig;
