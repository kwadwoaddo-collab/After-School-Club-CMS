import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS
      ? process.env.ALLOWED_FRAME_ANCESTORS.split(',').map(domain => domain.trim()).join(' ')
      : '';
    const cspFrameAncestors = `frame-ancestors 'self' ${allowedFrameAncestors}`.trim();

    return [
      {
        // Allow booking pages to be embedded in iframes
        source: '/book/:orgSlug/:centreSlug',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: cspFrameAncestors,
          },
        ],
      },
      {
        // Allow org-level booking pages to be embedded
        source: '/book/:orgSlug',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: cspFrameAncestors,
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/r/:slug*',
        destination: '/register/:slug*',
      },
      {
        source: '/b/:slug*',
        destination: '/book/:slug*',
      },
    ];
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
