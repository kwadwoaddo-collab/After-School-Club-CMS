import type { Header } from 'next/dist/lib/load-custom-routes';

export function buildCsp(frameAncestors: string): string {
  return [
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
  ].join('; ');
}

export function buildSecurityHeaders(rawAllowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS): Header[] {
  const allowedFrameAncestors = rawAllowedFrameAncestors
    ? rawAllowedFrameAncestors
        .split(',')
        .map((domain) => domain.trim())
        .filter(Boolean)
        .join(' ')
    : '';

  const embedAncestors = allowedFrameAncestors ? `'self' ${allowedFrameAncestors}` : "'self'";
  const embedHeaders = [
    ...(allowedFrameAncestors
      ? []
      : [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]),
    {
      key: 'Content-Security-Policy',
      value: buildCsp(embedAncestors),
    },
  ];

  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
        },
        {
          key: 'Content-Security-Policy',
          value: buildCsp("'none'"),
        },
      ],
    },
    {
      // Deny framing everywhere EXCEPT booking embed surfaces (/book/*, /b/*, /centre-portal/:subdomain/book*).
      // Next.js merges non-conflicting header keys across matching rules, so applying DENY on /:path*
      // would cause embed routes to inherit X-Frame-Options: DENY when ALLOWED_FRAME_ANCESTORS is set.
      source: '/:path((?!book(?:/|$)|b(?:/|$)|centre-portal/[^/]+/book(?:/|$)).*)',
      headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
    },
    {
      source: '/book/:path*',
      headers: embedHeaders,
    },
    {
      source: '/b/:path*',
      headers: embedHeaders,
    },
    {
      source: '/centre-portal/:subdomain/book',
      headers: embedHeaders,
    },
    {
      source: '/centre-portal/:subdomain/book/:path*',
      headers: embedHeaders,
    },
    {
      source: '/portal/verify',
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    },
    {
      source: '/accept-invite',
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    },
    {
      source: '/register/:path*',
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    },
  ];
}
