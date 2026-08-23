import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoCardlessService } from './gocardless';

// GOCARDLESS_ACCESS_TOKEN is read into a module-level const at import time,
// so the "configured" branch below must reset the module registry and
// re-import after setting the env var — mutating process.env alone has no
// effect on an already-imported instance of this module.

/**
 * Milestone 3G, L3 regression coverage.
 *
 * Root cause (see project-notes/milestone-3g-finance-audit.md, L3): every
 * template literal in this file used an escaped `\${...}` instead of real
 * `${...}` interpolation. In the stub branch (no GOCARDLESS_ACCESS_TOKEN
 * configured — the only branch exercised in this test environment) this
 * meant every "random" stub id was actually the same fixed literal string
 * every time, breaking the uniqueness this code exists to provide. In the
 * real-API branch it meant the fetch URL and Authorization header were sent
 * as literal, non-interpolated text, guaranteeing every real API call would
 * fail. GoCardlessService is not currently reachable from any production
 * code path (see the audit's section F), so this suite exists to lock the
 * fix in place before the service is ever wired up.
 */

describe('GoCardlessService (unconfigured/stub mode)', () => {
    let service: GoCardlessService;
    const originalToken = process.env.GOCARDLESS_ACCESS_TOKEN;

    beforeEach(() => {
        delete process.env.GOCARDLESS_ACCESS_TOKEN;
        service = new GoCardlessService();
    });

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.GOCARDLESS_ACCESS_TOKEN;
        } else {
            process.env.GOCARDLESS_ACCESS_TOKEN = originalToken;
        }
    });

    it('createCustomer returns a real interpolated stub id, not the literal template string', async () => {
        const id = await service.createCustomer({
            email: 'parent@example.com',
            givenName: 'Jane',
            familyName: 'Doe',
            organisationId: 'org-1',
        });

        expect(id).toMatch(/^CU[A-Z0-9]{8}$/);
        expect(id).not.toContain('${');
        expect(id).not.toContain('\\');
    });

    it('createCustomer generates a different id on each call (uniqueness was broken by the escape bug)', async () => {
        const id1 = await service.createCustomer({ email: 'a@example.com', givenName: 'A', familyName: 'One', organisationId: 'org-1' });
        const id2 = await service.createCustomer({ email: 'b@example.com', givenName: 'B', familyName: 'Two', organisationId: 'org-1' });

        expect(id1).not.toBe(id2);
    });

    it('createMandateCheckout returns a real interpolated stub id and session URL', async () => {
        const result = await service.createMandateCheckout('CU12345678', 'https://example.com/success', 'https://example.com/cancel');

        expect(result.id).toMatch(/^BR[A-Z0-9]{8}$/);
        expect(result.id).not.toContain('${');
        expect(result.sessionUrl).toBe(`https://example.com/success?billing_request=${result.id}`);
        expect(result.sessionUrl).not.toContain('${');
    });

    it('createPayment returns a real interpolated stub id', async () => {
        const result = await service.createPayment({
            amountPence: 5000,
            currency: 'GBP',
            mandateId: 'MD12345678',
            description: 'Monthly fee',
        });

        expect(result.id).toMatch(/^PM[A-Z0-9]{8}$/);
        expect(result.id).not.toContain('${');
        expect(result.status).toBe('pending_submission');
    });
});

describe('GoCardlessService (configured — real-API branch URL/header construction)', () => {
    const originalToken = process.env.GOCARDLESS_ACCESS_TOKEN;
    const originalFetch = global.fetch;

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.GOCARDLESS_ACCESS_TOKEN;
        } else {
            process.env.GOCARDLESS_ACCESS_TOKEN = originalToken;
        }
        global.fetch = originalFetch;
        vi.resetModules();
    });

    it('builds a real fetch URL and Authorization header, not literal template text', async () => {
        process.env.GOCARDLESS_ACCESS_TOKEN = 'test-token-123';
        vi.resetModules();
        const { GoCardlessService: FreshGoCardlessService } = await import('./gocardless');
        const service = new FreshGoCardlessService();

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ customers: { id: 'CU_REAL_1', created_at: '', email: '', given_name: '', family_name: '' } }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await service.createCustomer({ email: 'parent@example.com', givenName: 'Jane', familyName: 'Doe', organisationId: 'org-1' });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).not.toContain('${');
        expect(url).toMatch(/^https:\/\/api-sandbox\.gocardless\.com\/customers$/);
        const headers = options.headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer test-token-123');
        expect(headers['Authorization']).not.toContain('${');
    });
});
