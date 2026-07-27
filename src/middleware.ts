import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// These subdomains are part of the platform itself, not org-specific
const RESERVED_SUBDOMAINS = new Set([
    'app', 'www', 'api', 'mail', 'admin', 'dashboard',
    'dev', 'staging', 'preview', 'localhost',
]);

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || '';

    // Strip port for local dev (e.g. "localhost:3000")
    const host = hostname.split(':')[0];
    const parts = host.split('.');

    // We need at least subdomain.domain.tld (3 parts) — skip root and app domains
    if (parts.length < 3) {
        return NextResponse.next();
    }

    const subdomain = parts[0];

    // Skip reserved subdomains and purely numeric subdomains
    if (RESERVED_SUBDOMAINS.has(subdomain) || /^\d+$/.test(subdomain)) {
        return NextResponse.next();
    }

    // Pass the org/centre subdomain as a header so Server Components can read it
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-subdomain', subdomain);

    return NextResponse.next({
        request: { headers: requestHeaders },
    });
}

export const config = {
    matcher: [
        // Run on all routes except Next.js internals and static files
        '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
    ],
};
