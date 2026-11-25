import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    session: vi.fn(), accessible: vi.fn(), send: vi.fn(), findConfig: vi.fn(),
    selects: [] as unknown[][], inserts: [] as { table: unknown; values: Record<string, unknown> }[], updates: [] as Record<string, unknown>[],
}));
vi.mock('@/lib/session', () => ({ requireTenantSession: m.session }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: m.accessible }));
vi.mock('@/lib/services/email', () => ({ emailService: { sendContractLink: m.send } }));
vi.mock('@/lib/base-url', () => ({ getBaseUrl: () => 'https://app.example.test' }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db', () => {
    const rows = (): unknown => { const v = m.selects.shift() ?? []; const p: any = Promise.resolve(v); p.for = () => p; p.orderBy = () => p; return p; };
    const tx: any = {
        select: () => ({ from: () => ({ where: rows }) }),
        insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => { m.inserts.push({ table, values }); const p: any = Promise.resolve([{ id: 'contract-1' }]); p.returning = () => p; p.onConflictDoUpdate = () => p; return p; } }),
        update: () => ({ set: (v: Record<string, unknown>) => { m.updates.push(v); const p: any = Promise.resolve([{ id: 'contract-1' }]); return { where: () => Object.assign(p, { returning: () => p }) }; } }),
    };
    return { db: { ...tx, query: { billingConfigs: { findFirst: m.findConfig } }, transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
});

import { revokeContract, saveContractCentreDetails, sendContract } from '../actions';

const ids = { config: '11111111-1111-4111-8111-111111111111', centre: '22222222-2222-4222-8222-222222222222', parent: '33333333-3333-4333-8333-333333333333', contract: '44444444-4444-4444-8444-444444444444' };
const baseConfig = { id: ids.config, centreId: ids.centre, parentId: ids.parent, status: 'active', serviceType: 'childcare', agreedMonthlyPence: 24000, billingAnchorDate: '2026-12-01', children: [{ childId: 'c1' }] };
const sydenham = { providerName: 'Sydenham After School Club LTD', address: '105 Sydenham Road, London, SE26 5UA', phone: '020 3621 3942', website: 'www.sydenhamasc.co.uk', ofstedRegNo: 'EY2854827' };

function queueHappyPath(setting: unknown = sydenham) {
    m.selects.push([{ id: ids.parent, firstName: 'Ada', lastName: 'Okafor', email: 'ada@example.test' }]);
    m.selects.push([{ id: 'c1', firstName: 'Zed', lastName: 'Okafor' }]);
    m.selects.push([{ name: 'Sydenham', address: null, billingPhone: null, ofstedId: null }]);
    m.selects.push(setting ? [setting] : []);
    m.selects.push([]); // no open contract
}
const as = (role: string, org = 'org-1') => m.session.mockResolvedValue({ user: { id: 'u1', role, organisationId: org } });

beforeEach(() => {
    vi.clearAllMocks(); m.selects.length = 0; m.inserts.length = 0; m.updates.length = 0;
    m.findConfig.mockResolvedValue(baseConfig); m.accessible.mockResolvedValue([ids.centre]); m.send.mockResolvedValue({ success: true, messageId: 'msg' });
    as('MANAGER');
});

describe('sendContract', () => {
    it('sends a one-time link, stores only the hash, audits, and freezes the prefill', async () => {
        queueHappyPath();
        expect(await sendContract({ configId: ids.config })).toMatchObject({ success: true });
        expect(m.send).toHaveBeenCalledOnce();
        const arg = m.send.mock.calls[0][0];
        const token = arg.signUrl.replace('https://app.example.test/sign/', '');
        expect(token).toMatch(/^[a-f0-9]{64}$/);
        const contractInsert = m.inserts.find(i => 'tokenHash' in i.values)!;
        expect(contractInsert.values.tokenHash).not.toBe(token);
        expect(JSON.stringify(contractInsert.values)).not.toContain(token);
        expect(contractInsert.values).toMatchObject({ status: 'draft', amountPence: 24000, organisationId: 'org-1', centreId: ids.centre });
        expect(JSON.parse(contractInsert.values.snapshot as string)).toMatchObject({ parentName: 'Ada Okafor', childNames: ['Zed Okafor'], startDate: '01/12/2026' });
        expect(m.updates.some(u => u.status === 'sent')).toBe(true);
        const audit = m.inserts.find(i => i.values.eventType === 'contract_sent')!;
        expect(JSON.stringify(audit.values)).not.toContain(token);
        expect(JSON.stringify(audit.values)).not.toContain('ada@example.test');
    });
    it.each(['FRONT_DESK', 'TUTOR'])('rejects %s', async role => {
        as(role);
        expect(await sendContract({ configId: ids.config })).toMatchObject({ success: false });
        expect(m.send).not.toHaveBeenCalled();
    });
    it('rejects a manager without access to the centre', async () => {
        m.accessible.mockResolvedValue(['other-centre']);
        expect(await sendContract({ configId: ids.config })).toMatchObject({ success: false });
        expect(m.send).not.toHaveBeenCalled();
    });
    it('does not reveal configs from another organisation', async () => {
        m.findConfig.mockResolvedValue(undefined);
        expect(await sendContract({ configId: ids.config })).toMatchObject({ success: false, error: 'Billing config not found' });
        expect(m.send).not.toHaveBeenCalled();
    });
    it('excludes tuition families', async () => {
        m.findConfig.mockResolvedValue({ ...baseConfig, serviceType: 'tuition' });
        queueHappyPath();
        const r = await sendContract({ configId: ids.config });
        expect(r).toMatchObject({ success: false });
        expect((r as { error: string }).error).toContain('childcare families only');
        expect(m.send).not.toHaveBeenCalled();
    });
    it('blocks sending for a centre with missing details instead of printing blanks', async () => {
        queueHappyPath(null);
        const r = await sendContract({ configId: ids.config });
        expect(r).toMatchObject({ success: false });
        expect((r as { error: string }).error).toContain('Ofsted registration number');
        expect(m.send).not.toHaveBeenCalled();
        expect(m.inserts.length).toBe(0);
    });
    it('leaves the contract unsent and reports it when the email fails', async () => {
        queueHappyPath();
        m.send.mockResolvedValue({ success: false, error: 'down' });
        expect(await sendContract({ configId: ids.config })).toMatchObject({ success: false });
        expect(m.updates.some(u => u.status === 'sent')).toBe(false);
    });
});

describe('revokeContract and centre details', () => {
    it('revokes an open contract with an audit event', async () => {
        m.selects.push([{ id: ids.contract, centreId: ids.centre, parentId: ids.parent, status: 'sent' }]);
        expect(await revokeContract({ contractId: ids.contract })).toMatchObject({ success: true });
        expect(m.updates[0]).toMatchObject({ status: 'revoked' });
        expect(m.inserts.some(i => i.values.eventType === 'contract_revoked')).toBe(true);
    });
    it('does not let front desk revoke', async () => {
        as('FRONT_DESK');
        m.selects.push([{ id: ids.contract, centreId: ids.centre, parentId: ids.parent, status: 'sent' }]);
        expect(await revokeContract({ contractId: ids.contract })).toMatchObject({ success: false });
        expect(m.updates.length).toBe(0);
    });
    it('saves centre details for a manager and audits', async () => {
        m.selects.push([{ id: ids.centre }]);
        const r = await saveContractCentreDetails({ centreId: ids.centre, providerName: 'Dagenham ASC LTD', address: '1 High St', phone: '020 1', website: '', ofstedRegNo: 'EY1' });
        expect(r).toMatchObject({ success: true });
        expect(m.inserts.some(i => i.values.eventType === 'contract_centre_details_updated')).toBe(true);
    });
    it('rejects centre details from front desk and blank required fields', async () => {
        as('FRONT_DESK');
        expect(await saveContractCentreDetails({ centreId: ids.centre, providerName: 'x', address: 'x', phone: 'x', website: '', ofstedRegNo: 'x' })).toMatchObject({ success: false });
        as('MANAGER');
        expect(await saveContractCentreDetails({ centreId: ids.centre, providerName: 'x', address: '', phone: 'x', website: '', ofstedRegNo: 'x' })).toMatchObject({ success: false });
    });
});
