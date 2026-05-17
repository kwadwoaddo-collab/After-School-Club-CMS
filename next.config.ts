import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
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
            value: "frame-ancestors 'self'", // Restrict to same origin — add specific domains if needed
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
            value: "frame-ancestors 'self'",
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
