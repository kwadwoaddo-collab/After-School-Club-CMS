import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Milestone 3G, L2 regression coverage.
 *
 * Root cause (see project-notes/milestone-3g-finance-audit.md, L2):
 * every mutation in this file previously checked organisation membership
 * only, via a bare session/organisationId check (getOrgId()) — no role or
 * centre check at all. BillingSettingsCard (this module's own UI) is
 * rendered unconditionally inside the frozen Students module's
 * StudentProfile.tsx, which MANAGER/FRONT_DESK can view — so those roles
 * could create/edit/pause/resume/cancel ANY family's recurring billing
 * config org-wide, including centres they have no assignment to, through
 * the real, live UI.
 *
 * The fix applies the same ORG_OWNER-or-centre-check pattern already used
 * by src/features/finance/actions.ts's recordPayment et al. These tests
 * assert: ORG_OWNER always passes; a non-owner with centre access passes;
 * a non-owner without centre access is rejected — for every mutation in
 * the file.
 */

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

const getUserAccessibleCentreIds = vi.fn();
vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIds(...args),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const billingConfigsFindFirst = vi.fn();
const dbUpdate = vi.fn();
const dbInsert = vi.fn();
const dbDelete = vi.fn();
const dbTransaction = vi.fn();

function makeUpdateChain() {
    const chain: any = {
        set: vi.fn(() => chain),
        where: vi.fn().mockResolvedValue(undefined),
    };
    return chain;
}
function makeInsertChain() {
    const chain: any = {
        values: vi.fn(() => chain),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([{ id: 'new-config-1' }]),
    };
    return chain;
}
function makeDeleteChain() {
    const chain: any = {
        where: vi.fn().mockResolvedValue(undefined),
    };
    return chain;
}

vi.mock('@/db', () => ({
    db: {
        query: {
            billingConfigs: { findFirst: (...args: unknown[]) => billingConfigsFindFirst(...args) },
        },
        update: (...args: unknown[]) => dbUpdate(...args),
        insert: (...args: unknown[]) => dbInsert(...args),
        delete: (...args: unknown[]) => dbDelete(...args),
        transaction: (...args: unknown[]) => dbTransaction(...args),
    },
}));

const OWNER_SESSION = { user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' } };
const FRONT_DESK_SESSION = { user: { id: 'user-fd', organisationId: 'org-1', role: 'FRONT_DESK' } };

describe('billing/actions — centre-scoped authorization (Milestone 3G, L2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbUpdate.mockImplementation(() => makeUpdateChain());
        dbInsert.mockImplementation(() => makeInsertChain());
        dbDelete.mockImplementation(() => makeDeleteChain());
        dbTransaction.mockImplementation(async (cb: any) => cb({
            insert: () => makeInsertChain(),
        }));
    });

    describe('createBillingConfig', () => {
        it('rejects a non-owner with no access to the target centre', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
            billingConfigsFindFirst.mockResolvedValue(null); // no existing config

            const { createBillingConfig } = await import('./actions');
            await expect(createBillingConfig({
                parentId: 'parent-1',
                centreId: 'centre-target',
                agreedMonthlyPence: 10000,
                billingAnchorDate: '2026-01-01',
                childIds: ['child-1'],
            })).rejects.toThrow(/Unauthorized/);

            expect(dbTransaction).not.toHaveBeenCalled();
        });

        it('allows ORG_OWNER regardless of centre', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
            billingConfigsFindFirst.mockResolvedValue(null);

            const { createBillingConfig } = await import('./actions');
            const result = await createBillingConfig({
                parentId: 'parent-1',
                centreId: 'centre-target',
                agreedMonthlyPence: 10000,
                billingAnchorDate: '2026-01-01',
                childIds: ['child-1'],
            });

            expect(result.success).toBe(true);
            expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
        });

        it('allows a non-owner with access to the target centre', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-target']);
            billingConfigsFindFirst.mockResolvedValue(null);

            const { createBillingConfig } = await import('./actions');
            const result = await createBillingConfig({
                parentId: 'parent-1',
                centreId: 'centre-target',
                agreedMonthlyPence: 10000,
                billingAnchorDate: '2026-01-01',
                childIds: ['child-1'],
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateBillingConfig / pauseBillingConfig / resumeBillingConfig / cancelBillingConfig', () => {
        it.each([
            ['updateBillingConfig', (mod: any) => mod.updateBillingConfig('config-1', { agreedMonthlyPence: 5000 })],
            ['pauseBillingConfig', (mod: any) => mod.pauseBillingConfig('config-1')],
            ['resumeBillingConfig', (mod: any) => mod.resumeBillingConfig('config-1')],
            ['cancelBillingConfig', (mod: any) => mod.cancelBillingConfig('config-1')],
        ])('%s rejects a non-owner with no access to the config\'s centre', async (_name, invoke) => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
            billingConfigsFindFirst.mockResolvedValue({ centreId: 'centre-target' });

            const mod = await import('./actions');
            await expect(invoke(mod)).rejects.toThrow(/Unauthorized/);
            expect(dbUpdate).not.toHaveBeenCalled();
        });

        it.each([
            ['updateBillingConfig', (mod: any) => mod.updateBillingConfig('config-1', { agreedMonthlyPence: 5000 })],
            ['pauseBillingConfig', (mod: any) => mod.pauseBillingConfig('config-1')],
            ['resumeBillingConfig', (mod: any) => mod.resumeBillingConfig('config-1')],
            ['cancelBillingConfig', (mod: any) => mod.cancelBillingConfig('config-1')],
        ])('%s allows a non-owner with access to the config\'s centre', async (_name, invoke) => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-target']);
            billingConfigsFindFirst.mockResolvedValue({ centreId: 'centre-target' });

            const mod = await import('./actions');
            const result = await invoke(mod);
            expect(result.success).toBe(true);
        });

        it('rejects when the config does not exist under the caller\'s org', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
            billingConfigsFindFirst.mockResolvedValue(null);

            const { pauseBillingConfig } = await import('./actions');
            await expect(pauseBillingConfig('config-1')).rejects.toThrow(/not found/);
        });
    });

    describe('addChildToConfig / removeChildFromConfig', () => {
        it('addChildToConfig rejects a non-owner with no access to the config\'s centre', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
            billingConfigsFindFirst.mockResolvedValue({ centreId: 'centre-target' });

            const { addChildToConfig } = await import('./actions');
            await expect(addChildToConfig('config-1', 'child-2')).rejects.toThrow(/Unauthorized/);
            expect(dbInsert).not.toHaveBeenCalled();
        });

        it('removeChildFromConfig rejects a non-owner with no access to the config\'s centre', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
            billingConfigsFindFirst.mockResolvedValue({ centreId: 'centre-target' });

            const { removeChildFromConfig } = await import('./actions');
            await expect(removeChildFromConfig('config-1', 'child-2')).rejects.toThrow(/Unauthorized/);
            expect(dbDelete).not.toHaveBeenCalled();
        });
    });

    describe('generateInvoiceFromConfig', () => {
        it('rejects a non-owner with no access to the config\'s centre', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
            billingConfigsFindFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-target',
                status: 'active',
                children: [],
            });

            const { generateInvoiceFromConfig } = await import('./actions');
            await expect(generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-01-01',
                periodEndStr: '2026-01-31',
                amountPence: 10000,
            })).rejects.toThrow(/Unauthorized/);

            expect(dbTransaction).not.toHaveBeenCalled();
        });
    });
});
