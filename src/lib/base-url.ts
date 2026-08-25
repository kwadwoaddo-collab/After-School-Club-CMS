/**
 * Canonical Base URL Helper
 *
 * Resolves the public application base URL across environments in order:
 * 1. NEXT_PUBLIC_BASE_URL (explicit canonical production domain)
 * 2. NEXTAUTH_URL (configured NextAuth host)
 * 3. VERCEL_URL (auto-injected by Vercel on all deployments)
 * 4. http://localhost:3000 (local development fallback)
 */
export function getBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
    }
    if (process.env.NEXTAUTH_URL) {
        return process.env.NEXTAUTH_URL.replace(/\/+$/, '');
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
    }
    return 'http://localhost:3000';
}
