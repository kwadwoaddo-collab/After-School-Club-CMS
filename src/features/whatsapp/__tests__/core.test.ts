import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { safeEqual, verifyMetaSignature } from '../signature';
import { TEMPLATE_ELIGIBLE_STATUSES, WHATSAPP_TEMPLATES, buildIdempotencyKey, buildTemplateParams, buildTemplatePayload, isOptOutText, sanitiseParam } from '../templates';
import { decideRoute } from '../routing';

const sign = (body: string, secret: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifyMetaSignature', () => {
    const body = '{"entry":[]}';
    it('accepts a correct signature', () => expect(verifyMetaSignature(body, sign(body, 's3cret'), 's3cret')).toBe(true));
    it('rejects tampered body, wrong secret, missing/malformed header or secret', () => {
        expect(verifyMetaSignature(body + ' ', sign(body, 's3cret'), 's3cret')).toBe(false);
        expect(verifyMetaSignature(body, sign(body, 'other'), 's3cret')).toBe(false);
        expect(verifyMetaSignature(body, null, 's3cret')).toBe(false);
        expect(verifyMetaSignature(body, 'sha256=zz', 's3cret')).toBe(false);
        expect(verifyMetaSignature(body, 'sha1=' + 'a'.repeat(40), 's3cret')).toBe(false);
        expect(verifyMetaSignature(body, sign(body, 's3cret'), null)).toBe(false);
    });
    it('safeEqual compares verify tokens', () => {
        expect(safeEqual('abc', 'abc')).toBe(true);
        expect(safeEqual('abc', 'abd')).toBe(false);
        expect(safeEqual('abc', 'abcd')).toBe(false);
        expect(safeEqual('', '')).toBe(false);
    });
});

describe('templates', () => {
    const input = { parentFirstName: 'Ada', serviceType: 'childcare' as const, invoiceNumber: 'INV-1', organisationName: 'Sydenham ASC', amountFormatted: '240.00', dueDateFormatted: '01/12/2026' };
    it('param counts match the template definitions', () => {
        for (const kind of Object.keys(WHATSAPP_TEMPLATES) as (keyof typeof WHATSAPP_TEMPLATES)[]) {
            expect(buildTemplateParams(kind, input)).toHaveLength(WHATSAPP_TEMPLATES[kind].paramCount);
        }
    });
    it('uses the Tuition word for tuition invoices and Childcare otherwise', () => {
        expect(buildTemplateParams('invoice_issued', input)[1]).toBe('Childcare');
        expect(buildTemplateParams('invoice_issued', { ...input, serviceType: 'tuition' })[1]).toBe('Tuition');
    });
    it('sanitises newlines/tabs and caps length', () => {
        expect(sanitiseParam('a\nb\t c   d')).toBe('a b c d');
        expect(sanitiseParam('x'.repeat(100))).toHaveLength(60);
        expect(sanitiseParam('  ')).toBe('-');
    });
    it('payload is a template message with text params only (no free text)', () => {
        const p = buildTemplatePayload('447700900123', 'invoice_issued', buildTemplateParams('invoice_issued', input));
        expect(p).toMatchObject({ messaging_product: 'whatsapp', to: '447700900123', type: 'template', template: { name: 'invoice_issued_v1', language: { code: 'en_GB' } } });
        expect(() => buildTemplatePayload('447700900123', 'invoice_issued', ['only-one'])).toThrow();
    });
    it('idempotency keys: once per invoice per kind, reminders once per UTC day', () => {
        const d1 = new Date('2026-12-01T09:00:00Z'), d2 = new Date('2026-12-02T09:00:00Z');
        expect(buildIdempotencyKey('invoice_issued', 'i1', d1)).toBe(buildIdempotencyKey('invoice_issued', 'i1', d2));
        expect(buildIdempotencyKey('payment_reminder', 'i1', d1)).not.toBe(buildIdempotencyKey('payment_reminder', 'i1', d2));
    });
    it('receipt only for paid, reminder only for unpaid', () => {
        expect(TEMPLATE_ELIGIBLE_STATUSES.payment_receipt).toEqual(['paid']);
        expect(TEMPLATE_ELIGIBLE_STATUSES.payment_reminder).toEqual(['sent']);
        expect(TEMPLATE_ELIGIBLE_STATUSES.invoice_issued).not.toContain('draft');
    });
    it('recognises STOP-style replies only', () => {
        for (const t of ['STOP', ' stop ', 'Stop.', 'unsubscribe', 'Opt out']) expect(isOptOutText(t)).toBe(true);
        for (const t of ['please stop by tomorrow', 'ok', '', null]) expect(isOptOutText(t as string)).toBe(false);
    });
});

describe('decideRoute (per-centre routing + fallback + consent)', () => {
    const active = { phoneNumberId: '1234567890', status: 'active', enabled: true };
    const base = { flagOn: true, hasCredentials: true, dryRun: false, config: active, phoneDigits: '447700900123', consent: 'opted_in' as const };
    it('sends via API only when flag + centre config + credentials + phone + opt-in', () => {
        expect(decideRoute(base)).toEqual({ route: 'api', phoneNumberId: '1234567890' });
    });
    it('falls back to wa.me when the flag is off, centre has no/disabled config, no number id or no credentials', () => {
        expect(decideRoute({ ...base, flagOn: false })).toEqual({ route: 'wa_me', reason: 'flag_off' });
        expect(decideRoute({ ...base, config: null })).toEqual({ route: 'wa_me', reason: 'no_centre_config' });
        expect(decideRoute({ ...base, config: { ...active, enabled: false } })).toEqual({ route: 'wa_me', reason: 'centre_not_enabled' });
        expect(decideRoute({ ...base, config: { ...active, status: 'pending' } })).toEqual({ route: 'wa_me', reason: 'centre_not_enabled' });
        expect(decideRoute({ ...base, config: { ...active, phoneNumberId: null } })).toEqual({ route: 'wa_me', reason: 'no_phone_number_id' });
        expect(decideRoute({ ...base, hasCredentials: false })).toEqual({ route: 'wa_me', reason: 'no_credentials' });
    });
    it('dry-run does not need credentials', () => expect(decideRoute({ ...base, hasCredentials: false, dryRun: true }).route).toBe('api'));
    it('never sends without a recorded opt-in, or after opt-out, or with a bad phone', () => {
        expect(decideRoute({ ...base, consent: null })).toEqual({ route: 'blocked', reason: 'no_opt_in' });
        expect(decideRoute({ ...base, consent: 'opted_out' })).toEqual({ route: 'blocked', reason: 'opted_out' });
        expect(decideRoute({ ...base, phoneDigits: null })).toEqual({ route: 'blocked', reason: 'invalid_phone' });
    });
});
