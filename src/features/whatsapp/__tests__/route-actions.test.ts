import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ process: vi.fn(), session: vi.fn(), accessible: vi.fn(), selects: [] as unknown[][], inserts: [] as Record<string, unknown>[], send: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../webhook', () => ({ processWhatsAppWebhook: m.process }));
vi.mock('@/lib/session', () => ({ requireTenantSession: m.session }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: m.accessible }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../service', () => ({ sendInvoiceTemplate: m.send }));
vi.mock('../consent', () => ({ getLatestConsent: vi.fn() }));
vi.mock('@/db', () => ({
    db: {
        select: () => ({ from: () => ({ where: () => Promise.resolve(m.selects.shift() ?? []) }) }),
        insert: () => ({ values: (v: Record<string, unknown>) => { m.inserts.push(v); const p: any = Promise.resolve([]); p.onConflictDoUpdate = () => Promise.resolve([]); return p; } }),
    },
}));

import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import { recordWhatsAppConsent, saveWhatsAppCentreConfig, sendInvoiceWhatsAppTemplate } from '../actions';

const U = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const as = (role: string) => m.session.mockResolvedValue({ user: { id: 'u1', role, organisationId: 'org-1' } });

beforeEach(() => {
    vi.clearAllMocks(); m.selects.length = 0; m.inserts.length = 0;
    process.env.WHATSAPP_APP_SECRET = 'appsecret'; process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me';
    m.process.mockResolvedValue({ statusUpdates: 1, optOuts: 0 }); m.accessible.mockResolvedValue([U(2)]);
});

describe('webhook route', () => {
    it('GET echoes the challenge only with the right verify token', async () => {
        const ok = await GET(new NextRequest('http://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc'));
        expect(ok.status).toBe(200); expect(await ok.text()).toBe('abc');
        const bad = await GET(new NextRequest('http://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc'));
        expect(bad.status).toBe(403);
    });
    it('POST rejects missing/invalid signatures without processing, accepts valid ones', async () => {
        const body = JSON.stringify({ entry: [] });
        const mk = (sig?: string) => new NextRequest('http://x/api/webhooks/whatsapp', { method: 'POST', body, headers: sig ? { 'x-hub-signature-256': sig } : {} });
        expect((await POST(mk())).status).toBe(401);
        expect((await POST(mk('sha256=' + '0'.repeat(64)))).status).toBe(401);
        expect(m.process).not.toHaveBeenCalled();
        const good = 'sha256=' + createHmac('sha256', 'appsecret').update(body).digest('hex');
        const res = await POST(mk(good));
        expect(res.status).toBe(200); expect(m.process).toHaveBeenCalledOnce();
    });
    it('POST fails closed (503) when the app secret is not configured', async () => {
        delete process.env.WHATSAPP_APP_SECRET;
        expect((await POST(new NextRequest('http://x/api/webhooks/whatsapp', { method: 'POST', body: '{}' }))).status).toBe(503);
    });
});

describe('actions RBAC', () => {
    it('TUTOR cannot send or record consent; FRONT_DESK cannot change centre config', async () => {
        as('TUTOR');
        expect(await sendInvoiceWhatsAppTemplate({ invoiceId: U(1), kind: 'invoice_issued' })).toEqual({ success: false, error: 'Forbidden' });
        expect(await recordWhatsAppConsent({ parentId: U(3), status: 'opted_in', source: 'verbal' })).toEqual({ success: false, error: 'Forbidden' });
        as('FRONT_DESK');
        expect(await saveWhatsAppCentreConfig({ centreId: U(2), phoneNumberId: '1234567890', enabled: true })).toEqual({ success: false, error: 'Forbidden' });
        expect(m.send).not.toHaveBeenCalled();
    });
    it('send enforces the centre guard for non-owners', async () => {
        as('MANAGER'); m.selects.push([{ centreId: U(9) }]);
        expect(await sendInvoiceWhatsAppTemplate({ invoiceId: U(1), kind: 'invoice_issued' })).toEqual({ success: false, error: 'Unauthorized: No access to this centre' });
        expect(m.send).not.toHaveBeenCalled();
    });
    it('consent for a parent in another organisation is not found; own-org consent is recorded with audit', async () => {
        as('FRONT_DESK'); m.selects.push([]);
        expect(await recordWhatsAppConsent({ parentId: U(3), status: 'opted_in', source: 'verbal' })).toEqual({ success: false, error: 'Parent not found' });
        m.selects.push([{ id: U(3), phone: '07700 900123' }]);
        expect(await recordWhatsAppConsent({ parentId: U(3), status: 'opted_in', source: 'verbal' })).toEqual({ success: true });
        expect(m.inserts[0]).toMatchObject({ status: 'opted_in', source: 'verbal', recordedBy: 'u1', organisationId: 'org-1' });
        expect(m.inserts[1]).toMatchObject({ eventType: 'whatsapp_opted_in' });
    });
    it('opt-in needs a valid phone number', async () => {
        as('MANAGER'); m.selects.push([{ id: U(3), phone: 'n/a' }]);
        expect(await recordWhatsAppConsent({ parentId: U(3), status: 'opted_in', source: 'verbal' })).toMatchObject({ success: false });
    });
    it('manager saves own centre config with audit; enabling needs a number id; foreign centre rejected', async () => {
        as('MANAGER');
        m.selects.push([{ id: U(2) }]);
        expect(await saveWhatsAppCentreConfig({ centreId: U(2), phoneNumberId: '', enabled: true })).toMatchObject({ success: false });
        m.selects.push([{ id: U(2) }]);
        expect(await saveWhatsAppCentreConfig({ centreId: U(2), phoneNumberId: '1234567890', enabled: true })).toEqual({ success: true });
        expect(m.inserts.some(v => v.eventType === 'whatsapp_centre_config_saved')).toBe(true);
        m.selects.push([]);
        expect(await saveWhatsAppCentreConfig({ centreId: U(2), phoneNumberId: '1234567890', enabled: true })).toEqual({ success: false, error: 'Centre not found' });
        m.selects.push([{ id: U(5) }]);
        expect(await saveWhatsAppCentreConfig({ centreId: U(5), phoneNumberId: '1234567890', enabled: true })).toEqual({ success: false, error: 'Unauthorized: No access to this centre' });
    });
});
