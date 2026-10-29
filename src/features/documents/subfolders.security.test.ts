import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const m = vi.hoisted(() => ({ session: vi.fn(), role: vi.fn(), centre: vi.fn(), membership: vi.fn(), transaction: vi.fn() }));
vi.mock('@/db', () => ({ db: { query: { centres: { findFirst: m.centre }, orgMemberships: { findFirst: m.membership } }, transaction: m.transaction } }));
vi.mock('@/lib/session', () => ({ requireTenantSession: m.session }));
vi.mock('@/lib/permissions', () => ({ getUserRoleForCentre: m.role }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { createCentreFolder, moveCentreDocument, removeCentreFolder, restoreCentreFolder, uploadCentreDocument } from './actions';
const centreId = '22222222-2222-4222-8222-222222222222';
const folderId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const org = '55555555-5555-4555-8555-555555555555';
const dialect = new PgDialect();
beforeEach(() => {
    vi.resetAllMocks();
    m.session.mockResolvedValue({ user: { id: 'actor', organisationId: org } });
    m.centre.mockResolvedValue({ id: centreId });
    m.membership.mockResolvedValue({ role: 'MANAGER' });
    m.role.mockResolvedValue('MANAGER');
});
function fixture(results: unknown[][]) {
    const predicates: ReturnType<PgDialect['sqlToQuery']>[] = [];
    const queue: unknown[][] = [[{ role: 'MANAGER' }], [{ id: centreId }], [{ role: 'MANAGER' }], ...results];
    const insert = vi.fn(() => ({ values: () => ({ returning: async () => [{ id: folderId }] }) }));
    const update = vi.fn(() => ({ set: () => ({ where: () => ({ returning: async () => [{ id: documentId }] }) }) }));
    const tx = { insert, update, execute: vi.fn(), select: vi.fn(() => ({ from: () => ({ where: (condition: Parameters<PgDialect['sqlToQuery']>[0]) => {
        predicates.push(dialect.sqlToQuery(condition));
        const result = queue.shift() ?? [];
        const promise = Promise.resolve(result);
        return Object.assign(promise, { for: () => promise, limit: () => promise });
    } }) })) };
    m.transaction.mockImplementation(async callback => callback(tx));
    return { tx, predicates };
}
describe('subfolder adversarial boundaries', () => {
    it('rejects foreign, removed or nonexistent parent before creating a folder', async () => {
        const { tx, predicates } = fixture([[]]);
        expect((await createCentreFolder({ centreId, parentId: folderId, name: 'Policies' })).success).toBe(false);
        expect(tx.insert).not.toHaveBeenCalled();
        expect(predicates[3].params).toEqual(expect.arrayContaining([folderId, org, centreId]));
        expect(predicates[3].sql).toContain('removed_at');
    });
    it('does not upload into a folder outside the current centre', async () => {
        const { tx, predicates } = fixture([[]]);
        const form = new FormData(); form.set('centreId', centreId); form.set('folderId', folderId); form.set('name', 'Policy');
        form.set('file', new File(['%PDF-1.7\n%%EOF'], 'policy.pdf', { type: 'application/pdf' }));
        expect((await uploadCentreDocument(form)).success).toBe(false);
        expect(tx.insert).not.toHaveBeenCalled();
        expect(predicates[3].params).toEqual(expect.arrayContaining([folderId, org, centreId]));
    });
    it('rejects moving a document to a foreign or removed folder', async () => {
        const { tx, predicates } = fixture([[]]);
        expect((await moveCentreDocument({ centreId, documentId, version: 2, folderId })).success).toBe(false);
        expect(tx.update).not.toHaveBeenCalled();
        expect(predicates[3].params).toEqual(expect.arrayContaining([folderId, org, centreId]));
    });
    it('stale folder version cannot remove a newer folder or write success audit', async () => {
        const { tx, predicates } = fixture([[]]);
        expect((await removeCentreFolder({ centreId, folderId, version: 1 })).success).toBe(false);
        expect(tx.update).not.toHaveBeenCalled(); expect(tx.insert).not.toHaveBeenCalled();
        expect(predicates[3].params).toEqual(expect.arrayContaining([folderId, org, centreId, 1]));
    });
    it.each(['retained PDF', 'nested folder'])('refuses removal of a folder containing a %s', async kind => {
        const { tx } = fixture([[{ parentId: null }], kind === 'retained PDF' ? [{ id: documentId }] : [], kind === 'nested folder' ? [{ id: folderId }] : []]);
        const result = await removeCentreFolder({ centreId, folderId, version: 1 });
        expect(result.success).toBe(false); expect(result).toMatchObject({ error: expect.stringContaining('not empty') });
        expect(tx.update).not.toHaveBeenCalled(); expect(tx.insert).not.toHaveBeenCalled();
    });
    it('cannot restore a folder beneath an unavailable parent', async () => {
        const { tx, predicates } = fixture([[{ parentId: folderId }], []]);
        expect((await restoreCentreFolder({ centreId, folderId: documentId, version: 2 })).success).toBe(false);
        expect(tx.update).not.toHaveBeenCalled();
        expect(predicates[4].params).toEqual(expect.arrayContaining([folderId, org, centreId]));
    });
    it('allows removing a parent whose only children are already removed', async () => {
        const { predicates } = fixture([[{ parentId: null }], [], []]);
        expect((await removeCentreFolder({ centreId, folderId, version: 1 })).success).toBe(true);
        expect(predicates[5].sql).toContain('removed_at');
        expect(predicates[5].sql).toContain('is null');
    });
    it('blocks folder creation when retained folder quota is exhausted', async () => {
        const { tx } = fixture([[], [{ count: 100 }]]);
        const result = await createCentreFolder({ centreId, parentId: null, name: 'Policies' });
        expect(result).toMatchObject({ success: false, error: expect.stringContaining('100 folders') });
        expect(tx.insert).not.toHaveBeenCalled();
    });
    it('rejects duplicate active sibling names before creating another folder', async () => {
        const { tx } = fixture([[{ id: folderId }]]);
        const result = await createCentreFolder({ centreId, parentId: null, name: 'POLICIES' });
        expect(result).toMatchObject({ success: false, error: expect.stringContaining('that name') });
        expect(tx.insert).not.toHaveBeenCalled();
    });
    it('rejects path separators before starting the create transaction', async () => {
        expect((await createCentreFolder({ centreId, parentId: null, name: '../Policies' })).success).toBe(false);
        expect(m.transaction).not.toHaveBeenCalled();
    });
});
