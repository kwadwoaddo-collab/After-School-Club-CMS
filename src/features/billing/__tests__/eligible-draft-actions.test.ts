import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    config: vi.fn(), run: vi.fn(), skip: vi.fn(), invoice: vi.fn(), lockedConfig: vi.fn(),
    transaction: vi.fn(), insert: vi.fn(), session: vi.fn(), access: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ requireTenantSession: mocks.session }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: mocks.access }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/data-quality/quarantine', () => ({ assertNotQuarantined: vi.fn() }));
vi.mock('@/lib/enrolment/finance-eligibility', () => ({
    financeEligibleChildSql: vi.fn(), confirmedEnrolmentChildSql: vi.fn(), lifecycleEligibleChildSql: vi.fn(),
    getFinanceEligibleChildIds: vi.fn(async () => new Set(['child-1'])), assertEligibleBillingCoverage: vi.fn(),
    lockEnrolmentForBilling: vi.fn(), lockBillingConfiguration: vi.fn(),
}));
vi.mock('@/db', () => ({ db: {
    query: { billingConfigs: { findFirst: mocks.config }, billingRuns: { findFirst: mocks.run },
        billingCycleSkips: { findFirst: mocks.skip }, invoices: { findFirst: mocks.invoice } },
    transaction: mocks.transaction,
} }));
import { generateEligibleDraftFromConfig, generateInvoiceFromConfig } from '../actions';
const config = {
    id: 'config-1', organisationId: 'org-1', centreId: 'centre-1', parentId: 'parent-1', status: 'active',
    billingAnchorDate: '2026-01-06', invoiceLeadDays: 7, leadTimeUnit: 'DAYS', leadTimeValue: 7,
    agreedMonthlyPence: 190000, paymentDayOfMonth: null,
    children: [{ child: { id: 'child-1', firstName: 'Child', lastName: 'One' } }],
};
const december = { configId: 'config-1', periodStartStr: '2026-12-06', periodEndStr: '2027-01-05', amountPence: 190000 };
describe('eligible draft preparation server boundary', () => {
    beforeEach(() => {
        vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-28T12:00:00Z'));
        mocks.session.mockResolvedValue({ user: { id: 'owner', organisationId: 'org-1', role: 'ORG_OWNER' } });
        mocks.config.mockResolvedValue(config); mocks.skip.mockResolvedValue(null);
        mocks.run.mockResolvedValue({ success: true, invoiceId: 'existing' });
    });
    afterEach(() => vi.useRealTimers());
    it('rejects future periods before their preparation date even if an old invoice exists', async () => {
        await expect(generateEligibleDraftFromConfig(december)).rejects.toThrow('not eligible');
        expect(mocks.run).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('allows the exact preparation date and retains duplicate protection', async () => {
        vi.setSystemTime(new Date('2026-11-29T00:00:00Z'));
        await expect(generateEligibleDraftFromConfig(december)).resolves.toMatchObject({ alreadyGenerated: true, invoiceId: 'existing' });
    });
    it('respects calendar-month lead time and the configured payment day', async () => {
        mocks.config.mockResolvedValue({ ...config, leadTimeUnit: 'CALENDAR_MONTHS', leadTimeValue: 1, paymentDayOfMonth: 10 });
        vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
        await expect(generateEligibleDraftFromConfig(december)).rejects.toThrow('not eligible');
        vi.setSystemTime(new Date('2026-11-10T00:00:00Z'));
        await expect(generateEligibleDraftFromConfig(december)).resolves.toMatchObject({ invoiceId: 'existing' });
    });
    it('rejects completed historical periods even with manual historical confirmation', async () => {
        await expect(generateEligibleDraftFromConfig({ ...december, periodStartStr: '2026-10-06', periodEndStr: '2026-11-05', confirmHistorical: true, historicalReason: 'Reviewed' })).rejects.toThrow('not eligible');
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('keeps explicit manual future generation available', async () => {
        await expect(generateInvoiceFromConfig(december)).resolves.toMatchObject({ invoiceId: 'existing' });
    });
    it('keeps confirmed manual historical generation available', async () => {
        await expect(generateInvoiceFromConfig({ ...december, periodStartStr: '2026-10-06', periodEndStr: '2026-11-05', confirmHistorical: true, historicalReason: 'Reviewed' })).resolves.toMatchObject({ invoiceId: 'existing' });
    });
    it('rechecks changed preparation settings after obtaining the billing lock', async () => {
        vi.setSystemTime(new Date('2026-11-29T12:00:00Z'));
        mocks.run.mockResolvedValue(null); mocks.invoice.mockResolvedValue(null);
        mocks.lockedConfig.mockResolvedValue({ ...config, invoiceLeadDays: 0, leadTimeValue: 0 });
        mocks.transaction.mockImplementation(async callback => callback({
            execute: vi.fn(), query: { billingConfigs: { findFirst: mocks.lockedConfig } }, insert: mocks.insert,
        }));
        await expect(generateEligibleDraftFromConfig(december)).rejects.toThrow('not eligible');
        expect(mocks.lockedConfig).toHaveBeenCalledOnce(); expect(mocks.insert).not.toHaveBeenCalled();
    });
});
