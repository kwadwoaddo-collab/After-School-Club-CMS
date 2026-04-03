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
            value: 'ALLOWALL', // Allow embedding on any domain
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *", // Allow all domains to embed
          },
        ],
      },
      {
        // Allow org-level booking pages to be embedded
        source: '/book/:orgSlug',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *",
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
