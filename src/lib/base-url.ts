function normalizeExplicitUrl(raw?: string | null): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return trimmed.replace(/\/+$/, '');
    } catch {
        return null;
    }
}

function normalizeVercelHost(raw?: string | null): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return normalizeExplicitUrl(candidate);
}

/**
 * Canonical Trusted Application URL Helper
 *
 * Resolves the trusted application origin in strict priority:
 * 1. NEXT_PUBLIC_APP_URL (explicit application canonical URL — always wins when valid)
 * 2. NEXT_PUBLIC_BASE_URL / NEXTAUTH_URL / AUTH_URL (explicitly configured canonical hosts)
 * 3. Vercel deployment URLs (preview-safe):
 *    - When VERCEL_ENV is 'preview' or 'development': VERCEL_BRANCH_URL -> VERCEL_URL -> VERCEL_PROJECT_PRODUCTION_URL
 *    - Otherwise (production): VERCEL_PROJECT_PRODUCTION_URL -> VERCEL_URL -> VERCEL_BRANCH_URL
 * 4. Environment fail-safes:
 *    - Production: 'https://app.sprintscaleit.co.uk'
 *    - Non-production (local dev / test): 'http://localhost:3000'
 */
export function getTrustedApplicationUrl(): string {
    const explicitUrl =
        normalizeExplicitUrl(process.env.NEXT_PUBLIC_APP_URL) ||
        normalizeExplicitUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
        normalizeExplicitUrl(process.env.NEXTAUTH_URL) ||
        normalizeExplicitUrl(process.env.AUTH_URL);

    if (explicitUrl) {
        return explicitUrl;
    }

    const vercelEnv = process.env.VERCEL_ENV;
    const isVercelNonProd = vercelEnv === 'preview' || vercelEnv === 'development';

    const vercelUrl = isVercelNonProd
        ? normalizeVercelHost(process.env.VERCEL_BRANCH_URL) ||
          normalizeVercelHost(process.env.VERCEL_URL) ||
          normalizeVercelHost(process.env.VERCEL_PROJECT_PRODUCTION_URL)
        : normalizeVercelHost(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
          normalizeVercelHost(process.env.VERCEL_URL) ||
          normalizeVercelHost(process.env.VERCEL_BRANCH_URL);

    if (vercelUrl) {
        return vercelUrl;
    }

    if (vercelEnv === 'development') {
        return 'http://localhost:3000';
    }

    if (vercelEnv === 'production' || process.env.NODE_ENV === 'production') {
        return 'https://app.sprintscaleit.co.uk';
    }

    return 'http://localhost:3000';
}

export function getBaseUrl(): string {
    return getTrustedApplicationUrl();
}
