import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { contractExpiry, generateContractToken, hashContractToken, isWellFormedToken, linkState, CONTRACT_LINK_TTL_DAYS } from '../tokens';
import { resolveCentreDetails } from '../centre-details';
import { buildContractPrefill } from '../prefill';
import { contractSections, contractTemplateHash, CONTRACT_TEMPLATE_VERSION } from '../template';
import { deriveContractStatus } from '../status';
import { ContractPdf } from '../ContractPdf';
import { ContractDocument } from '../ContractDocument';

const SYDENHAM = { providerName: 'Sydenham After School Club LTD', address: '105 Sydenham Road, London, SE26 5UA', phone: '020 3621 3942', website: 'www.sydenhamasc.co.uk', ofstedRegNo: 'EY2854827' };
const DAGENHAM_CENTRE = { name: 'Dagenham After School Club', address: '1 High Street, Dagenham', billingPhone: '020 0000 0000', ofstedId: 'EY0000001' };
const parent = { firstName: 'Ada', lastName: 'Okafor', email: 'ada@example.test' };
const config = { serviceType: 'childcare', status: 'active', agreedMonthlyPence: 24000, billingAnchorDate: '2026-12-01' };

describe('tokens', () => {
    it('stores only a hash, never the token, and is well formed', () => {
        const t = generateContractToken();
        expect(isWellFormedToken(t)).toBe(true);
        expect(hashContractToken(t)).not.toContain(t);
        expect(hashContractToken(t)).toHaveLength(64);
        expect(generateContractToken()).not.toBe(t);
        expect(isWellFormedToken('../etc/passwd')).toBe(false);
        expect(isWellFormedToken(undefined)).toBe(false);
    });
    it('expires after 14 days', () => {
        const now = new Date('2026-11-25T10:00:00Z');
        expect(CONTRACT_LINK_TTL_DAYS).toBe(14);
        expect(contractExpiry(now).toISOString()).toBe('2026-12-09T10:00:00.000Z');
    });
    it('maps stored rows to link states (single-use, expiry, revoked)', () => {
        const now = new Date('2026-11-25T10:00:00Z');
        const future = new Date('2026-12-01T00:00:00Z'), past = new Date('2026-11-01T00:00:00Z');
        expect(linkState({ status: 'sent', expiresAt: future }, now)).toBe('valid');
        expect(linkState({ status: 'sent', expiresAt: past }, now)).toBe('expired');
        expect(linkState({ status: 'signed', expiresAt: future }, now)).toBe('signed');
        expect(linkState({ status: 'revoked', expiresAt: future }, now)).toBe('revoked');
        expect(linkState({ status: 'draft', expiresAt: future }, now)).toBe('unavailable');
        expect(linkState(undefined, now)).toBe('unavailable');
    });
});

describe('per-centre details', () => {
    it('uses the contract setting for Sydenham', () => {
        const r = resolveCentreDetails({ setting: SYDENHAM, centre: { name: 'Sydenham' } });
        expect(r.provider).toEqual(SYDENHAM);
        expect(r.missing).toEqual([]);
    });
    it('falls back to the centre record for Dagenham, with website optional', () => {
        const r = resolveCentreDetails({ setting: null, centre: DAGENHAM_CENTRE });
        expect(r.provider).toMatchObject({ providerName: 'Dagenham After School Club', ofstedRegNo: 'EY0000001', phone: '020 0000 0000', website: null });
    });
    it('blocks (no blanks) when Dagenham details are missing', () => {
        const r = resolveCentreDetails({ setting: null, centre: { name: 'Dagenham After School Club' } });
        expect(r.provider).toBeNull();
        expect(r.missing).toEqual(['address', 'phone number', 'Ofsted registration number']);
        const p = buildContractPrefill({ config, parent, childNames: ['Zed'], provider: r.provider, missingCentreDetails: r.missing });
        expect(p).toMatchObject({ ok: false });
        expect((p as { error: string }).error).toContain('Ofsted registration number');
    });
});

describe('prefill', () => {
    it('prefills parent, all children, start date (billing anchor), monthly amount', () => {
        const p = buildContractPrefill({ config, parent, childNames: ['Zed Okafor', 'Amy Okafor'], provider: SYDENHAM, missingCentreDetails: [], now: new Date('2026-11-25T12:00:00Z') });
        expect(p.ok && p.values).toMatchObject({ parentName: 'Ada Okafor', childNames: ['Zed Okafor', 'Amy Okafor'], startDate: '01/12/2026', amountPence: 24000, providerSignedDate: '25/11/2026' });
        expect(p.ok && p.templateVersion).toBe(CONTRACT_TEMPLATE_VERSION);
    });
    it('excludes tuition families', () => {
        const p = buildContractPrefill({ config: { ...config, serviceType: 'tuition' }, parent, childNames: ['Zed'], provider: SYDENHAM, missingCentreDetails: [] });
        expect(p).toEqual({ ok: false, error: expect.stringContaining('childcare families only') });
    });
    it('treats a missing legacy service type as childcare', () => {
        expect(buildContractPrefill({ config: { ...config, serviceType: undefined }, parent, childNames: ['Zed'], provider: SYDENHAM, missingCentreDetails: [] }).ok).toBe(true);
    });
    it.each([
        ['zero amount', { config: { ...config, agreedMonthlyPence: 0 }, childNames: ['Zed'] }],
        ['no children', { config, childNames: [] }],
        ['cancelled billing', { config: { ...config, status: 'cancelled' }, childNames: ['Zed'] }],
    ])('refuses %s', (_n, extra) => {
        expect(buildContractPrefill({ parent, provider: SYDENHAM, missingCentreDetails: [], ...extra }).ok).toBe(false);
    });
    it('refuses a parent with no email', () => {
        expect(buildContractPrefill({ config, parent: { ...parent, email: ' ' }, childNames: ['Zed'], provider: SYDENHAM, missingCentreDetails: [] }).ok).toBe(false);
    });
});

describe('template wording', () => {
    const all = (name: string) => JSON.stringify(contractSections(name));
    it('has no "Penge" and uses the provider name in Services', () => {
        for (const name of [SYDENHAM.providerName, 'Dagenham After School Club']) {
            expect(all(name)).not.toMatch(/penge/i);
            expect(contractSections(name)[0].intro).toBe(`${name} provides:`);
        }
    });
    it('keeps the rest of the clause text identical across centres', () => {
        const strip = (n: string) => all(n).split(n).join('X');
        expect(strip('Dagenham After School Club')).toBe(strip(SYDENHAM.providerName));
        expect(contractTemplateHash()).toHaveLength(64);
        expect(contractTemplateHash()).toBe(contractTemplateHash());
    });
    it('renders Monthly Cost (not Weekly) and no Penge in HTML and PDF', async () => {
        const prefill = buildContractPrefill({ config, parent, childNames: ['Zed Okafor'], provider: SYDENHAM, missingCentreDetails: [] });
        if (!prefill.ok) throw new Error('prefill');
        const html = renderToStaticMarkup(<ContractDocument values={prefill.values} />);
        expect(html).toContain('Monthly Cost:');
        expect(html).toContain('£240.00');
        expect(html).not.toMatch(/weekly cost|penge/i);
        expect(html).toContain('Sydenham After School Club LTD provides:');
        const unsigned = await renderToBuffer(<ContractPdf values={prefill.values} templateVersion="v" />);
        const signed = await renderToBuffer(<ContractPdf values={prefill.values} templateVersion="v" contractId="c1" signature={{ signerName: 'Ada Okafor', kind: 'typed', data: 'Ada Okafor', signedDate: '25/11/2026', signedAtIso: '2026-11-25T12:00:00.000Z' }} />);
        expect(unsigned.subarray(0, 5).toString()).toBe('%PDF-');
        expect(signed.subarray(0, 5).toString()).toBe('%PDF-');
        expect(signed.length).toBeGreaterThan(1000);
    });
});

describe('contract status', () => {
    const base = { id: 'a', status: 'signed' as const, expiresAt: new Date('2026-12-01'), createdAt: new Date('2026-11-01'), amountPence: 24000, signedAt: new Date('2026-11-02'), sentAt: new Date('2026-11-01'), signerName: 'Ada' };
    const now = new Date('2026-11-25');
    it('Not sent when there are no rows', () => expect(deriveContractStatus([], 24000, now).label).toBe('Not sent'));
    it('Sent while a link is live', () => expect(deriveContractStatus([{ ...base, status: 'sent', signedAt: null }], 24000, now).label).toBe('Sent'));
    it('Expired when the link lapsed', () => expect(deriveContractStatus([{ ...base, status: 'sent', signedAt: null, expiresAt: new Date('2026-11-10') }], 24000, now).label).toBe('Expired'));
    it('Signed when the amount matches', () => expect(deriveContractStatus([base], 24000, now)).toMatchObject({ label: 'Signed', signed: { id: 'a' } }));
    it('flags a changed amount instead of auto-sending', () => {
        const s = deriveContractStatus([base], 26000, now);
        expect(s.label).toBe('Amount changed — new contract needed');
        expect(s.amountChanged).toBe(true);
    });
});
