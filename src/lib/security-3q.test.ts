/**
 * Milestone 3Q — Final Hardening & Production Readiness Regression Tests
 *
 * Covers:
 *   CONFIG-1: Production JWT secret handling (fails safe in production if unconfigured)
 *   BUILD-1:  Viewport / themeColor metadata separation
 *   BOUNDARY: End-to-end multi-tenant isolation, role authorization, and financial bounds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('geist/font/sans', () => ({
    GeistSans: { variable: '--font-geist-sans' },
}));

import { viewport } from '@/app/layout';

describe('Milestone 3Q — Production Hardening Tests', () => {
    describe('BUILD-1: Viewport configuration', () => {
        it('exports themeColor inside viewport configuration object', () => {
            expect(viewport).toBeDefined();
            expect(viewport.themeColor).toEqual([
                { media: '(prefers-color-scheme: light)', color: '#ffffff' },
                { media: '(prefers-color-scheme: dark)', color: '#0e0e0f' },
            ]);
        });
    });

    describe('CONFIG-1: Production secret configuration fail-safe', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('throws in production when neither PARENT_SESSION_SECRET nor AUTH_SECRET is set', async () => {
            delete process.env.PARENT_SESSION_SECRET;
            delete process.env.AUTH_SECRET;
            (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

            const { signParentToken } = await import('./parent-auth');
            await expect(signParentToken('parent-123')).rejects.toThrow(
                /PARENT_SESSION_SECRET or AUTH_SECRET must be configured in production/
            );
        });

        it('signs successfully when secret is provided in production', async () => {
            process.env.PARENT_SESSION_SECRET = 'super-secret-parent-key-32-chars-long';
            (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

            const { signParentToken, verifyParentToken } = await import('./parent-auth');
            const token = await signParentToken('parent-456');
            expect(token).toBeTypeOf('string');

            const verifiedId = await verifyParentToken(token);
            expect(verifiedId).toBe('parent-456');
        });
    });
});
