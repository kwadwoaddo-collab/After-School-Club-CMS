import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBaseUrl, getTrustedApplicationUrl } from '@/lib/base-url';

const URL_ENV_KEYS = [
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_BASE_URL',
    'NEXTAUTH_URL',
    'AUTH_URL',
    'VERCEL_ENV',
    'VERCEL_BRANCH_URL',
    'VERCEL_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
] as const;

describe('getTrustedApplicationUrl (preview-safe canonical URL resolution)', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        for (const key of URL_ENV_KEYS) {
            delete process.env[key];
        }
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('prioritizes valid NEXT_PUBLIC_APP_URL over all Vercel environment variables', () => {
        process.env.NEXT_PUBLIC_APP_URL = 'https://custom-preview.sprintscaleit.co.uk/';
        process.env.VERCEL_ENV = 'preview';
        process.env.VERCEL_BRANCH_URL = 'sprintscale-git-feat.vercel.app';
        process.env.VERCEL_URL = 'sprintscale-abc123.vercel.app';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.sprintscaleit.co.uk';

        expect(getTrustedApplicationUrl()).toBe('https://custom-preview.sprintscaleit.co.uk');
        expect(getBaseUrl()).toBe('https://custom-preview.sprintscaleit.co.uk');
    });

    it('ignores invalid NEXT_PUBLIC_APP_URL and falls back to preview URL when VERCEL_ENV=preview', () => {
        process.env.NEXT_PUBLIC_APP_URL = 'not-a-valid-url';
        process.env.VERCEL_ENV = 'preview';
        process.env.VERCEL_URL = 'sprintscale-preview-abc123.vercel.app';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.sprintscaleit.co.uk';

        expect(getTrustedApplicationUrl()).toBe('https://sprintscale-preview-abc123.vercel.app');
    });

    it('prefers VERCEL_BRANCH_URL then VERCEL_URL before VERCEL_PROJECT_PRODUCTION_URL when VERCEL_ENV=preview', () => {
        process.env.VERCEL_ENV = 'preview';
        process.env.VERCEL_BRANCH_URL = 'sprintscale-git-wave1.vercel.app';
        process.env.VERCEL_URL = 'sprintscale-deploy-hash.vercel.app';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.sprintscaleit.co.uk';

        expect(getTrustedApplicationUrl()).toBe('https://sprintscale-git-wave1.vercel.app');

        delete process.env.VERCEL_BRANCH_URL;
        expect(getTrustedApplicationUrl()).toBe('https://sprintscale-deploy-hash.vercel.app');
    });

    it('prefers VERCEL_BRANCH_URL / VERCEL_URL before VERCEL_PROJECT_PRODUCTION_URL when VERCEL_ENV=development', () => {
        process.env.VERCEL_ENV = 'development';
        process.env.VERCEL_URL = 'sprintscale-dev-local.vercel.app';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.sprintscaleit.co.uk';

        expect(getTrustedApplicationUrl()).toBe('https://sprintscale-dev-local.vercel.app');
    });

    it('uses VERCEL_PROJECT_PRODUCTION_URL before VERCEL_URL when VERCEL_ENV=production', () => {
        process.env.VERCEL_ENV = 'production';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.sprintscaleit.co.uk';
        process.env.VERCEL_BRANCH_URL = 'sprintscale-git-main.vercel.app';
        process.env.VERCEL_URL = 'sprintscale-prod-hash.vercel.app';

        expect(getTrustedApplicationUrl()).toBe('https://app.sprintscaleit.co.uk');
    });

    it('falls back to canonical production URL in production and localhost in local dev/test when all URL vars are unset', () => {
        process.env.VERCEL_ENV = 'production';
        expect(getTrustedApplicationUrl()).toBe('https://app.sprintscaleit.co.uk');

        delete process.env.VERCEL_ENV;
        (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
        expect(getTrustedApplicationUrl()).toBe('http://localhost:3000');
    });
});
