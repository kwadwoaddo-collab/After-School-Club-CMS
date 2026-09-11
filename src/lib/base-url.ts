/**
 * Canonical Trusted Application URL Helper
 *
 * Resolves the trusted application origin in strict priority:
 * 1. NEXT_PUBLIC_APP_URL (explicit application canonical URL)
 * 2. NEXT_PUBLIC_BASE_URL (canonical production domain)
 * 3. NEXTAUTH_URL (configured NextAuth host)
 * 4. AUTH_URL (Auth.js canonical host)
 * 5. VERCEL_PROJECT_PRODUCTION_URL (auto-injected production domain)
 * 6. VERCEL_URL (auto-injected deployment preview domain)
 *
 * Production Fail-Safe:
 * If NODE_ENV === 'production' and none of the above are set, fallback to the canonical domain:
 * 'https://app.sprintscaleit.co.uk'
 *
 * Development/Test Fallback:
 * If NODE_ENV !== 'production', fallback to 'http://localhost:3000'
 */
export function getTrustedApplicationUrl(): string {
    const raw =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXTAUTH_URL ||
        process.env.AUTH_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

    if (raw) {
        return raw.replace(/\/+$/, '');
    }

    if (process.env.NODE_ENV === 'production') {
        return 'https://app.sprintscaleit.co.uk';
    }

    return 'http://localhost:3000';
}

export function getBaseUrl(): string {
    return getTrustedApplicationUrl();
}
