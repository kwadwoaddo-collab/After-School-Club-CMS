import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isQuarantinedParentId,
  isQuarantinedFamily,
  getQuarantineDetails,
  assertNotQuarantined,
  KNOWN_20260716_IMPORT_PARENT_IDS,
} from '@/lib/data-quality/quarantine';
import { createBillingConfig, generateInvoiceFromConfig } from './actions';
import { createInvoice } from '@/features/finance/actions';

// ─── Mocks for Server Actions ───

const mockGetOrgIdAndSession = vi.fn();
const mockRequireTenantSession = vi.fn();
const mockAssertCentreAccess = vi.fn();
const mockGetUserAccessibleCentreIds = vi.fn();

vi.mock('@/lib/session', () => ({
  requireTenantSession: () => mockRequireTenantSession(),
  TypedSession: {},
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: () => mockGetUserAccessibleCentreIds(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockDbFindFirst = vi.fn();
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      centres: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) },
      parents: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) },
      children: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) },
      billingConfigs: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) },
      billingCycleSkips: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) },
      billingRuns: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) },
      invoices: { findFirst: (...args: unknown[]) => mockDbFindFirst(...args) },
    },
    select: () => ({
      from: () => ({
        where: () => [],
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => [{ id: 'mock-config-id' }],
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({
      insert: () => ({
        values: () => ({
          returning: () => [{ id: 'mock-config-id' }],
          onConflictDoNothing: () => Promise.resolve(),
        }),
      }),
      query: {
        invoices: { findFirst: () => null },
        billingCycleSkips: { findFirst: () => null },
        billingRuns: { findFirst: () => null },
      },
    }),
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve({ user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' } }),
}));

describe('DATA-REMEDIATION-1A — Quarantine & Billing Safety Guards (Phase 8)', () => {
  const KNOWN_QUARANTINED_ID = 'ac77f0e1-3c76-4c96-8ca8-4fcfde398e6b'; // Abdi Abdi
  const LEGITIMATE_SINGLE_NAME_PARENT_ID = '33333333-3333-3333-3333-333333333333'; // e.g. Rimante Rimante fixture
  const NATIVE_FAMILY_PARENT_ID = '44444444-4444-4444-4444-444444444444'; // Native registered family

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 10: known 2026-07-16 cohort fixture classified DATA_REVIEW_REQUIRED
  it('Scenario 10: known 2026-07-16 cohort fixture classified DATA_REVIEW_REQUIRED', () => {
    expect(isQuarantinedParentId(KNOWN_QUARANTINED_ID)).toBe(true);
    expect(isQuarantinedFamily(KNOWN_QUARANTINED_ID)).toBe(true);
    const details = getQuarantineDetails(KNOWN_QUARANTINED_ID);
    expect(details?.billingStatus).toBe('DATA_REVIEW_REQUIRED');
    expect(details?.cohortDate).toBe('2026-07-16');
  });

  // Scenario 11: ordinary firstName == lastName family NOT automatically quarantined
  it('Scenario 11: ordinary firstName == lastName family is NOT automatically quarantined', () => {
    expect(isQuarantinedParentId(LEGITIMATE_SINGLE_NAME_PARENT_ID)).toBe(false);
    expect(isQuarantinedFamily(LEGITIMATE_SINGLE_NAME_PARENT_ID)).toBe(false);
    expect(getQuarantineDetails(LEGITIMATE_SINGLE_NAME_PARENT_ID)).toBeNull();
  });

  // Scenario 12: legitimate parent/child with similar names NOT automatically quarantined
  it('Scenario 12: legitimate parent and child with identical/similar names are NOT quarantined', () => {
    const juniorSeniorFixtureId = '55555555-5555-5555-5555-555555555555';
    expect(isQuarantinedParentId(juniorSeniorFixtureId)).toBe(false);
  });

  // Scenario 13: native family without billing config remains NEEDS_SETUP
  it('Scenario 13: native unconfigured family returns false from quarantine check', () => {
    expect(isQuarantinedParentId(NATIVE_FAMILY_PARENT_ID)).toBe(false);
    // Therefore billing query maps them to 'needs_setup' rather than 'data_review_required'
  });

  // Scenario 16: direct server billing-config creation rejected
  it('Scenario 16: direct server billing-config creation rejected with descriptive error', async () => {
    mockRequireTenantSession.mockResolvedValue({
      user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' },
    });
    mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

    await expect(
      createBillingConfig({
        parentId: KNOWN_QUARANTINED_ID,
        centreId: 'centre-1',
        agreedMonthlyPence: 5000,
        billingAnchorDate: '2026-10-01',
        childIds: [],
      })
    ).rejects.toThrow('Billing configuration blocked: Imported family details require verification before billing can be set up.');
  });

  // Scenario 17: direct manual invoice path rejected where applicable
  it('Scenario 17: direct manual invoice creation rejected for quarantined family', async () => {
    mockRequireTenantSession.mockResolvedValue({
      user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' },
    });
    mockDbFindFirst
      .mockResolvedValueOnce({ id: 'centre-1' }) // centreRecord
      .mockResolvedValueOnce({ id: KNOWN_QUARANTINED_ID }); // parentRecord

    await expect(
      createInvoice({
        parentId: KNOWN_QUARANTINED_ID,
        centreId: 'centre-1',
        childIds: [],
        amount: '50.00',
        invoiceDate: new Date(),
        dueDate: new Date(),
      })
    ).rejects.toThrow('Invoice creation blocked: Imported family details require verification before billing can be set up.');
  });

  // Scenario 18: scheduler skip check
  it('Scenario 18: assertNotQuarantined guards invoice generation from config', async () => {
    mockRequireTenantSession.mockResolvedValue({
      user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' },
    });
    mockDbFindFirst.mockResolvedValueOnce({
      id: 'cfg-1',
      parentId: KNOWN_QUARANTINED_ID,
      centreId: 'centre-1',
      status: 'active',
      children: [],
    });

    await expect(
      generateInvoiceFromConfig({
        configId: 'cfg-1',
        periodStartStr: '2026-10-01',
        periodEndStr: '2026-10-31',
      })
    ).rejects.toThrow('Invoice generation blocked: Imported family details require verification before billing can be set up.');
  });

  // Scenario 22: deterministic cohort classifier has exact boundary tests
  it('Scenario 22: exactly 46 parent IDs are quarantined, no more and no less', () => {
    expect(KNOWN_20260716_IMPORT_PARENT_IDS.size).toBe(46);
    // Check known first record and last record of Batch 1 and Batch 2
    expect(isQuarantinedParentId('14087e1b-4bb8-4b10-8289-75f691fb0ad5')).toBe(true); // Row 1: Charlton Charlton
    expect(isQuarantinedParentId('fbfc91a7-a44b-43c2-a5cb-68b2a0957487')).toBe(true); // Row 30: Adebambo Adebambo
    expect(isQuarantinedParentId('ac83e098-2ff7-488c-8a33-443d247f2e4c')).toBe(true); // Row 31: Header artifact
    expect(isQuarantinedParentId('dcd8f505-ed61-4305-9fd4-532d8d76fe87')).toBe(true); // Row 46: Omolola Odunbaku
  });

  // Scenario 23: no generic name-pattern classifier can quarantine unrelated records
  it('Scenario 23: generic name patterns alone cannot trigger quarantine', () => {
    // Single-name parent
    expect(isQuarantinedParentId('some-random-id-123')).toBe(false);
    // Cultural identical names
    expect(isQuarantinedParentId('cultural-identical-name-id')).toBe(false);
  });
});
