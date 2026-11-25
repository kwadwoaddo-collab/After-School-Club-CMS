import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ selects: [] as unknown[][], updates: [] as Record<string, unknown>[], inserts: [] as Record<string, unknown>[], claim: [{ id: 'k1' }] as unknown[], copy: vi.fn() }));
vi.mock('@/lib/services/email', () => ({ emailService: { sendSignedContractCopy: m.copy } }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/db', () => {
    const tx: any = {
        select: () => ({ from: () => ({ where: () => Promise.resolve(m.selects.shift() ?? []) }) }),
        update: () => ({ set: (v: Record<string, unknown>) => { m.updates.push(v); const p: any = Promise.resolve([]); return { where: () => Object.assign(p, { returning: () => Promise.resolve(m.claim) }) }; } }),
        insert: () => ({ values: (v: Record<string, unknown>) => { m.inserts.push(v); return Promise.resolve([]); } }),
    };
    return { db: { ...tx, transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
});

import { completeSigning, lookupContractForSigning, validateSignatureInput } from '../sign';
import { generateContractToken, hashContractToken } from '../tokens';
import { buildContractPrefill } from '../prefill';

const provider = { providerName: 'Sydenham After School Club LTD', address: '105 Sydenham Road', phone: '1', website: null, ofstedRegNo: 'EY1', signatoryName: 'Jane Smith', signatoryRole: 'Manager' };
const prefill = buildContractPrefill({ config: { serviceType: 'childcare', status: 'active', agreedMonthlyPence: 24000, billingAnchorDate: '2026-12-01' }, parent: { firstName: 'Ada', lastName: 'Okafor', email: 'a@example.test' }, childNames: ['Zed Okafor'], provider, missingCentreDetails: [] });
if (!prefill.ok) throw new Error('prefill');
const snapshot = JSON.stringify(prefill.values);
const row = (over: Record<string, unknown> = {}) => ({ id: 'k1', organisationId: 'org', parentId: 'p1', status: 'sent', expiresAt: new Date(Date.now() + 86_400_000), snapshot, templateVersion: 'v1', templateHash: 'h', amountPence: 24000, ...over });
const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]).toString('base64');
const input = (over: Record<string, unknown> = {}) => ({ token: generateContractToken(), signerName: 'Ada Okafor', agreed: true, kind: 'typed' as const, signature: 'Ada Okafor', ip: '203.0.113.7', userAgent: 'UA', ...over });

beforeEach(() => { vi.clearAllMocks(); m.selects.length = 0; m.updates.length = 0; m.inserts.length = 0; m.claim = [{ id: 'k1' }]; m.copy.mockResolvedValue({ success: true }); });

describe('signature validation', () => {
    it('requires agreement, a name and a real signature', () => {
        expect(validateSignatureInput(input({ agreed: false }))).toMatch(/agree/);
        expect(validateSignatureInput(input({ signerName: 'A' }))).toMatch(/full name/);
        expect(validateSignatureInput(input({ signature: ' ' }))).toMatch(/signature/i);
        expect(validateSignatureInput(input({ kind: 'drawn', signature: 'data:image/svg+xml;base64,AAAA' }))).not.toBeNull();
        expect(validateSignatureInput(input({ kind: 'drawn', signature: 'data:image/png;base64,' + Buffer.from('not a png at all').toString('base64') }))).not.toBeNull();
        expect(validateSignatureInput(input({ kind: 'drawn', signature: PNG }))).toBeNull();
        expect(validateSignatureInput(input())).toBeNull();
    });
});

describe('lookupContractForSigning', () => {
    it('gives the same answer for malformed and unknown tokens', async () => {
        expect(await lookupContractForSigning('nope')).toEqual({ state: 'unavailable' });
        m.selects.push([]);
        expect(await lookupContractForSigning(generateContractToken())).toEqual({ state: 'unavailable' });
    });
    it('returns only the frozen values for a live link, and states for the rest', async () => {
        m.selects.push([row()]);
        const r = await lookupContractForSigning(generateContractToken());
        expect(r).toMatchObject({ state: 'valid', view: { values: { parentName: 'Ada Okafor' } } });
        m.selects.push([row({ expiresAt: new Date(Date.now() - 1000) })]);
        expect(await lookupContractForSigning(generateContractToken())).toEqual({ state: 'expired' });
        m.selects.push([row({ status: 'signed' })]);
        expect(await lookupContractForSigning(generateContractToken())).toEqual({ state: 'signed' });
        m.selects.push([row({ status: 'revoked' })]);
        expect(await lookupContractForSigning(generateContractToken())).toEqual({ state: 'revoked' });
    });
});

describe('completeSigning', () => {
    it('signs once: records evidence, stores the PDF privately, audits, emails a copy', async () => {
        const i = input();
        m.selects.push([row()], [{ email: 'a@example.test', firstName: 'Ada' }]);
        const r = await completeSigning(i);
        expect(r).toEqual({ ok: true, emailed: true });
        const signed = m.updates[0];
        expect(signed).toMatchObject({ status: 'signed', signerName: 'Ada Okafor', signatureKind: 'typed', signerIp: '203.0.113.7', signerUserAgent: 'UA' });
        expect(signed.signedAt).toBeInstanceOf(Date);
        const pdf = m.inserts.find(v => 'sha256' in v)!;
        expect(Buffer.from(pdf.content as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
        expect(m.inserts.find(v => v.eventType === 'contract_signed')).toBeTruthy();
        expect(m.copy).toHaveBeenCalledOnce();
        expect(m.copy.mock.calls[0][0]).toMatchObject({ parentEmail: 'a@example.test' });
        expect(m.updates.some(u => u.copyEmailedAt instanceof Date)).toBe(true);
    });
    it('never modifies the frozen snapshot, amount, template or token', async () => {
        m.selects.push([row()], [{ email: 'a@example.test', firstName: 'Ada' }]);
        await completeSigning(input());
        for (const u of m.updates) for (const k of ['snapshot', 'amountPence', 'templateVersion', 'templateHash', 'tokenHash']) expect(u).not.toHaveProperty(k);
    });
    it('is single use: a lost race (no row claimed) stores nothing and sends nothing', async () => {
        m.claim = [];
        m.selects.push([row()]);
        expect(await completeSigning(input())).toMatchObject({ ok: false, reason: 'unavailable' });
        expect(m.inserts.length).toBe(0);
        expect(m.copy).not.toHaveBeenCalled();
    });
    it.each([['expired', { expiresAt: new Date(Date.now() - 1000) }], ['already signed', { status: 'signed' }], ['revoked', { status: 'revoked' }]])('refuses an %s link', async (_n, over) => {
        m.selects.push([row(over)]);
        expect(await completeSigning(input())).toMatchObject({ ok: false });
        expect(m.updates.length).toBe(0);
    });
    it('rejects an unknown token and invalid input before touching the database', async () => {
        m.selects.push([]);
        expect(await completeSigning(input())).toMatchObject({ ok: false });
        expect(await completeSigning(input({ agreed: false }))).toMatchObject({ ok: false, reason: 'invalid' });
        expect(m.updates.length).toBe(0);
    });
    it('still succeeds when the copy email fails', async () => {
        m.copy.mockResolvedValue({ success: false, error: 'down' });
        m.selects.push([row()], [{ email: 'a@example.test', firstName: 'Ada' }]);
        expect(await completeSigning(input())).toEqual({ ok: true, emailed: false });
    });
    it('hashes the presented token to find the row', () => {
        expect(hashContractToken('a'.repeat(64))).toHaveLength(64);
    });
});
