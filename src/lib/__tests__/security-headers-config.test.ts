import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { buildSecurityHeaders } from '@/lib/security-headers';

const require = createRequire(import.meta.url);
const loadCustomRoutes = require('next/dist/lib/load-custom-routes.js').default;
const { tryToParsePath } = require('next/dist/lib/try-to-parse-path.js');

async function resolveHeadersForPath(pathname: string, allowedFrameAncestors?: string) {
    const routes = buildSecurityHeaders(allowedFrameAncestors);
    const loaded = await loadCustomRoutes({ headers: async () => routes });
    const merged: Record<string, string> = {};

    for (const rule of loaded.headers) {
        const parsed = tryToParsePath(rule.source);
        expect(parsed.error).toBeUndefined();
        const regex = new RegExp(parsed.regexStr);
        if (regex.test(pathname)) {
            for (const kv of rule.headers) {
                merged[kv.key] = kv.value;
            }
        }
    }

    return merged;
}

describe('Global Security Headers & Iframe Embed Preservation (SEC-F-04)', () => {
    it('applies nosniff, Permissions-Policy, strict-origin-when-cross-origin, X-Frame-Options: DENY, and frame-ancestors none on standard app & dashboard routes', async () => {
        for (const route of ['/', '/login', '/dashboard', '/dashboard/bookings', '/booking', '/centre-portal/oakridge/portal']) {
            const headers = await resolveHeadersForPath(route);
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
            expect(headers['X-Frame-Options']).toBe('DENY');
            expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
            expect(headers['Permissions-Policy']).toContain('camera=()');
            expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
            expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
            expect(headers['Content-Security-Policy']).toContain("base-uri 'self'");
        }
    });

    it('preserves SAMEORIGIN framing on /book/*, /b/*, and /centre-portal/:subdomain/book* when ALLOWED_FRAME_ANCESTORS is unset', async () => {
        for (const embedRoute of [
            '/book/oakridge',
            '/book/oakridge/main-hall',
            '/b/oakridge',
            '/b/oakridge/main-hall',
            '/centre-portal/oakridge/book',
            '/centre-portal/oakridge/book/main-hall',
        ]) {
            const headers = await resolveHeadersForPath(embedRoute, '');
            expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
            expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'self'");
            expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
        }
    });

    it('does NOT inherit X-Frame-Options: DENY on embed routes when ALLOWED_FRAME_ANCESTORS lists external club domains', async () => {
        for (const embedRoute of [
            '/book/oakridge',
            '/book/oakridge/main-hall',
            '/b/oakridge',
            '/centre-portal/oakridge/book',
        ]) {
            const headers = await resolveHeadersForPath(
                embedRoute,
                'https://oakridgeclub.co.uk, https://www.oakridgeclub.co.uk'
            );
            expect(headers['X-Frame-Options']).toBeUndefined();
            expect(headers['Content-Security-Policy']).toContain(
                "frame-ancestors 'self' https://oakridgeclub.co.uk https://www.oakridgeclub.co.uk"
            );
            expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
        }
    });

    it('applies Referrer-Policy: no-referrer on token-bearing verification, invite, and registration routes', async () => {
        for (const tokenRoute of ['/portal/verify', '/accept-invite', '/register/oakridge', '/register/oakridge/main']) {
            const headers = await resolveHeadersForPath(tokenRoute);
            expect(headers['Referrer-Policy']).toBe('no-referrer');
            expect(headers['X-Frame-Options']).toBe('DENY');
        }
    });
});
