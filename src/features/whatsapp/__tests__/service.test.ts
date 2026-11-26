import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    selects: [] as unknown[][], inserts: [] as { table: unknown; values: Record<string, unknown> }[], updates: [] as Record<string, unknown>[],
    insertReturning: [] as unknown[][], updateReturning: [] as unknown[][], consent: vi.fn(), rate: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({ apiRateLimit: null, checkRateLimit: m.rate }));
vi.mock('../consent', () => ({ getLatestConsent: m.consent }));
vi.mock('@/db', () => ({
    db: {
        select: () => ({ from: () => ({ where: () => Promise.resolve(m.selects.shift() ?? []) }) }),
        insert: (table: unknown) => ({
            values: (values: Record<string, unknown>) => {
                m.inserts.push({ table, values });
                const p: any = Promise.resolve([]);
                p.onConflictDoNothing = () => ({ returning: () => Promise.resolve(m.insertReturning.shift() ?? []) });
                return p;
            },
        }),
        update: () => ({ set: (v: Record<string, unknown>) => { m.updates.push(v); return { where: () => { const p: any = Promise.resolve([]); p.returning = () => Promise.resolve(m.updateReturning.shift() ?? []); return p; } }; } }),
    },
}));

import { sendInvoiceTemplate } from '../service';

const input = { orgId: 'org-1', userId: 'u1', invoiceId: 'inv-1', kind: 'invoice_issued' as const };
const invoice = { id: 'inv-1', centreId: 'c1', parentId: 'p1', invoiceNumber: 'INV-1', amount: '240.00', status: 'sent', dueDate: new Date('2026-12-01T00:00:00Z'), serviceType: 'childcare' };
const parent = { id: 'p1', firstName: 'Ada', phone: '07700 900123' };
const active = { phoneNumberId: '1234567890', status: 'active', enabled: true };
function queue(config: unknown = active) {
    m.selects.push([invoice], [parent], config ? [config] : [], [{ name: 'Org' }], [{ name: 'Sydenham' }]);
}
const fetchOk = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.X' }] }) });

beforeEach(() => {
    vi.clearAllMocks(); m.selects.length = 0; m.inserts.length = 0; m.updates.length = 0; m.insertReturning.length = 0; m.updateReturning.length = 0;
    m.consent.mockResolvedValue('opted_in'); m.rate.mockResolvedValue({ success: true });
    process.env.FF_WHATSAPP_API = 'true'; process.env.WHATSAPP_ACCESS_TOKEN = 'tok-secret'; delete process.env.WHATSAPP_DRY_RUN;
});
afterEach(() => { delete process.env.FF_WHATSAPP_API; delete process.env.WHATSAPP_ACCESS_TOKEN; delete process.env.WHATSAPP_DRY_RUN; });

describe('sendInvoiceTemplate', () => {
    it('flag OFF: falls back to wa.me, no log row, no Meta call', async () => {
        process.env.FF_WHATSAPP_API = 'false';
        queue(); const f = fetchOk();
        const r = await sendInvoiceTemplate(input, { fetchImpl: f });
        expect(r).toMatchObject({ success: false, route: 'wa_me', reason: 'flag_off' });
        expect(f).not.toHaveBeenCalled(); expect(m.inserts).toHaveLength(0);
    });
    it('centre without an enabled API number falls back to wa.me', async () => {
        queue(null); const f = fetchOk();
        expect(await sendInvoiceTemplate(input, { fetchImpl: f })).toMatchObject({ route: 'wa_me', reason: 'no_centre_config' });
        expect(f).not.toHaveBeenCalled();
    });
    it('blocks without a recorded opt-in and after opt-out', async () => {
        const f = fetchOk();
        m.consent.mockResolvedValue(null); queue();
        expect(await sendInvoiceTemplate(input, { fetchImpl: f })).toMatchObject({ route: 'blocked', reason: 'no_opt_in' });
        m.selects.length = 0; m.consent.mockResolvedValue('opted_out'); queue();
        expect(await sendInvoiceTemplate(input, { fetchImpl: f })).toMatchObject({ route: 'blocked', reason: 'opted_out' });
        expect(f).not.toHaveBeenCalled(); expect(m.inserts).toHaveLength(0);
    });
    it('sends via the centre phone_number_id, logs wamid, token only in header', async () => {
        queue(); m.insertReturning.push([{ id: 'msg-1' }]); const f = fetchOk();
        const r = await sendInvoiceTemplate(input, { fetchImpl: f, now: new Date('2026-12-01T10:00:00Z') });
        expect(r).toEqual({ success: true, status: 'sent', messageId: 'msg-1' });
        const [url, init] = f.mock.calls[0];
        expect(url).toContain('/1234567890/messages');
        expect(init.headers.Authorization).toBe('Bearer tok-secret');
        expect(init.body).not.toContain('tok-secret');
        expect(JSON.parse(init.body).to).toBe('447700900123');
        expect(m.updates).toContainEqual(expect.objectContaining({ status: 'sent', wamid: 'wamid.X' }));
        const logRow = m.inserts[0].values;
        expect(logRow).toMatchObject({ idempotencyKey: 'inv:inv-1:invoice_issued', templateName: 'invoice_issued_v1', centreId: 'c1', organisationId: 'org-1' });
        expect(JSON.stringify(m.inserts.map(i => i.values))).not.toContain('tok-secret');
    });
    it('dry-run logs without calling Meta and needs no token', async () => {
        process.env.WHATSAPP_DRY_RUN = 'true'; delete process.env.WHATSAPP_ACCESS_TOKEN;
        queue(); m.insertReturning.push([{ id: 'msg-2' }]); const f = fetchOk();
        expect(await sendInvoiceTemplate(input, { fetchImpl: f })).toEqual({ success: true, status: 'dry_run', messageId: 'msg-2' });
        expect(f).not.toHaveBeenCalled();
        expect(m.updates).toContainEqual({ status: 'dry_run' });
    });
    it('idempotent: a second send of the same key is refused, a failed one may be retried', async () => {
        const f = fetchOk();
        queue(); // insert conflicts, no failed row to retry
        expect(await sendInvoiceTemplate(input, { fetchImpl: f })).toMatchObject({ success: false, error: 'This message has already been sent' });
        expect(f).not.toHaveBeenCalled();
        queue(); m.updateReturning.push([{ id: 'msg-1' }]); // conflict, but prior row was failed -> retry
        expect(await sendInvoiceTemplate(input, { fetchImpl: f })).toMatchObject({ success: true, status: 'sent' });
    });
    it('records a Meta failure as failed and tells staff to use the wa.me link', async () => {
        queue(); m.insertReturning.push([{ id: 'msg-3' }]);
        const f = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { code: 131047, message: 'Re-engagement message' } }) });
        const r = await sendInvoiceTemplate(input, { fetchImpl: f });
        expect(r).toMatchObject({ success: false, reason: '131047' });
        expect(m.updates).toContainEqual(expect.objectContaining({ status: 'failed', errorCode: '131047' }));
    });
    it('refuses ineligible invoice states (draft, or receipt on an unpaid invoice)', async () => {
        m.selects.push([{ ...invoice, status: 'draft' }]);
        expect(await sendInvoiceTemplate(input)).toMatchObject({ success: false });
        m.selects.push([invoice]);
        expect(await sendInvoiceTemplate({ ...input, kind: 'payment_receipt' })).toMatchObject({ success: false });
        expect(m.inserts).toHaveLength(0);
    });
    it('rate limit stops the send before anything is logged', async () => {
        m.rate.mockResolvedValue({ success: false }); queue(); const f = fetchOk();
        expect(await sendInvoiceTemplate(input, { fetchImpl: f })).toMatchObject({ success: false });
        expect(f).not.toHaveBeenCalled(); expect(m.inserts).toHaveLength(0);
    });
    it('invoice from another organisation is not found (org scoping)', async () => {
        m.selects.push([]);
        expect(await sendInvoiceTemplate(input)).toEqual({ success: false, error: 'Invoice not found' });
    });
});
