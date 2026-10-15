import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm';

const DISPOSABLE_DB_URL =
  process.env.CMS_INCIDENT1_TEST_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54493/cms_finance_incident1_test';

// Force disposable local Postgres connection before importing @/db
process.env.DATABASE_URL = DISPOSABLE_DB_URL;
process.env.TEST_ALLOW_INSECURE_TLS = 'true';

const mockSessionUser = {
  id: 'a0000000-0000-0000-0000-000000000099',
  role: 'ORG_OWNER',
  organisationId: '',
};

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
const sendInvoiceCreatedMock = vi.fn().mockResolvedValue(undefined);

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
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  emailService: {
    sendInvoiceCreated: (...args: unknown[]) => sendInvoiceCreatedMock(...args),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('CMS-FINANCE-INCIDENT-1: Real PostgreSQL Disposable Verification Suite', () => {
  const RUN_ID = `inc1_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let dbAvailable = false;

  const createdOrgIds: string[] = [];
  const createdCentreIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdParentIds: string[] = [];
  const createdChildIds: string[] = [];
  const createdConfigIds: string[] = [];
  const createdInvoiceIds: string[] = [];

  beforeAll(async () => {
    const parsed = new URL(process.env.DATABASE_URL!);
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      throw new Error(
        `Refusing to run disposable integration suite against non-local host: ${parsed.hostname}`,
      );
    }

    try {
      const { db } = await import('@/db');
      await db.execute(sql`SELECT 1`);
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    const { db, client } = await import('@/db');
    const {
      organisations,
      centres,
      users,
      parents,
      children,
      billingConfigs,
      billingConfigChildren,
      billingRuns,
      billingCycleSkips,
      invoices,
      invoiceLineItems,
      payments,
      auditEvents,
    } = await import('@/db/schema');

    try {
      if (createdConfigIds.length > 0) {
        const cfgInvoices = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(inArray(invoices.billingConfigId, createdConfigIds));
        for (const row of cfgInvoices) {
          if (!createdInvoiceIds.includes(row.id)) createdInvoiceIds.push(row.id);
        }
      }
      if (createdParentIds.length > 0) {
        const parentInvoices = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(inArray(invoices.parentId, createdParentIds));
        for (const row of parentInvoices) {
          if (!createdInvoiceIds.includes(row.id)) createdInvoiceIds.push(row.id);
        }
      }
      if (createdInvoiceIds.length > 0) {
        await db.delete(payments).where(inArray(payments.invoiceId, createdInvoiceIds));
        await db.delete(invoiceLineItems).where(inArray(invoiceLineItems.invoiceId, createdInvoiceIds));
        await db.delete(billingRuns).where(inArray(billingRuns.invoiceId, createdInvoiceIds));
      }
      if (createdConfigIds.length > 0) {
        await db.delete(billingRuns).where(inArray(billingRuns.billingConfigId, createdConfigIds));
        await db.delete(billingCycleSkips).where(inArray(billingCycleSkips.billingConfigId, createdConfigIds));
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
      if (createdOrgIds.length > 0) {
        await db.delete(auditEvents).where(inArray(auditEvents.organisationId, createdOrgIds));
      }
      if (createdCentreIds.length > 0) {
        await db.delete(centres).where(inArray(centres.id, createdCentreIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
      if (createdOrgIds.length > 0) {
        await db.delete(organisations).where(inArray(organisations.id, createdOrgIds));
      }
    } finally {
      await client.end();
    }
  });

  async function seedFixture(suffix: string, anchorStr: string, leadDays = 0) {
    const { db } = await import('@/db');
    const {
      organisations,
      centres,
      users,
      parents,
      children,
      billingConfigs,
      billingConfigChildren,
    } = await import('@/db/schema');

    const slug = `${RUN_ID}_${suffix}_${Math.random().toString(36).slice(2, 6)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const [org] = await db
      .insert(organisations)
      .values({
        name: `Inc1 Org ${slug}`,
        slug,
        contactEmail: `${slug}@example.com`,
      })
      .returning();
    createdOrgIds.push(org.id);

    const [centre] = await db
      .insert(centres)
      .values({
        organisationId: org.id,
        name: `Inc1 Centre ${suffix}`,
        slug: `centre-${slug}`,
      })
      .returning();
    createdCentreIds.push(centre.id);

    const [user] = await db
      .insert(users)
      .values({
        organisationId: org.id,
        email: `owner_${slug}@example.com`,
        firstName: 'Owner',
        lastName: `Inc1_${suffix}`,
        role: 'ORG_OWNER',
      })
      .returning();
    createdUserIds.push(user.id);

    const [parent] = await db
      .insert(parents)
      .values({
        organisationId: org.id,
        firstName: 'Historical',
        lastName: `Parent_${suffix}`,
        email: `parent_${slug}@example.com`,
        phone: '07700900123',
        preferredContact: 'email',
      })
      .returning();
    createdParentIds.push(parent.id);

    const [child] = await db
      .insert(children)
      .values({
        organisationId: org.id,
        centreId: centre.id,
        parentId: parent.id,
        firstName: 'Test',
        lastName: `Child_${suffix}`,
        schoolYear: 'Year 4',
      })
      .returning();
    createdChildIds.push(child.id);

    const [config] = await db
      .insert(billingConfigs)
      .values({
        organisationId: org.id,
        centreId: centre.id,
        parentId: parent.id,
        agreedMonthlyPence: 120000, // £1,200.00
        billingAnchorDate: anchorStr,
        invoiceLeadDays: leadDays,
        status: 'active',
      })
      .returning();
    createdConfigIds.push(config.id);

    await db.insert(billingConfigChildren).values({
      configId: config.id,
      childId: child.id,
    });

    return { org, centre, user, parent, child, config };
  }

  it('V1: Old anchors and stale history NEVER create completed historical automated invoices; only current/eligible upcoming periods are created', async () => {
    if (!dbAvailable) return;
    const { db } = await import('@/db');
    const { invoices, billingRuns, billingCycleSkips } = await import('@/db/schema');
    const { POST: billingCronPost } = await import('@/app/api/cron/billing/route');
    const { getBillingPeriodForDate, formatIsoDate, toUtcDate } = await import('@/lib/billing/date-engine');

    const todayUtc = toUtcDate(new Date());
    const currentPeriod = getBillingPeriodForDate('2025-11-01', todayUtc);
    const currentStartStr = formatIsoDate(currentPeriod.periodStart);

    // Seed old anchor from Nov 2025 with stale historical billing_runs row
    const { config } = await seedFixture('v1_old_anchor', '2025-11-01', 0);
    await db.insert(billingRuns).values({
      billingConfigId: config.id,
      periodStart: '2025-11-01',
      periodEnd: '2025-11-30',
      amountPence: 120000,
      success: true,
    });

    const cronSecret = 'test-cron-secret-inc1-v1';
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = cronSecret;

    try {
      const req = new NextRequest('http://localhost:3000/api/cron/billing', {
        method: 'POST',
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      const res = await billingCronPost(req);
      expect(res.status).toBe(200);

      // Query all invoices created for this config
      const createdInvs = await db
        .select()
        .from(invoices)
        .where(eq(invoices.billingConfigId, config.id));

      expect(createdInvs).toHaveLength(1);
      expect(createdInvs[0].status).toBe('draft');
      expect(formatIsoDate(createdInvs[0].billingPeriodStart!)).toBe(currentStartStr);
      expect(toUtcDate(createdInvs[0].billingPeriodEnd!).getTime()).toBeGreaterThanOrEqual(todayUtc.getTime());

      // Verify zero fabricated historical billingRuns (only the pre-seeded 2025-11-01 row + the 1 current period row) or billingCycleSkips
      const runs = await db
        .select()
        .from(billingRuns)
        .where(eq(billingRuns.billingConfigId, config.id));
      expect(runs).toHaveLength(2);
      expect(runs.map((r) => r.periodStart).sort()).toEqual(['2025-11-01', currentStartStr].sort());

      const skips = await db
        .select()
        .from(billingCycleSkips)
        .where(eq(billingCycleSkips.billingConfigId, config.id));
      expect(skips).toHaveLength(0);
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it('V2: Inclusive midnight UTC periodEnd semantics and eligible upcoming periods work in real cron execution', async () => {
    if (!dbAvailable) return;
    const { db } = await import('@/db');
    const { invoices } = await import('@/db/schema');
    const { POST: billingCronPost } = await import('@/app/api/cron/billing/route');
    const { toUtcDate, formatIsoDate, subtractCalendarMonths } = await import('@/lib/billing/date-engine');

    const todayUtc = toUtcDate(new Date());
    // Tomorrow is the start of next cycle -> so the cycle starting (tomorrow - 1 month) ends TODAY at 00:00:00.000Z!
    const tomorrowUtc = new Date(todayUtc.getTime() + 86_400_000);
    const anchorEndingToday = subtractCalendarMonths(tomorrowUtc, 1);
    const anchorEndingTodayStr = formatIsoDate(anchorEndingToday);

    // Lead days = 5 so both the period ending today AND the period starting tomorrow (draftCreationDate = tomorrow - 5 days <= today) are eligible!
    const { config } = await seedFixture('v2_inclusive', anchorEndingTodayStr, 5);

    const cronSecret = 'test-cron-secret-inc1-v2';
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = cronSecret;

    try {
      const req = new NextRequest('http://localhost:3000/api/cron/billing', {
        method: 'POST',
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      const res = await billingCronPost(req);
      expect(res.status).toBe(200);

      const createdInvs = await db
        .select()
        .from(invoices)
        .where(eq(invoices.billingConfigId, config.id));

      // Both the period ending today (inclusive!) and the upcoming period starting tomorrow (within 5 lead days) are generated as drafts
      expect(createdInvs).toHaveLength(2);
      const starts = createdInvs.map((i) => formatIsoDate(i.billingPeriodStart!)).sort();
      expect(starts).toContain(anchorEndingTodayStr);
      expect(starts).toContain(formatIsoDate(tomorrowUtc));
      for (const inv of createdInvs) {
        expect(inv.status).toBe('draft');
      }
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it('V3 & V4: Retries/concurrent cron calls cannot duplicate periods, and discarded drafts are NOT regenerated automatically', async () => {
    if (!dbAvailable) return;
    const { db } = await import('@/db');
    const { invoices, billingRuns } = await import('@/db/schema');
    const { POST: billingCronPost } = await import('@/app/api/cron/billing/route');
    const { discardDraftInvoice } = await import('@/features/finance/actions');
    const { reopenBillingCycle } = await import('@/features/billing/actions');

    const { org, user, config } = await seedFixture('v3_v4_discard', '2026-01-01', 0);
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;
    mockSessionUser.role = 'ORG_OWNER';

    const cronSecret = 'test-cron-secret-inc1-v3';
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = cronSecret;

    try {
      // 1. Fire 4 concurrent cron requests
      const makeReq = () =>
        new NextRequest('http://localhost:3000/api/cron/billing', {
          method: 'POST',
          headers: { authorization: `Bearer ${cronSecret}` },
        });

      const responses = await Promise.all([
        billingCronPost(makeReq()),
        billingCronPost(makeReq()),
        billingCronPost(makeReq()),
        billingCronPost(makeReq()),
      ]);
      for (const r of responses) {
        expect(r.status).toBe(200);
      }

      const afterConcurrent = await db
        .select()
        .from(invoices)
        .where(eq(invoices.billingConfigId, config.id));
      expect(afterConcurrent).toHaveLength(1);
      const draftId = afterConcurrent[0].id;

      // 2. Discard the generated draft via discardDraftInvoice
      const discardRes = await discardDraftInvoice(draftId);
      expect(discardRes.success).toBe(true);

      // Verify invoice row was removed and billing_runs row has success = false, invoiceId = null
      const remainingInvs = await db
        .select()
        .from(invoices)
        .where(eq(invoices.billingConfigId, config.id));
      expect(remainingInvs).toHaveLength(0);

      const [runAfterDiscard] = await db
        .select()
        .from(billingRuns)
        .where(eq(billingRuns.billingConfigId, config.id));
      expect(runAfterDiscard.success).toBe(false);
      expect(runAfterDiscard.invoiceId).toBeNull();

      // 3. Re-run cron — discarded draft MUST NOT be regenerated!
      const rerunRes = await billingCronPost(makeReq());
      expect(rerunRes.status).toBe(200);

      const afterRerunInvs = await db
        .select()
        .from(invoices)
        .where(eq(invoices.billingConfigId, config.id));
      expect(afterRerunInvs).toHaveLength(0);

      // 4. Explicitly reopen the cycle via reopenBillingCycle — now cron may generate it again
      await reopenBillingCycle(config.id, runAfterDiscard.periodStart);

      const afterReopenRes = await billingCronPost(makeReq());
      expect(afterReopenRes.status).toBe(200);

      const afterReopenInvs = await db
        .select()
        .from(invoices)
        .where(eq(invoices.billingConfigId, config.id));
      expect(afterReopenInvs).toHaveLength(1);
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it('V5: Manual historical draft generation enforces Manager/Owner role, valid anchored period, historical warning/reason, audit trail, actual creation timestamp, and no email', async () => {
    if (!dbAvailable) return;
    const { db } = await import('@/db');
    const { invoices, auditEvents, payments } = await import('@/db/schema');
    const { generateInvoiceFromConfig } = await import('@/features/billing/actions');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');

    const { org, centre, user, config } = await seedFixture('v5_manual_hist', '2026-01-01', 0);
    mockSessionUser.id = user.id;
    mockSessionUser.organisationId = org.id;
    vi.mocked(getUserAccessibleCentreIds).mockResolvedValue([centre.id]);

    sendEmailMock.mockClear();
    sendInvoiceCreatedMock.mockClear();

    // 1. Rejects non-Manager/Owner role (e.g. TUTOR with centre access)
    mockSessionUser.role = 'TUTOR';
    await expect(
      generateInvoiceFromConfig({
        configId: config.id,
        periodStartStr: '2026-02-01',
        periodEndStr: '2026-02-28',
        amountPence: 120000,
        confirmHistorical: true,
        historicalReason: 'Tutor attempt',
      }),
    ).rejects.toThrow(/Unauthorized: Only Org Owner and Centre Managers can generate invoices/i);

    mockSessionUser.role = 'ORG_OWNER';

    // 2. Rejects unaligned period (anchor is 1st of month, selecting 2026-02-05 to 2026-03-04)
    await expect(
      generateInvoiceFromConfig({
        configId: config.id,
        periodStartStr: '2026-02-05',
        periodEndStr: '2026-03-04',
        amountPence: 120000,
        confirmHistorical: true,
        historicalReason: 'Unaligned period',
      }),
    ).rejects.toThrow(/does not align with the family billing anchor date/i);

    // 3. Rejects historical period without confirmHistorical + historicalReason
    await expect(
      generateInvoiceFromConfig({
        configId: config.id,
        periodStartStr: '2026-02-01',
        periodEndStr: '2026-02-28',
        amountPence: 120000,
      }),
    ).rejects.toThrow(/Historical billing period warning/i);

    // 4. Succeeds with explicit confirmHistorical + historicalReason
    const beforeCreate = new Date(Date.now() - 2000);
    const histRes = await generateInvoiceFromConfig({
      configId: config.id,
      periodStartStr: '2026-02-01',
      periodEndStr: '2026-02-28',
      amountPence: 120000,
      confirmHistorical: true,
      historicalReason: 'Owner approved February 2026 historical billing draft',
    });

    expect(histRes.success).toBe(true);
    expect(histRes.alreadyGenerated).toBe(false);
    createdInvoiceIds.push(histRes.invoiceId);

    // Verify ONLY the requested February 2026 period was created (no automatic catch-up for Jan/Mar/Apr)
    const configInvs = await db
      .select()
      .from(invoices)
      .where(eq(invoices.billingConfigId, config.id));
    expect(configInvs).toHaveLength(1);
    expect(configInvs[0].id).toBe(histRes.invoiceId);
    expect(configInvs[0].status).toBe('draft');
    expect(configInvs[0].invoiceDate.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());

    // Verify audit event recorded with actor, role, and historicalReason
    const audits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organisationId, org.id),
          eq(auditEvents.eventType, 'manual_historical_invoice_draft_created'),
        ),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0].userId).toBe(user.id);
    const eventData = (
      typeof audits[0].eventData === 'string'
        ? JSON.parse(audits[0].eventData)
        : audits[0].eventData
    ) as Record<string, unknown>;
    expect(eventData.invoiceId).toBe(histRes.invoiceId);
    expect(eventData.historicalReason).toBe(
      'Owner approved February 2026 historical billing draft',
    );
    expect(eventData.actorRole).toBe('ORG_OWNER');

    // Verify zero emails dispatched and zero payments created
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendInvoiceCreatedMock).not.toHaveBeenCalled();
    const invPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, histRes.invoiceId));
    expect(invPayments).toHaveLength(0);
  });

  it('V6: Finance queries and overdue/receivable aggregations exclude drafts with old due dates', async () => {
    if (!dbAvailable) return;
    const { db } = await import('@/db');
    const { invoices } = await import('@/db/schema');

    const { org, centre, parent, child } = await seedFixture('v6_finance_grid', '2026-01-01', 0);

    // Insert 1 draft invoice with a past dueDate (2025-12-01) and 1 sent invoice with a past dueDate (2025-12-01)
    const [draftPastDue] = await db
      .insert(invoices)
      .values({
        organisationId: org.id,
        centreId: centre.id,
        parentId: parent.id,
        childId: child.id,
        invoiceNumber: `INV-DRF-${RUN_ID}`.slice(0, 24),
        amount: '1200.00',
        status: 'draft',
        invoiceDate: new Date('2025-11-24T00:00:00Z'),
        dueDate: new Date('2025-12-01T00:00:00Z'),
      })
      .returning();
    createdInvoiceIds.push(draftPastDue.id);

    const [sentPastDue] = await db
      .insert(invoices)
      .values({
        organisationId: org.id,
        centreId: centre.id,
        parentId: parent.id,
        childId: child.id,
        invoiceNumber: `INV-SNT-${RUN_ID}`.slice(0, 24),
        amount: '450.00',
        status: 'sent',
        invoiceDate: new Date('2025-11-24T00:00:00Z'),
        dueDate: new Date('2025-12-01T00:00:00Z'),
      })
      .returning();
    createdInvoiceIds.push(sentPastDue.id);

    const todayMidnightUtc = new Date();
    todayMidnightUtc.setUTCHours(0, 0, 0, 0);

    // 1. Overdue filter query from /dashboard/finance/page.tsx
    const overdueRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organisationId, org.id),
          inArray(invoices.status, ['sent', 'partially_paid']),
          lt(invoices.dueDate, todayMidnightUtc),
        ),
      );
    expect(overdueRows).toHaveLength(1);
    expect(overdueRows[0].id).toBe(sentPastDue.id);

    // 2. RevenueWidget SQL aggregation for outstanding receivables
    const [revMetrics] = await db
      .select({
        outstanding: sql<number>`coalesce(sum(${invoices.amount}) filter (where ${invoices.status} in ('sent', 'partially_paid')), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.organisationId, org.id));

    expect(Number(revMetrics.outstanding)).toBe(450);
  });
});
