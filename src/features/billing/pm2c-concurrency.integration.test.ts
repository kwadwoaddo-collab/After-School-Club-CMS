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
  auditEvents,
  users,
} from '@/db/schema';
import { eq, inArray, and, sql, ne } from 'drizzle-orm';
import { generateInvoiceFromConfig } from './actions';
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

  // Track created IDs for guaranteed cleanup
  const createdOrgIds: string[] = [];
  const createdCentreIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdParentIds: string[] = [];
  const createdChildIds: string[] = [];
  const createdConfigIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  beforeAll(async () => {
    const guard = assertSafeTrainingEnvironment();
    trainingHost = guard.host;
    expect(trainingHost).toBe('ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech');
  });

  afterAll(async () => {
    let cleanupError: unknown = null;
    try {
      if (createdConfigIds.length > 0) {
        await db.delete(billingRuns).where(inArray(billingRuns.billingConfigId, createdConfigIds));
        await db.delete(billingConfigChildren).where(inArray(billingConfigChildren.configId, createdConfigIds));
      }
      if (createdInvoiceIds.length > 0) {
        await db.delete(invoices).where(inArray(invoices.id, createdInvoiceIds));
      }
      if (createdConfigIds.length > 0) {
        await db.delete(billingConfigs).where(inArray(billingConfigs.id, createdConfigIds));
      }
      if (createdChildIds.length > 0) {
        await db.delete(children).where(inArray(children.id, createdChildIds));
      }
      if (createdParentIds.length > 0) {
        await db.delete(parents).where(inArray(parents.id, createdParentIds));
      }
      if (createdCentreIds.length > 0) {
        await db.delete(centres).where(inArray(centres.id, createdCentreIds));
      }
      if (createdOrgIds.length > 0) {
        await db.delete(auditEvents).where(inArray(auditEvents.organisationId, createdOrgIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
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

  it('C15: Rollback atomicity guarantees zero orphan invoice rows if a transaction aborts', async () => {
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
});
