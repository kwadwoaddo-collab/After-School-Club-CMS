import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), role: vi.fn(), centre: vi.fn(), membership: vi.fn(), select: vi.fn(), transaction: vi.fn() }));
vi.mock('@/db', () => ({ db: { query: { centres: { findFirst: mocks.centre }, orgMemberships: { findFirst: mocks.membership } }, select: mocks.select, transaction: mocks.transaction } }));
vi.mock('@/lib/session', () => ({ requireTenantSession: mocks.session }));
vi.mock('@/lib/permissions', () => ({ getUserRoleForCentre: mocks.role }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCentreDocuments, uploadCentreDocument, removeCentreDocument } from './actions';
const centreId = '22222222-2222-4222-8222-222222222222';
beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { id: 'actor', organisationId: 'org' } });
    mocks.centre.mockResolvedValue({ id: centreId });
    mocks.membership.mockResolvedValue({ role: 'MANAGER' });
    mocks.role.mockResolvedValue('MANAGER');
});
describe('private centre documents authorization', () => {
    it('denies an inaccessible centre before selecting any document', async () => {
        mocks.role.mockResolvedValue(null);
        await expect(getCentreDocuments(centreId)).rejects.toThrow('permission');
        expect(mocks.select).not.toHaveBeenCalled();
    });
    it('denies a foreign-tenant centre despite a stale role', async () => {
        mocks.centre.mockResolvedValue(null);
        await expect(getCentreDocuments(centreId)).rejects.toThrow('permission');
        expect(mocks.select).not.toHaveBeenCalled();
    });
    it('a live org demotion cannot keep manager write access via centre role', async () => {
        mocks.membership.mockResolvedValue({ role: 'TUTOR' });
        const form = new FormData(); form.set('centreId', centreId); form.set('name', 'Policy');
        const result = await uploadCentreDocument(form);
        expect(result.success).toBe(false);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('front desk cannot remove a document', async () => {
        mocks.role.mockResolvedValue('FRONT_DESK');
        const result = await removeCentreDocument({ centreId, documentId: '33333333-3333-4333-8333-333333333333', version: 1 });
        expect(result.success).toBe(false); expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('folder listings select metadata without document payloads', async () => {
        const orderBy = vi.fn().mockResolvedValueOnce([{ id: 'doc', name: 'Policy', originalFilename: 'policy.pdf', sizeBytes: 90, version: 1, updatedAt: new Date(), removedAt: null }]).mockResolvedValueOnce([]);
        mocks.select.mockReturnValue({ from: () => ({ where: () => ({ orderBy }) }) });
        const result = await getCentreDocuments(centreId);
        expect(result.documents).toHaveLength(1);
        expect(mocks.select.mock.calls[0][0]).not.toHaveProperty('content');
    });
});

describe('atomic mutations and quotas', () => {
    function transactionFixture(options: { count?: number; totalBytes?: number; changed?: boolean; liveRole?: string } = {}) {
        const update = vi.fn(() => ({ set: () => ({ where: () => ({ returning: async () => options.changed === false ? [] : [{ id: 'doc' }] }) }) }));
        const insert = vi.fn(() => ({ values: () => ({ returning: async () => [{ id: 'new-doc' }] }) }));
        let selections = 0;
        const tx = { execute: vi.fn(), update, insert, select: vi.fn(() => ({ from: () => ({ where: () => {
            selections++;
            // The first three queries lock live org, centre and manager assignment.
            if (selections === 1) return { for: async () => [{ role: options.liveRole ?? 'MANAGER' }] };
            if (selections === 2) return { for: async () => [{ id: centreId }] };
            if (selections === 3) return { for: async () => [{ role: 'MANAGER' }] };
            return Promise.resolve([{ count: options.count ?? 0, totalBytes: options.totalBytes ?? 0 }]);
        } }) })) };
        mocks.transaction.mockImplementation(async callback => callback(tx));
        return tx;
    }
    function validUpload() {
        const form = new FormData(); form.set('centreId', centreId); form.set('name', 'Policy');
        form.set('file', new File(['%PDF-1.7\npolicy\n%%EOF'], 'policy.pdf', { type: 'application/pdf' })); return form;
    }
    it('rechecks live manager authority inside the write transaction', async () => {
        const tx = transactionFixture({ liveRole: 'TUTOR' });
        expect((await uploadCentreDocument(validUpload())).success).toBe(false);
        expect(tx.insert).not.toHaveBeenCalled();
    });
    it('rejects an upload at the active document limit', async () => {
        const tx = transactionFixture({ count: 20 });
        const result = await uploadCentreDocument(validUpload());
        expect(result.success).toBe(false); expect(tx.insert).not.toHaveBeenCalled();
    });
    it('retained removed files count against the total storage quota', async () => {
        const tx = transactionFixture({ totalBytes: 60 * 1024 * 1024 });
        const result = await uploadCentreDocument(validUpload());
        expect(result.success).toBe(false); expect(tx.insert).not.toHaveBeenCalled();
    });
    it('rejects stale document versions without writing an audit success', async () => {
        const tx = transactionFixture({ changed: false });
        const result = await removeCentreDocument({ centreId, documentId: '33333333-3333-4333-8333-333333333333', version: 1 });
        expect(result.success).toBe(false); expect(tx.insert).not.toHaveBeenCalled();
    });
});
