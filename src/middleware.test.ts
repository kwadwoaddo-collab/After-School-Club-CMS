import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

// Regression coverage for the hostname/subdomain detection in middleware.ts.
//
// Root cause under test: the middleware used to decide "is this a centre
// subdomain?" purely from host.split('.').length >= 3 plus a reserved-word
// check on the first label — it never checked that the rest of the host was
// actually sprintscaleit.co.uk. Any host with 3+ dot-separated labels,
// including Vercel's own preview/deployment hostnames
// (<project>-<hash>-<team>.vercel.app), satisfied that check and had its
// first label misread as a centre subdomain, rewriting GET / to
// /centre-portal/<project-hash-team> — which 404s.

function makeRequest(host: string, pathname = '/') {
    return new NextRequest(`http://${host}${pathname}`, {
        headers: { host },
    });
}

/** True if the response is a plain pass-through (no rewrite occurred). */
function isPassthrough(response: Response) {
    return response.headers.get('x-middleware-next') === '1'
        && response.headers.get('x-middleware-rewrite') === null;
}

/** The rewritten pathname, or null if no rewrite occurred. */
function rewrittenPathname(response: Response) {
    const rewriteUrl = response.headers.get('x-middleware-rewrite');
    return rewriteUrl ? new URL(rewriteUrl).pathname : null;
}

describe('middleware hostname/subdomain detection', () => {
    it('does not rewrite the main application host (app.sprintscaleit.co.uk)', () => {
        const response = middleware(makeRequest('app.sprintscaleit.co.uk'));
        expect(isPassthrough(response)).toBe(true);
        expect(rewrittenPathname(response)).toBeNull();
    });

    it('rewrites a legitimate centre subdomain to /centre-portal/<centre>', () => {
        const response = middleware(makeRequest('dagenham.sprintscaleit.co.uk'));
        expect(rewrittenPathname(response)).toBe('/centre-portal/dagenham');
        // x-subdomain is forwarded on the downstream request, not the response
        // itself — Next.js surfaces that as x-middleware-request-<header>.
        expect(response.headers.get('x-middleware-request-x-subdomain')).toBe('dagenham');
    });

    it('rewrites a legitimate centre subdomain /book path to /centre-portal/<centre>/book', () => {
        const response = middleware(makeRequest('dagenham.sprintscaleit.co.uk', '/book'));
        expect(rewrittenPathname(response)).toBe('/centre-portal/dagenham/book');
    });

    it('does NOT rewrite a Vercel preview/deployment hostname (regression for the 404 bug)', () => {
        const response = middleware(
            makeRequest('after-school-club-live-lyi1gz7b7-kwadwo-addos-projects.vercel.app')
        );
        expect(isPassthrough(response)).toBe(true);
        expect(rewrittenPathname(response)).toBeNull();
    });

    it('does not rewrite an arbitrary future Vercel-generated deployment hostname', () => {
        // A different project name / hash / team than any hardcoded example —
        // proves the fix is a general *.vercel.app rule, not a one-off allowlist.
        const response = middleware(
            makeRequest('some-other-app-9x7k2p-a-different-team.vercel.app')
        );
        expect(isPassthrough(response)).toBe(true);
        expect(rewrittenPathname(response)).toBeNull();
    });

    it('does not rewrite localhost/dev requests', () => {
        const response = middleware(makeRequest('localhost:3000'));
        expect(isPassthrough(response)).toBe(true);
        expect(rewrittenPathname(response)).toBeNull();
    });

    it('still passes dashboard routes through unchanged on a centre subdomain', () => {
        const response = middleware(makeRequest('dagenham.sprintscaleit.co.uk', '/dashboard'));
        expect(isPassthrough(response)).toBe(true);
        expect(rewrittenPathname(response)).toBeNull();
    });
});
