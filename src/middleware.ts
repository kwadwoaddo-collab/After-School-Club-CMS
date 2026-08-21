import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Subdomains that belong to the platform itself — never treated as org/centre subdomains
const RESERVED_SUBDOMAINS = new Set([
    'app', 'www', 'api', 'mail', 'admin', 'dashboard',
    'dev', 'staging', 'preview', 'localhost',
]);

// The only apex domain centre subdomains are ever issued under
// (<centre>.sprintscaleit.co.uk). A host is only eligible to be read as
// <subdomain>.<apex> when everything after its first label matches this
// exactly — see the baseDomain check below for why this is needed.
const APEX_DOMAIN = 'sprintscaleit.co.uk';

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
    const host = hostname.split(':')[0].toLowerCase(); // strip port for local dev, normalise case
    const parts = host.split('.');

    // Need at least 3 parts: subdomain.domain.tld
    if (parts.length < 3) {
        return NextResponse.next();
    }

    const subdomain = parts[0];

    // Only treat this as <subdomain>.sprintscaleit.co.uk when the rest of the
    // host actually IS sprintscaleit.co.uk. Without this, any host with 3+
    // dot-separated labels satisfies the length check above and has its first
    // label misread as a centre subdomain — most importantly, Vercel's own
    // preview/deployment hostnames (e.g. <project>-<hash>-<team>.vercel.app,
    // baseDomain "vercel.app") were being rewritten to /centre-portal/<project-hash-team>,
    // which 404s since no such centre exists. This check excludes every
    // *.vercel.app host (current and future — nothing here is tied to any
    // specific deployment hash) without needing to special-case vercel.app by
    // name, and without affecting real centre subdomains or the main app host
    // (app.sprintscaleit.co.uk, handled below via RESERVED_SUBDOMAINS).
    const baseDomain = parts.slice(1).join('.');
    if (baseDomain !== APEX_DOMAIN) {
        return NextResponse.next();
    }

    // Skip reserved and numeric subdomains
    if (RESERVED_SUBDOMAINS.has(subdomain) || /^\d+$/.test(subdomain)) {
        return NextResponse.next();
    }

    const { pathname } = request.nextUrl;

    // Already a rewritten centre-portal path — do NOT rewrite again (prevents loop)
    if (pathname.startsWith('/centre-portal/')) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-subdomain', subdomain);
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

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

