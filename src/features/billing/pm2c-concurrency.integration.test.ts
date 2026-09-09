import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.ALLOW_TRAINING_SEED = 'true';
process.env.TRAINING_ENVIRONMENT = 'oakridge';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';
import { db } from '@/db';
import {
  organisations,
  centres,
  parents,
  children,
  billingConfigs,
  billingConfigChildren,
  billingRuns,
  invoices,
  invoiceLineItems,
  payments,
  auditEvents,
  users,
  orgMemberships,
  centreMemberships,
} from '@/db/schema';
import { eq, inArray, and, sql, ne } from 'drizzle-orm';
import { generateInvoiceFromConfig, createBillingConfig } from './actions';
import { createInvoice, createAdHocInvoice } from '@/features/finance/actions';
import { POST as billingCronPost } from '@/app/api/cron/billing/route';
import { NextRequest } from 'next/server';

// Mock session user
const mockSessionUser = {
  id: 'a0000000-0000-0000-0000-000000000001',
  role: 'ORG_OWNER',
  organisationId: '',
};

vi.mock('@/lib/session', () => ({
  requireTenantSession: vi.fn(async () => ({
    user: mockSessionUser,
  })),
  getApiSession: vi.fn(async () => ({
    user: mockSessionUser,
  })),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: vi.fn(async () => []),
}));

vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn(),
  emailService: {
    sendInvoiceCreated: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('PM-2C: Real PostgreSQL Billing Concurrency & Invariants Suite', () => {
  const RUN_ID = `pm2c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let trainingHost: string;

  // Track created IDs for guaranteed cleanup across all touched tables
  const createdOrgIds: string[] = [];
  const createdCentreIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdParentIds: string[] = [];
  const createdChildIds: string[] = [];
  const createdConfigIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdLineItemIds: string[] = [];
  const createdOrgMembershipIds: string[] = [];
  const createdCentreMembershipIds: string[] = [];

  beforeAll(async () => {
    const guard = assertSafeTrainingEnvironment();
    trainingHost = guard.host;
    expect(trainingHost).toBe('ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech');
  });

  afterAll(async () => {
    let cleanupError: unknown = null;
    try {
      // 1. Payments
      if (createdPaymentIds.length > 0) {
        await db.delete(payments).where(inArray(payments.id, createdPaymentIds));
      }
      // 2. Invoice line items
      if (createdLineItemIds.length > 0) {
        await db.delete(invoiceLineItems).where(inArray(invoiceLineItems.id, createdLineItemIds));
      }
      if (createdInvoiceIds.length > 0) {
        // Also cleanup any line items or payments attached to created invoices
        await db.delete(payments).where(inArray(payments.invoiceId, createdInvoiceIds));
        await db.delete(invoiceLineItems).where(inArray(invoiceLineItems.invoiceId, createdInvoiceIds));
      }
      // 3. Billing runs
      if (createdConfigIds.length > 0) {
        await db.delete(billingRuns).where(inArray(billingRuns.billingConfigId, createdConfigIds));
      }
      if (createdInvoiceIds.length > 0) {
        await db.delete(billingRuns).where(inArray(billingRuns.invoiceId, createdInvoiceIds));
      }
      // 4. Invoices
      if (createdInvoiceIds.length > 0) {
        await db.delete(invoices).where(inArray(invoices.id, createdInvoiceIds));
      }
      // 5. Billing config children
      if (createdConfigIds.length > 0) {
        await db.delete(billingConfigChildren).where(inArray(billingConfigChildren.configId, createdConfigIds));
      }
      // 6. Billing configs
      if (createdConfigIds.length > 0) {
        await db.delete(billingConfigs).where(inArray(billingConfigs.id, createdConfigIds));
      }
      // 7. Children
      if (createdChildIds.length > 0) {
        await db.delete(children).where(inArray(children.id, createdChildIds));
      }
      // 8. Parents
      if (createdParentIds.length > 0) {
        await db.delete(parents).where(inArray(parents.id, createdParentIds));
      }
      // 9. Centre memberships
      if (createdCentreMembershipIds.length > 0) {
        await db.delete(centreMemberships).where(inArray(centreMemberships.id, createdCentreMembershipIds));
      }
      if (createdCentreIds.length > 0) {
        await db.delete(centreMemberships).where(inArray(centreMemberships.centreId, createdCentreIds));
      }
      // 10. Org memberships
      if (createdOrgMembershipIds.length > 0) {
        await db.delete(orgMemberships).where(inArray(orgMemberships.id, createdOrgMembershipIds));
      }
      if (createdOrgIds.length > 0) {
        await db.delete(orgMemberships).where(inArray(orgMemberships.organisationId, createdOrgIds));
      }
      // 11. Centres
      if (createdCentreIds.length > 0) {
        await db.delete(centres).where(inArray(centres.id, createdCentreIds));
      }
      // 12. Audit events
      if (createdOrgIds.length > 0) {
        await db.delete(auditEvents).where(inArray(auditEvents.organisationId, createdOrgIds));
      }
      // 13. Users
      if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
      // 14. Organisations
      if (createdOrgIds.length > 0) {
        await db.delete(organisations).where(inArray(organisations.id, createdOrgIds));
      }
    } catch (err) {
      cleanupError = err;
      console.error('Error during PM-2C test cleanup:', err);
    }

    if (createdOrgIds.length > 0) {
      const remainingOrgs = await db
        .select({ id: organisations.id })
        .from(organisations)
        .where(inArray(organisations.id, createdOrgIds));
      expect(remainingOrgs).toHaveLength(0);
    }
    if (cleanupError) {
      throw new Error(`[CRITICAL] Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function createSyntheticTenant(prefix: string) {
    const slug = `${RUN_ID}_${prefix}_${Math.random().toString(36).substring(2, 6)}`;
    const [org] = await db
      .insert(organisations)
      .values({
        name: `Synthetic Org ${slug}`,
        slug,
        contactEmail: `${slug}@example.com`,
      })
      .returning();
    createdOrgIds.push(org.id);

    const [user] = await db
      .insert(users)
      .values({
        organisationId: org.id,
        email: `owner_${slug}@example.com`,
        firstName: 'Owner',
        lastName: `Tenant_${prefix}`,
        role: 'ORG_OWNER',
      })
      .returning();
    createdUserIds.push(user.id);

    const [centre] = await db
      .insert(centres)
      .values({
        organisationId: org.id,
        name: `Synthetic Centre ${slug}`,
        slug: `centre_${slug}`,
      })
      .returning();
    createdCentreIds.push(centre.id);

    return { org, centre, user };
  }

  async function createSyntheticFamily(orgId: string, centreId: string, prefix: string) {
    const uniqueEmail = `${RUN_ID}_${prefix}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [parent] = await db
      .insert(parents)
      .values({
        organisationId: orgId,
        firstName: 'TestParent',
        lastName: `Family_${prefix}`,
        email: uniqueEmail,
        phone: '07123456789',
        preferredContact: 'email',
      })
      .returning();
    createdParentIds.push(parent.id);

    const [child] = await db
      .insert(children)
      .values({
        organisationId: orgId,
        centreId,
        parentId: parent.id,
        firstName: 'Child',
        lastName: `Family_${prefix}`,
        schoolYear: 'Year 3',
      })
      .returning();
    createdChildIds.push(child.id);

    const [config] = await db
      .insert(billingConfigs)
      .values({
        organisationId: orgId,
        centreId,
        parentId: parent.id,
        agreedMonthlyPence: 15000, // £150.00
        billingAnchorDate: '2026-09-01',
        invoiceLeadDays: 7,
        status: 'active',
      })
      .returning();
    createdConfigIds.push(config.id);

    await db.insert(billingConfigChildren).values({
      configId: config.id,
      childId: child.id,
    });

    return { parent, child, config };
  }

  it('C1: Sequential automated invoice generation creates exactly one invoice and returns idempotent success on retry', async () => {
    const { org, centre, user } = await createSyntheticTenant('c1');
    const { config } = await createSyntheticFamily(org.id, centre.id, 'c1');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const res1 = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2026-09-01',
      periodEndStr: '2026-09-30',
      amountPence: 15000,
    });
    expect(res1.success).toBe(true);
    expect(res1.invoiceId).toBeDefined();
    createdInvoiceIds.push(res1.invoiceId);

    // Second call should return idempotent success without error
    const res2 = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2026-09-01',
      periodEndStr: '2026-09-30',
      amountPence: 15000,
    });
    expect(res2.success).toBe(true);
    expect(res2.invoiceId).toBe(res1.invoiceId);
    expect(res2.alreadyGenerated).toBe(true);

    const invoicesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.billingConfigId, config.id));
    expect(invoicesCount[0].count).toBe(1);
  });

  it('C2: Two concurrent automated invocations for same config & period cleanly serialize with exactly 1 committed invoice', async () => {
    const { org, centre, user } = await createSyntheticTenant('c2');
    const { config } = await createSyntheticFamily(org.id, centre.id, 'c2');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const [res1, res2] = await Promise.all([
      generateInvoiceFromConfig({
        configId: config.id,
        periodStartStr: '2026-10-01',
        periodEndStr: '2026-10-31',
        amountPence: 15000,
      }),
      generateInvoiceFromConfig({
        configId: config.id,
        periodStartStr: '2026-10-01',
        periodEndStr: '2026-10-31',
        amountPence: 15000,
      }),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.invoiceId).toBe(res2.invoiceId);
    createdInvoiceIds.push(res1.invoiceId);

    const invoicesInDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.billingConfigId, config.id));
    expect(invoicesInDb).toHaveLength(1);
  });

  it('C3: 10-way concurrent automated contention burst produces exactly 1 committed invoice and 0 raw errors', async () => {
    const { org, centre, user } = await createSyntheticTenant('c3');
    const { config } = await createSyntheticFamily(org.id, centre.id, 'c3');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const promises = Array.from({ length: 10 }, () =>
      generateInvoiceFromConfig({
        configId: config.id,
        periodStartStr: '2026-11-01',
        periodEndStr: '2026-11-30',
        amountPence: 15000,
      })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    const invoiceIds = new Set(results.map((r) => r.invoiceId));
    expect(invoiceIds.size).toBe(1);
    createdInvoiceIds.push(results[0].invoiceId);

    const invoicesInDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.billingConfigId, config.id));
    expect(invoicesInDb).toHaveLength(1);
  });

  it('C4/C5: Concurrent manual createInvoice with recurring billing period rejects second invoice and creates exactly 1 invoice', async () => {
    const { org, centre, user } = await createSyntheticTenant('c4');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'c4');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const periodDate = new Date('2026-12-01T00:00:00Z');

    const results = await Promise.allSettled([
      createInvoice({
        centreId: centre.id,
        parentId: parent.id,
        childIds: [child.id],
        amount: '150.00',
        invoiceDate: new Date(),
        dueDate: periodDate,
        billingPeriodStart: periodDate,
        billingPeriodEnd: new Date('2026-12-31T00:00:00Z'),
      }),
      createInvoice({
        centreId: centre.id,
        parentId: parent.id,
        childIds: [child.id],
        amount: '150.00',
        invoiceDate: new Date(),
        dueDate: periodDate,
        billingPeriodStart: periodDate,
        billingPeriodEnd: new Date('2026-12-31T00:00:00Z'),
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (fulfilled[0].status === 'fulfilled') {
      createdInvoiceIds.push((fulfilled[0].value as any).id);
    }

    const inDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.parentId, parent.id),
          eq(invoices.billingPeriodStart, periodDate)
        )
      );
    expect(inDb).toHaveLength(1);
  });

  it('C6/C7: Interleaved manual invoice creation prevents subsequent automated duplicate generation', async () => {
    const { org, centre, user } = await createSyntheticTenant('c6');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'c6');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const periodDate = new Date('2027-01-01T00:00:00Z');

    // 1. Manual invoice created first
    const manualInvoice = await createInvoice({
      centreId: centre.id,
      parentId: parent.id,
      childIds: [child.id],
      amount: '150.00',
      invoiceDate: new Date(),
      dueDate: periodDate,
      billingPeriodStart: periodDate,
      billingPeriodEnd: new Date('2027-01-31T00:00:00Z'),
    });
    createdInvoiceIds.push(manualInvoice.id);

    // 2. Automated invoice generation runs for the same period
    const autoRes = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-01-01',
      periodEndStr: '2027-01-31',
      amountPence: 15000,
    });

    expect(autoRes.success).toBe(true);
    expect(autoRes.invoiceId).toBe(manualInvoice.id);
    expect(autoRes.alreadyGenerated).toBe(true);

    const inDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.parentId, parent.id),
          eq(invoices.billingPeriodStart, periodDate)
        )
      );
    expect(inDb).toHaveLength(1);
  });

  it('C13: Voiding an invoice allows a legitimate replacement reissue for the same period', async () => {
    const { org, centre, user } = await createSyntheticTenant('c13');
    const { config } = await createSyntheticFamily(org.id, centre.id, 'c13');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    // 1. Generate first invoice
    const res1 = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-02-01',
      periodEndStr: '2027-02-28',
      amountPence: 15000,
    });
    createdInvoiceIds.push(res1.invoiceId);

    // 2. Void the first invoice and remove the billing run so reissue is permitted
    await db
      .update(invoices)
      .set({ status: 'void' })
      .where(eq(invoices.id, res1.invoiceId));

    await db
      .delete(billingRuns)
      .where(
        and(
          eq(billingRuns.billingConfigId, config.id),
          eq(billingRuns.periodStart, '2027-02-01')
        )
      );

    // 3. Reissue for the exact same period
    const res2 = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-02-01',
      periodEndStr: '2027-02-28',
      amountPence: 15000,
    });
    expect(res2.success).toBe(true);
    expect(res2.invoiceId).not.toBe(res1.invoiceId);
    createdInvoiceIds.push(res2.invoiceId);

    // 4. Verify DB has exactly 2 invoices: 1 void, 1 active draft
    const inDb = await db
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.billingConfigId, config.id));
    expect(inDb).toHaveLength(2);
    expect(inDb.find((inv) => inv.id === res1.invoiceId)?.status).toBe('void');
    expect(inDb.find((inv) => inv.id === res2.invoiceId)?.status).toBe('draft');
  });

  it('C17: Cross-tenant isolation allows distinct organisations to bill the identical period simultaneously', async () => {
    const tenantA = await createSyntheticTenant('c17_a');
    const familyA = await createSyntheticFamily(tenantA.org.id, tenantA.centre.id, 'c17_a');

    const tenantB = await createSyntheticTenant('c17_b');
    const familyB = await createSyntheticFamily(tenantB.org.id, tenantB.centre.id, 'c17_b');

    mockSessionUser.id = tenantA.user.id;
    mockSessionUser.organisationId = tenantA.org.id;
    const resA = await generateInvoiceFromConfig({
      configId: familyA.config.id,
      periodStartStr: '2027-03-01',
      periodEndStr: '2027-03-31',
      amountPence: 15000,
    });

    mockSessionUser.id = tenantB.user.id;
    mockSessionUser.organisationId = tenantB.org.id;
    const resB = await generateInvoiceFromConfig({
      configId: familyB.config.id,
      periodStartStr: '2027-03-01',
      periodEndStr: '2027-03-31',
      amountPence: 15000,
    });

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    expect(resA.invoiceId).not.toBe(resB.invoiceId);
    createdInvoiceIds.push(resA.invoiceId, resB.invoiceId);

    const invA = await db.query.invoices.findFirst({ where: eq(invoices.id, resA.invoiceId) });
    const invB = await db.query.invoices.findFirst({ where: eq(invoices.id, resB.invoiceId) });
    expect(invA?.organisationId).toBe(tenantA.org.id);
    expect(invB?.organisationId).toBe(tenantB.org.id);
  });

  /**
   * C15 Taxonomy Note (PM-2C.R2):
   * CLASSIFICATION: PROVEN — REAL POSTGRES TRANSACTION ROLLBACK
   * LIMITATION: REAL BILLING-PATH POST-INSERT FAULT INJECTION — NOT VERIFIED
   *
   * This test proves that PostgreSQL atomicity via Drizzle transaction guarantees zero orphan
   * invoice rows when a transaction aborts post-insert. It validates the engine-level transactional
   * rollback mechanism, not a synthetic monkey-patched runtime fault in generateInvoiceFromConfig.
   */
  it('C15: [Real Postgres Transaction Rollback] Rollback atomicity guarantees zero orphan invoice rows if a transaction aborts', async () => {
    const { org, centre, user } = await createSyntheticTenant('c15');
    const { config } = await createSyntheticFamily(org.id, centre.id, 'c15');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    // Simulate an aborted transaction where invoice is inserted but the transaction fails
    let caughtError: unknown = null;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(invoices).values({
          organisationId: org.id,
          centreId: centre.id,
          parentId: config.parentId,
          invoiceNumber: `INV-ABORT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          amount: '150.00',
          status: 'draft',
          invoiceDate: new Date(),
          dueDate: new Date('2027-04-01'),
          billingPeriodStart: new Date('2027-04-01'),
          billingPeriodEnd: new Date('2027-04-30'),
          billingConfigId: config.id,
        }).returning();

        // Intentionally throw inside transaction
        throw new Error('Simulated atomic failure post-invoice insert');
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();

    // Verify 0 invoices exist in DB for this period
    const inDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.billingConfigId, config.id),
          eq(invoices.billingPeriodStart, new Date('2027-04-01'))
        )
      );
    expect(inDb).toHaveLength(0);
  });

  it('C20: Multi-child family config correctly records covered children and links billingConfigId', async () => {
    const { org, centre, user } = await createSyntheticTenant('c20');
    const { parent, child: child1, config } = await createSyntheticFamily(org.id, centre.id, 'c20');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    // Add sibling to the family
    const [child2] = await db
      .insert(children)
      .values({
        organisationId: org.id,
        centreId: centre.id,
        parentId: parent.id,
        firstName: 'Sibling',
        lastName: 'Family_c20',
        schoolYear: 'Year 5',
      })
      .returning();
    createdChildIds.push(child2.id);

    await db.insert(billingConfigChildren).values({
      configId: config.id,
      childId: child2.id,
    });

    const res = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-05-01',
      periodEndStr: '2027-05-31',
      amountPence: 28000,
    });
    expect(res.success).toBe(true);
    createdInvoiceIds.push(res.invoiceId);

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, res.invoiceId),
    });
    expect(invoice).toBeDefined();
    expect(invoice?.billingConfigId).toBe(config.id);
    expect(invoice?.coveredChildrenJson).toBeDefined();
    const covered = invoice?.coveredChildrenJson as Array<{ id: string; name: string }>;
    expect(covered).toHaveLength(2);
    expect(covered.map((c) => c.id).sort()).toEqual([child1.id, child2.id].sort());
  });

  it('R10: Ad-hoc invoice creation does not satisfy recurring obligation nor block monthly billing config generation', async () => {
    const { org, centre, user } = await createSyntheticTenant('r10');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'r10');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const periodDate = new Date('2027-06-01T00:00:00Z');

    // 1. Staff creates a £25 ad-hoc charge for the family (e.g. uniform fee)
    const adHocInv = await createAdHocInvoice({
      centreId: centre.id,
      parentId: parent.id,
      childName: `${child.firstName} ${child.lastName}`,
      amount: '25.00',
      invoiceDate: new Date(),
      dueDate: new Date('2027-06-07T00:00:00Z'),
      billingPeriodStart: periodDate,
      billingPeriodEnd: new Date('2027-06-30T00:00:00Z'),
      notes: 'Uniform fee',
    });
    expect(adHocInv).toBeDefined();
    expect(adHocInv.billingConfigId).toBeNull();
    createdInvoiceIds.push(adHocInv.id);

    // 2. Automated / recurring generation runs for the family's £150 agreed monthly fee
    const recurringRes = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-06-01',
      periodEndStr: '2027-06-30',
      amountPence: 15000,
    });
    expect(recurringRes.success).toBe(true);
    expect(recurringRes.alreadyGenerated).toBe(false);
    expect(recurringRes.invoiceId).not.toBe(adHocInv.id);
    createdInvoiceIds.push(recurringRes.invoiceId);

    // 3. Verify both invoices exist in DB: 1 ad-hoc (£25, config null) and 1 recurring (£150, config linked)
    const allInvoices = await db
      .select({ id: invoices.id, amount: invoices.amount, billingConfigId: invoices.billingConfigId })
      .from(invoices)
      .where(
        and(
          eq(invoices.parentId, parent.id),
          eq(invoices.billingPeriodStart, periodDate)
        )
      );
    expect(allInvoices).toHaveLength(2);
    const adHocRow = allInvoices.find((inv) => inv.id === adHocInv.id);
    const recurringRow = allInvoices.find((inv) => inv.id === recurringRes.invoiceId);
    expect(adHocRow?.billingConfigId).toBeNull();
    expect(adHocRow?.amount).toBe('25.00');
    expect(recurringRow?.billingConfigId).toBe(config.id);
    expect(recurringRow?.amount).toBe('150.00');
  });

  it('R11: Multiple legitimate ad-hoc invoices in the same month both succeed without collision', async () => {
    const { org, centre, user } = await createSyntheticTenant('r11');
    const { parent, child } = await createSyntheticFamily(org.id, centre.id, 'r11');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const periodDate = new Date('2027-07-01T00:00:00Z');

    // 1. First ad-hoc: uniform fee
    const inv1 = await createAdHocInvoice({
      centreId: centre.id,
      parentId: parent.id,
      childName: `${child.firstName} ${child.lastName}`,
      amount: '30.00',
      invoiceDate: new Date(),
      dueDate: new Date('2027-07-07T00:00:00Z'),
      billingPeriodStart: periodDate,
      billingPeriodEnd: new Date('2027-07-31T00:00:00Z'),
      notes: 'Uniform purchase',
    });
    createdInvoiceIds.push(inv1.id);

    // 2. Second ad-hoc: late fee
    const inv2 = await createAdHocInvoice({
      centreId: centre.id,
      parentId: parent.id,
      childName: `${child.firstName} ${child.lastName}`,
      amount: '15.00',
      invoiceDate: new Date(),
      dueDate: new Date('2027-07-14T00:00:00Z'),
      billingPeriodStart: periodDate,
      billingPeriodEnd: new Date('2027-07-31T00:00:00Z'),
      notes: 'Late collection fee',
    });
    createdInvoiceIds.push(inv2.id);

    expect(inv1.id).not.toBe(inv2.id);

    // Verify both committed cleanly in DB
    const adHocInDb = await db
      .select({ id: invoices.id, amount: invoices.amount, notes: invoices.notes })
      .from(invoices)
      .where(
        and(
          eq(invoices.parentId, parent.id),
          eq(invoices.billingPeriodStart, periodDate),
          sql`${invoices.billingConfigId} IS NULL`
        )
      );
    expect(adHocInDb).toHaveLength(2);
    expect(adHocInDb.map((i) => i.amount).sort()).toEqual(['15.00', '30.00'].sort());
  });

  it('R12: POST /api/cron/billing route handler skips existing active invoice and records billing_run idempotently', async () => {
    const { org, centre, user } = await createSyntheticTenant('r12');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'r12');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    // Set billing config anchor and lead days so cron considers it due today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Anchor on the 1st of next month
    const nextMonthYear = today.getUTCMonth() === 11 ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
    const nextMonth = today.getUTCMonth() === 11 ? 1 : today.getUTCMonth() + 2;
    const nextMonthFirst = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1));
    const anchorStr = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

    // Calculate exact days between today and next month 1st
    const diffDays = Math.round((nextMonthFirst.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const leadDays = diffDays; // invoiceDate = nextMonthFirst - diffDays = today!

    await db
      .update(billingConfigs)
      .set({
        billingAnchorDate: anchorStr,
        invoiceLeadDays: leadDays,
      })
      .where(eq(billingConfigs.id, config.id));

    // Determine the expected period from computeNextBillingPeriod
    const { computeNextBillingPeriod } = await import('@/lib/billing');
    const period = computeNextBillingPeriod(
      { billingAnchorDate: new Date(`${anchorStr}T00:00:00Z`), invoiceLeadDays: leadDays },
      today
    );

    // 1. Manually create the invoice ahead of cron
    const manualInvoice = await createInvoice({
      centreId: centre.id,
      parentId: parent.id,
      childIds: [child.id],
      amount: '150.00',
      invoiceDate: new Date(),
      dueDate: period.dueDate,
      billingPeriodStart: period.periodStart,
      billingPeriodEnd: period.periodEnd,
      notes: 'Pre-issued manual tuition',
    });
    createdInvoiceIds.push(manualInvoice.id);

    // 2. Call real POST /api/cron/billing with valid secret
    const cronSecret = 'test-cron-secret-pm2c';
    const origSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = cronSecret;

    try {
      const req = new NextRequest('http://localhost:3000/api/cron/billing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cronSecret}`,
        },
      });

      const response = await billingCronPost(req);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.processed).toBeGreaterThanOrEqual(1);
      expect(data.skipped_already_exists).toBeGreaterThanOrEqual(1);

      // Verify no duplicate invoice was created for this config & period
      const inDb = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.billingConfigId, config.id),
            eq(invoices.billingPeriodStart, period.periodStart)
          )
        );
      expect(inDb).toHaveLength(1);
      expect(inDb[0].id).toBe(manualInvoice.id);
    } finally {
      process.env.CRON_SECRET = origSecret;
    }
  });

  it('R13: POST /api/cron/billing route handler enforces security rejection on missing/invalid CRON_SECRET', async () => {
    const origSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'valid-secret-123';

    try {
      // 1. Missing Authorization header
      const req1 = new NextRequest('http://localhost:3000/api/cron/billing', {
        method: 'POST',
      });
      const res1 = await billingCronPost(req1);
      expect(res1.status).toBe(401);

      // 2. Incorrect Authorization Bearer token
      const req2 = new NextRequest('http://localhost:3000/api/cron/billing', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      });
      const res2 = await billingCronPost(req2);
      expect(res2.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = origSecret;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PM-2C.R2: Additional Collision Directions (R14 – R17)
  // ═══════════════════════════════════════════════════════════════════════════

  it('R14: Automated recurring invoice FIRST, manual recurring invoice SECOND rejects cleanly with exactly 1 active invoice', async () => {
    const { org, centre, user } = await createSyntheticTenant('r14');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'r14');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const periodDate = new Date('2027-08-01T00:00:00Z');

    // 1. Automated invoice generated first
    const autoRes = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-08-01',
      periodEndStr: '2027-08-31',
      amountPence: 15000,
    });
    expect(autoRes.success).toBe(true);
    expect(autoRes.invoiceId).toBeDefined();
    createdInvoiceIds.push(autoRes.invoiceId);

    // 2. Manual createInvoice attempted for identical family, centre and billingPeriodStart
    let manualError: Error | null = null;
    try {
      await createInvoice({
        centreId: centre.id,
        parentId: parent.id,
        childIds: [child.id],
        amount: '150.00',
        invoiceDate: new Date(),
        dueDate: periodDate,
        billingPeriodStart: periodDate,
        billingPeriodEnd: new Date('2027-08-31T00:00:00Z'),
        notes: 'Manual attempt after automated already issued',
      });
    } catch (err: any) {
      manualError = err;
    }

    expect(manualError).toBeDefined();
    expect(manualError?.message).toContain('An active invoice already exists for this family and billing period');

    // 3. Verify exactly 1 active invoice exists in the database
    const inDb = await db
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(
        and(
          eq(invoices.billingConfigId, config.id),
          eq(invoices.billingPeriodStart, periodDate)
        )
      );
    expect(inDb).toHaveLength(1);
    expect(inDb[0].id).toBe(autoRes.invoiceId);
    expect(inDb[0].status).toBe('draft');
  });

  it('R15: Manual recurring invoice FIRST, automated generation SECOND returns alreadyGenerated and leaves balance unduplicated', async () => {
    const { org, centre, user } = await createSyntheticTenant('r15');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'r15');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const periodDate = new Date('2027-09-01T00:00:00Z');

    // 1. Manual invoice created first
    const manualInvoice = await createInvoice({
      centreId: centre.id,
      parentId: parent.id,
      childIds: [child.id],
      amount: '150.00',
      invoiceDate: new Date(),
      dueDate: periodDate,
      billingPeriodStart: periodDate,
      billingPeriodEnd: new Date('2027-09-30T00:00:00Z'),
      notes: 'Manual tuition advance',
    });
    createdInvoiceIds.push(manualInvoice.id);

    // 2. Automated generator called for the same config & period
    const autoRes = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-09-01',
      periodEndStr: '2027-09-30',
      amountPence: 15000,
    });

    expect(autoRes.success).toBe(true);
    expect(autoRes.alreadyGenerated).toBe(true);
    expect(autoRes.invoiceId).toBe(manualInvoice.id);

    // 3. Verify exactly 1 invoice exists and total invoiced sum is £150.00 (not £300.00)
    const inDb = await db
      .select({ id: invoices.id, amount: invoices.amount })
      .from(invoices)
      .where(
        and(
          eq(invoices.parentId, parent.id),
          eq(invoices.billingPeriodStart, periodDate),
          ne(invoices.status, 'void')
        )
      );
    expect(inDb).toHaveLength(1);
    expect(inDb[0].id).toBe(manualInvoice.id);
    expect(Number(inDb[0].amount)).toBe(150.00);
  });

  it('R16: Genuinely concurrent manual createInvoice and automated generateInvoiceFromConfig produce exactly 1 active invoice and 0 raw 23505 errors', async () => {
    const { org, centre, user } = await createSyntheticTenant('r16');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'r16');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const periodDate = new Date('2027-10-01T00:00:00Z');

    // Concurrently fire manual createInvoice and automated generateInvoiceFromConfig
    const [manualOutcome, autoOutcome] = await Promise.allSettled([
      createInvoice({
        centreId: centre.id,
        parentId: parent.id,
        childIds: [child.id],
        amount: '150.00',
        invoiceDate: new Date(),
        dueDate: periodDate,
        billingPeriodStart: periodDate,
        billingPeriodEnd: new Date('2027-10-31T00:00:00Z'),
        notes: 'Race manual invoice',
      }),
      generateInvoiceFromConfig({
        configId: config.id,
        periodStartStr: '2027-10-01',
        periodEndStr: '2027-10-31',
        amountPence: 15000,
      }),
    ]);

    // Check that neither call threw an unhandled raw PostgreSQL 23505 duplicate key exception
    if (manualOutcome.status === 'rejected') {
      expect(manualOutcome.reason.message).not.toMatch(/duplicate key value violates unique constraint/i);
      expect(manualOutcome.reason.message).toContain('already exists');
    } else {
      createdInvoiceIds.push(manualOutcome.value.id);
    }

    if (autoOutcome.status === 'rejected') {
      expect(autoOutcome.reason.message).not.toMatch(/duplicate key value violates unique constraint/i);
    } else {
      expect(autoOutcome.value.success).toBe(true);
      createdInvoiceIds.push(autoOutcome.value.invoiceId);
    }

    // Crucial invariant: Exactly 1 invoice committed in database
    const inDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.billingConfigId, config.id),
          eq(invoices.billingPeriodStart, periodDate),
          ne(invoices.status, 'void')
        )
      );
    expect(inDb).toHaveLength(1);
  });

  it('R17: Genuinely concurrent manual createInvoice and billing cron route produce exactly 1 active invoice and clean billing_run state', async () => {
    const { org, centre, user } = await createSyntheticTenant('r17');
    const { parent, child, config } = await createSyntheticFamily(org.id, centre.id, 'r17');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    // Configure config for today's cron trigger
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const nextMonthYear = today.getUTCMonth() === 11 ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
    const nextMonth = today.getUTCMonth() === 11 ? 1 : today.getUTCMonth() + 2;
    const nextMonthFirst = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1));
    const anchorStr = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const diffDays = Math.round((nextMonthFirst.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const leadDays = diffDays;

    await db
      .update(billingConfigs)
      .set({
        billingAnchorDate: anchorStr,
        invoiceLeadDays: leadDays,
      })
      .where(eq(billingConfigs.id, config.id));

    const { computeNextBillingPeriod } = await import('@/lib/billing');
    const period = computeNextBillingPeriod(
      { billingAnchorDate: new Date(`${anchorStr}T00:00:00Z`), invoiceLeadDays: leadDays },
      today
    );

    const cronSecret = 'test-cron-secret-pm2c-r17';
    const origSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = cronSecret;

    try {
      const cronReq = new NextRequest('http://localhost:3000/api/cron/billing', {
        method: 'POST',
        headers: { authorization: `Bearer ${cronSecret}` },
      });

      const [manualRes, cronRes] = await Promise.allSettled([
        createInvoice({
          centreId: centre.id,
          parentId: parent.id,
          childIds: [child.id],
          amount: '150.00',
          invoiceDate: new Date(),
          dueDate: period.dueDate,
          billingPeriodStart: period.periodStart,
          billingPeriodEnd: period.periodEnd,
          notes: 'Concurrent manual with cron',
        }),
        billingCronPost(cronReq),
      ]);

      if (manualRes.status === 'fulfilled') {
        createdInvoiceIds.push(manualRes.value.id);
      }

      // Exactly 1 non-void invoice exists in database
      const inDb = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.billingConfigId, config.id),
            eq(invoices.billingPeriodStart, period.periodStart),
            ne(invoices.status, 'void')
          )
        );
      expect(inDb).toHaveLength(1);

      // Verify billing_run state is uncorrupted (at most 1 successful run for this period)
      const periodStartStr = period.periodStart.toISOString().split('T')[0];
      const runs = await db
        .select({ id: billingRuns.id, success: billingRuns.success })
        .from(billingRuns)
        .where(
          and(
            eq(billingRuns.billingConfigId, config.id),
            eq(billingRuns.periodStart, periodStartStr)
          )
        );
      expect(runs.length).toBeLessThanOrEqual(1);
    } finally {
      process.env.CRON_SECRET = origSecret;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PM-2C.R2: Semantic Separation Matrix (R18 – R22)
  // ═══════════════════════════════════════════════════════════════════════════

  it('R18: Same billing config, different billing period allows distinct invoices', async () => {
    const { org, centre, user } = await createSyntheticTenant('r18');
    const { config } = await createSyntheticFamily(org.id, centre.id, 'r18');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const resP1 = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-11-01',
      periodEndStr: '2027-11-30',
      amountPence: 15000,
    });
    const resP2 = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2027-12-01',
      periodEndStr: '2027-12-31',
      amountPence: 15000,
    });

    expect(resP1.success).toBe(true);
    expect(resP2.success).toBe(true);
    expect(resP1.invoiceId).not.toBe(resP2.invoiceId);
    createdInvoiceIds.push(resP1.invoiceId, resP2.invoiceId);

    const inDb = await db
      .select({ id: invoices.id, billingPeriodStart: invoices.billingPeriodStart })
      .from(invoices)
      .where(eq(invoices.billingConfigId, config.id));
    expect(inDb).toHaveLength(2);
  });

  it('R19: Same parent, different centres creates distinct billing configs and allows independent invoices', async () => {
    const { org, centre: centreA, user } = await createSyntheticTenant('r19');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    // Create Centre B in same organisation
    const slugB = `${RUN_ID}_r19_b_${Math.random().toString(36).substring(2, 6)}`;
    const [centreB] = await db
      .insert(centres)
      .values({
        organisationId: org.id,
        name: `Synthetic Centre B ${slugB}`,
        slug: `centre_${slugB}`,
      })
      .returning();
    createdCentreIds.push(centreB.id);

    // Parent belongs to org
    const uniqueEmail = `${RUN_ID}_r19_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [parent] = await db
      .insert(parents)
      .values({
        organisationId: org.id,
        firstName: 'DualCentre',
        lastName: 'Parent',
        email: uniqueEmail,
        preferredContact: 'email',
      })
      .returning();
    createdParentIds.push(parent.id);

    // Child 1 at Centre A
    const [childA] = await db
      .insert(children)
      .values({
        organisationId: org.id,
        centreId: centreA.id,
        parentId: parent.id,
        firstName: 'ChildA',
        lastName: 'Family',
        schoolYear: 'Year 4',
      })
      .returning();
    createdChildIds.push(childA.id);

    // Child 2 at Centre B
    const [childB] = await db
      .insert(children)
      .values({
        organisationId: org.id,
        centreId: centreB.id,
        parentId: parent.id,
        firstName: 'ChildB',
        lastName: 'Family',
        schoolYear: 'Year 6',
      })
      .returning();
    createdChildIds.push(childB.id);

    // Config A
    const [configA] = await db
      .insert(billingConfigs)
      .values({
        organisationId: org.id,
        centreId: centreA.id,
        parentId: parent.id,
        agreedMonthlyPence: 12000,
        billingAnchorDate: '2028-01-01',
        status: 'active',
      })
      .returning();
    createdConfigIds.push(configA.id);
    await db.insert(billingConfigChildren).values({ configId: configA.id, childId: childA.id });

    // Config B
    const [configB] = await db
      .insert(billingConfigs)
      .values({
        organisationId: org.id,
        centreId: centreB.id,
        parentId: parent.id,
        agreedMonthlyPence: 16000,
        billingAnchorDate: '2028-01-01',
        status: 'active',
      })
      .returning();
    createdConfigIds.push(configB.id);
    await db.insert(billingConfigChildren).values({ configId: configB.id, childId: childB.id });

    // Generate invoices for both configs for the same period
    const resA = await generateInvoiceFromConfig({
      configId: configA.id,
      periodStartStr: '2028-01-01',
      periodEndStr: '2028-01-31',
      amountPence: 12000,
    });
    const resB = await generateInvoiceFromConfig({
      configId: configB.id,
      periodStartStr: '2028-01-01',
      periodEndStr: '2028-01-31',
      amountPence: 16000,
    });

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    expect(resA.invoiceId).not.toBe(resB.invoiceId);
    createdInvoiceIds.push(resA.invoiceId, resB.invoiceId);

    const invA = await db.query.invoices.findFirst({ where: eq(invoices.id, resA.invoiceId) });
    const invB = await db.query.invoices.findFirst({ where: eq(invoices.id, resB.invoiceId) });
    expect(invA?.centreId).toBe(centreA.id);
    expect(invB?.centreId).toBe(centreB.id);
  });

  it('R20: Different parents, same centre and same billing period allows distinct invoices', async () => {
    const { org, centre, user } = await createSyntheticTenant('r20');
    const family1 = await createSyntheticFamily(org.id, centre.id, 'r20_f1');
    const family2 = await createSyntheticFamily(org.id, centre.id, 'r20_f2');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    const res1 = await generateInvoiceFromConfig({
      configId: family1.config.id,
      periodStartStr: '2028-02-01',
      periodEndStr: '2028-02-28',
      amountPence: 15000,
    });
    const res2 = await generateInvoiceFromConfig({
      configId: family2.config.id,
      periodStartStr: '2028-02-01',
      periodEndStr: '2028-02-28',
      amountPence: 15000,
    });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.invoiceId).not.toBe(res2.invoiceId);
    createdInvoiceIds.push(res1.invoiceId, res2.invoiceId);

    const inv1 = await db.query.invoices.findFirst({ where: eq(invoices.id, res1.invoiceId) });
    const inv2 = await db.query.invoices.findFirst({ where: eq(invoices.id, res2.invoiceId) });
    expect(inv1?.parentId).toBe(family1.parent.id);
    expect(inv2?.parentId).toBe(family2.parent.id);
  });

  it('R21: Different organisations with identical periods and amounts remain completely isolated', async () => {
    const tenant1 = await createSyntheticTenant('r21_t1');
    const family1 = await createSyntheticFamily(tenant1.org.id, tenant1.centre.id, 'r21_f1');

    const tenant2 = await createSyntheticTenant('r21_t2');
    const family2 = await createSyntheticFamily(tenant2.org.id, tenant2.centre.id, 'r21_f2');

    // Tenant 1 generates
    mockSessionUser.id = tenant1.user.id;
    mockSessionUser.organisationId = tenant1.org.id;
    const res1 = await generateInvoiceFromConfig({
      configId: family1.config.id,
      periodStartStr: '2028-03-01',
      periodEndStr: '2028-03-31',
      amountPence: 20000,
    });

    // Tenant 2 generates
    mockSessionUser.id = tenant2.user.id;
    mockSessionUser.organisationId = tenant2.org.id;
    const res2 = await generateInvoiceFromConfig({
      configId: family2.config.id,
      periodStartStr: '2028-03-01',
      periodEndStr: '2028-03-31',
      amountPence: 20000,
    });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.invoiceId).not.toBe(res2.invoiceId);
    createdInvoiceIds.push(res1.invoiceId, res2.invoiceId);

    const inv1 = await db.query.invoices.findFirst({ where: eq(invoices.id, res1.invoiceId) });
    const inv2 = await db.query.invoices.findFirst({ where: eq(invoices.id, res2.invoiceId) });
    expect(inv1?.organisationId).toBe(tenant1.org.id);
    expect(inv2?.organisationId).toBe(tenant2.org.id);
  });

  it('R22: Multi-child configuration represents 1 single family obligation and rejects per-child duplicate generation', async () => {
    const { org, centre, user } = await createSyntheticTenant('r22');
    const { parent, child: child1, config } = await createSyntheticFamily(org.id, centre.id, 'r22');
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;

    // Add sibling child 2
    const [child2] = await db
      .insert(children)
      .values({
        organisationId: org.id,
        centreId: centre.id,
        parentId: parent.id,
        firstName: 'Sibling2',
        lastName: 'Family_r22',
        schoolYear: 'Year 5',
      })
      .returning();
    createdChildIds.push(child2.id);

    await db.insert(billingConfigChildren).values({
      configId: config.id,
      childId: child2.id,
    });

    // 1. Generate automated invoice for this multi-child family config
    const res = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2028-04-01',
      periodEndStr: '2028-04-30',
      amountPence: 25000,
    });
    expect(res.success).toBe(true);
    createdInvoiceIds.push(res.invoiceId);

    // 2. Attempting a manual createInvoice for child2 for the same period must be rejected
    let child2Error: Error | null = null;
    try {
      await createInvoice({
        centreId: centre.id,
        parentId: parent.id,
        childIds: [child2.id],
        amount: '125.00',
        invoiceDate: new Date(),
        dueDate: new Date('2028-04-01T00:00:00Z'),
        billingPeriodStart: new Date('2028-04-01T00:00:00Z'),
        billingPeriodEnd: new Date('2028-04-30T00:00:00Z'),
        notes: 'Duplicate attempt for sibling',
      });
    } catch (err: any) {
      child2Error = err;
    }
    expect(child2Error).toBeDefined();
    expect(child2Error?.message).toContain('An active invoice already exists for this family and billing period');

    // Exactly 1 invoice exists for the family for this period
    const inDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.billingConfigId, config.id),
          eq(invoices.billingPeriodStart, new Date('2028-04-01T00:00:00Z'))
        )
      );
    expect(inDb).toHaveLength(1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PM-2C.R2: Hostile Tenant Substitution Matrix (R23 – R26)
  // ═══════════════════════════════════════════════════════════════════════════

  it('R23: Hostile tenant substituting foreign billingConfigId is rejected fail-closed without modifying state', async () => {
    const victim = await createSyntheticTenant('r23_victim');
    const victimFamily = await createSyntheticFamily(victim.org.id, victim.centre.id, 'r23_victim');

    const attacker = await createSyntheticTenant('r23_attacker');
    // Attacker session
    mockSessionUser.id = attacker.user.id;
    mockSessionUser.organisationId = attacker.org.id;

    let error: Error | null = null;
    try {
      await generateInvoiceFromConfig({
        configId: victimFamily.config.id,
        periodStartStr: '2028-05-01',
        periodEndStr: '2028-05-31',
        amountPence: 15000,
      });
    } catch (err: any) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain('Billing config not found');

    // Confirm 0 invoices created for victim config for this period
    const inDb = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.billingConfigId, victimFamily.config.id),
          eq(invoices.billingPeriodStart, new Date('2028-05-01T00:00:00Z'))
        )
      );
    expect(inDb).toHaveLength(0);
  });

  it('R24: Hostile tenant substituting foreign parentId into createInvoice is rejected fail-closed', async () => {
    const victim = await createSyntheticTenant('r24_victim');
    const victimFamily = await createSyntheticFamily(victim.org.id, victim.centre.id, 'r24_victim');

    const attacker = await createSyntheticTenant('r24_attacker');
    const attackerFamily = await createSyntheticFamily(attacker.org.id, attacker.centre.id, 'r24_attacker');

    // Attacker session
    mockSessionUser.id = attacker.user.id;
    mockSessionUser.organisationId = attacker.org.id;

    let error: Error | null = null;
    try {
      await createInvoice({
        centreId: attacker.centre.id,
        parentId: victimFamily.parent.id, // Foreign parent ID!
        childIds: [attackerFamily.child.id],
        amount: '150.00',
        invoiceDate: new Date(),
        dueDate: new Date('2028-06-01T00:00:00Z'),
      });
    } catch (err: any) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain('Parent not found');
  });

  it('R25: Hostile tenant substituting foreign centreId into createInvoice is rejected fail-closed', async () => {
    const victim = await createSyntheticTenant('r25_victim');
    const attacker = await createSyntheticTenant('r25_attacker');
    const attackerFamily = await createSyntheticFamily(attacker.org.id, attacker.centre.id, 'r25_attacker');

    // Attacker session
    mockSessionUser.id = attacker.user.id;
    mockSessionUser.organisationId = attacker.org.id;

    let error: Error | null = null;
    try {
      await createInvoice({
        centreId: victim.centre.id, // Foreign centre ID!
        parentId: attackerFamily.parent.id,
        childIds: [attackerFamily.child.id],
        amount: '150.00',
        invoiceDate: new Date(),
        dueDate: new Date('2028-07-01T00:00:00Z'),
      });
    } catch (err: any) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain('Centre not found');
  });

  it('R26: Hostile tenant substituting foreign childId into createInvoice is rejected fail-closed', async () => {
    const victim = await createSyntheticTenant('r26_victim');
    const victimFamily = await createSyntheticFamily(victim.org.id, victim.centre.id, 'r26_victim');

    const attacker = await createSyntheticTenant('r26_attacker');
    const attackerFamily = await createSyntheticFamily(attacker.org.id, attacker.centre.id, 'r26_attacker');

    // Attacker session
    mockSessionUser.id = attacker.user.id;
    mockSessionUser.organisationId = attacker.org.id;

    let error: Error | null = null;
    try {
      await createInvoice({
        centreId: attacker.centre.id,
        parentId: attackerFamily.parent.id,
        childIds: [victimFamily.child.id], // Foreign child ID!
        amount: '150.00',
        invoiceDate: new Date(),
        dueDate: new Date('2028-08-01T00:00:00Z'),
      });
    } catch (err: any) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain('One or more children not found');
  });
});
