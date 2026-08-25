/**
 * Milestone 4A — Production Readiness & Configuration Regression Tests
 *
 * Covers:
 *   CONFIG-GC-1: GoCardless fails closed in production when unconfigured (no fake success stubs)
 *   URL-1:       Canonical base URL derivation across environments
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBaseUrl } from './base-url';
import { GoCardlessService } from './services/gocardless';

describe('Milestone 4A — Production Configuration Regression Tests', () => {
    describe('CONFIG-GC-1: GoCardless fail-closed in production', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
            delete process.env.GOCARDLESS_ACCESS_TOKEN;
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('throws in production when createCustomer is called without GOCARDLESS_ACCESS_TOKEN', async () => {
            (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
            const service = new GoCardlessService();

            await expect(service.createCustomer({
                email: 'parent@example.com',
                givenName: 'Jane',
                familyName: 'Doe',
                organisationId: 'org-123',
            })).rejects.toThrow(/GoCardless is not configured in production/);
        });

        it('throws in production when createMandateCheckout is called without GOCARDLESS_ACCESS_TOKEN', async () => {
            (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
            const service = new GoCardlessService();

            await expect(service.createMandateCheckout(
                'CU12345678',
                'https://example.com/success',
                'https://example.com/cancel'
            )).rejects.toThrow(/GoCardless is not configured in production/);
        });

        it('throws in production when createPayment is called without GOCARDLESS_ACCESS_TOKEN', async () => {
            (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
            const service = new GoCardlessService();

            await expect(service.createPayment({
                amountPence: 5000,
                currency: 'GBP',
                mandateId: 'MD12345678',
                description: 'Invoice payment',
            })).rejects.toThrow(/GoCardless is not configured in production/);
        });

        it('allows stub mode in development/test environment (NODE_ENV !== production)', async () => {
            (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
            const service = new GoCardlessService();

            const customerId = await service.createCustomer({
                email: 'parent@example.com',
                givenName: 'Jane',
                familyName: 'Doe',
                organisationId: 'org-123',
            });
            expect(customerId).toMatch(/^CU[0-9A-Z]{8}$/);
        });
    });

    describe('URL-1: Canonical Base URL derivation', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
            delete process.env.NEXT_PUBLIC_BASE_URL;
            delete process.env.NEXTAUTH_URL;
            delete process.env.VERCEL_URL;
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('prioritizes NEXT_PUBLIC_BASE_URL when provided', () => {
            process.env.NEXT_PUBLIC_BASE_URL = 'https://app.afterschoolclub.co.uk/';
            process.env.NEXTAUTH_URL = 'https://other-domain.com';
            process.env.VERCEL_URL = 'preview.vercel.app';

            expect(getBaseUrl()).toBe('https://app.afterschoolclub.co.uk');
        });

        it('falls back to NEXTAUTH_URL if NEXT_PUBLIC_BASE_URL is missing', () => {
            process.env.NEXTAUTH_URL = 'https://auth.afterschoolclub.co.uk/';
            expect(getBaseUrl()).toBe('https://auth.afterschoolclub.co.uk');
        });

        it('falls back to VERCEL_URL if NEXT_PUBLIC_BASE_URL and NEXTAUTH_URL are missing', () => {
            process.env.VERCEL_URL = 'cms-preview-123.vercel.app';
            expect(getBaseUrl()).toBe('https://cms-preview-123.vercel.app');
        });

        it('falls back to localhost:3000 if no environment variable is present', () => {
            expect(getBaseUrl()).toBe('http://localhost:3000');
        });
    });
});
