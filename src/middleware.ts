import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Subdomains that belong to the platform itself — never treated as org/centre subdomains
const RESERVED_SUBDOMAINS = new Set([
    'app', 'www', 'api', 'mail', 'admin', 'dashboard',
    'dev', 'staging', 'preview', 'localhost',
]);

// Routes that should always pass through to the normal Next.js app unchanged
// even when accessed on a centre subdomain (e.g. dagenham.sprintscaleit.co.uk/dashboard)
const PASSTHROUGH_PREFIXES = [
    '/dashboard',
    '/login',
    '/signup',
    '/staff-login',
    '/onboarding',
    '/api',
    '/_next',
    '/favicon',
];

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || '';
    const host = hostname.split(':')[0]; // strip port for local dev
    const parts = host.split('.');

    // Need at least 3 parts: subdomain.domain.tld
    if (parts.length < 3) {
        return NextResponse.next();
    }

    const subdomain = parts[0];

    // Skip reserved and numeric subdomains
    if (RESERVED_SUBDOMAINS.has(subdomain) || /^\d+$/.test(subdomain)) {
        return NextResponse.next();
    }

    const { pathname } = request.nextUrl;

    // Always pass through internal/auth/dashboard routes unchanged
    if (PASSTHROUGH_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-subdomain', subdomain);
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // ── Public centre portal rewrites ──────────────────────────────
    // Rewrite the URL internally so Next.js serves the centre-portal pages,
    // while the browser URL stays clean (e.g. dagenham.sprintscaleit.co.uk/book)
    const url = request.nextUrl.clone();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-subdomain', subdomain);

    if (pathname === '/' || pathname === '') {
        url.pathname = `/centre-portal/${subdomain}`;
    } else if (pathname === '/book' || pathname.startsWith('/book/')) {
        url.pathname = `/centre-portal/${subdomain}/book`;
    } else if (pathname === '/register' || pathname.startsWith('/register/')) {
        url.pathname = `/centre-portal/${subdomain}/register`;
    } else {
        // Any other path — just pass through with x-subdomain header
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
    ],
};

