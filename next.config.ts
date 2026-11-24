import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  experimental: {
    // Allow a 3 MB centre PDF plus multipart metadata; file validation stays stricter.
    serverActions: { bodySizeLimit: '4mb' },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return buildSecurityHeaders();
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
      {
        source: '/manifest.json',
        destination: '/manifest.webmanifest',
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: {
    disable: true,
  },
});
