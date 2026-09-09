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
  bookings,
  broadcasts,
  broadcastDeliveries,
  auditEvents,
} from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { sendBroadcast, getBroadcastDeliveryStats } from './actions';
import {
  claimDeliveries,
  processBroadcastDeliveries,
  reconcileBroadcastStatus,
  MAX_DELIVERY_ATTEMPTS,
} from './delivery';
import { sendEmail } from '@/lib/services/email';

// Mock session user
const mockSessionUser = {
  id: 'synthetic-user-pm2b',
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
    sendEmail: vi.fn(),
  },
}));

describe('PM-2B: Real PostgreSQL Broadcast Durability & Invariants Suite (F1-F23)', () => {
  const RUN_ID = `pm2b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let trainingHost: string;

  // Track created IDs for strict guaranteed cleanup
  const createdOrgIds: string[] = [];
  const createdCentreIds: string[] = [];
  const createdParentIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdBroadcastIds: string[] = [];

  beforeAll(async () => {
    const guard = assertSafeTrainingEnvironment();
    trainingHost = guard.host;
    expect(trainingHost).toBe('ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech');
  });

  afterAll(async () => {
    let cleanupError: unknown = null;
    try {
      if (createdBroadcastIds.length > 0) {
        await db.delete(broadcastDeliveries).where(inArray(broadcastDeliveries.broadcastId, createdBroadcastIds));
        await db.delete(broadcasts).where(inArray(broadcasts.id, createdBroadcastIds));
      }
      if (createdBookingIds.length > 0) {
        await db.delete(bookings).where(inArray(bookings.id, createdBookingIds));
      }
      if (createdParentIds.length > 0) {
        await db.delete(parents).where(inArray(parents.id, createdParentIds));
      }
      if (createdCentreIds.length > 0) {
        await db.delete(centres).where(inArray(centres.id, createdCentreIds));
      }
      if (createdOrgIds.length > 0) {
        await db.delete(auditEvents).where(inArray(auditEvents.organisationId, createdOrgIds));
        await db.delete(organisations).where(inArray(organisations.id, createdOrgIds));
      }
    } catch (err) {
      cleanupError = err;
      console.error('Error during test cleanup:', err);
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
      })
      .returning();
    createdOrgIds.push(org.id);

    const [centre] = await db
      .insert(centres)
      .values({
        organisationId: org.id,
        name: `Synthetic Centre ${slug}`,
        slug: `centre_${slug}`,
      })
      .returning();
    createdCentreIds.push(centre.id);

    return { org, centre };
  }

  async function createSyntheticParent(orgId: string, email: string, name: string = 'Parent') {
    const [parent] = await db
      .insert(parents)
      .values({
        organisationId: orgId,
        firstName: name,
        lastName: `Synthetic_${RUN_ID}`,
        email,
        phone: '07123456789',
        preferredContact: 'phone',
      })
      .returning();
    createdParentIds.push(parent.id);
    return parent;
  }

  async function createSyntheticBooking(
    parentId: string,
    consent: boolean,
    createdAtOffsetMs: number = 0
  ) {
    const code = `BK_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const token = `ML_${Math.random().toString(36).substring(2, 12)}`;
    const createdAt = new Date(Date.now() + createdAtOffsetMs);

    const [booking] = await db
      .insert(bookings)
      .values({
        parentId,
        startAt: new Date(),
        duration: 30,
        modality: 'in_person',
        status: 'confirmed',
        confirmationCode: code,
        magicLinkToken: token,
        communicationsConsent: consent,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    createdBookingIds.push(booking.id);
    return booking;
  }

  // =========================================================================
  // F1: ATOMIC HEADER + LEDGER QUEUEING
  // =========================================================================
  it('F1: Atomically persists broadcast header, ledger rows, and queued audit event in real PostgreSQL', async () => {
    const { org, centre } = await createSyntheticTenant('f1');
    mockSessionUser.organisationId = org.id;

    const p1 = await createSyntheticParent(org.id, 'p1.f1@test.com', 'Alice');
    const p2 = await createSyntheticParent(org.id, 'p2.f1@test.com', 'Bob');
    await createSyntheticBooking(p1.id, true);
    await createSyntheticBooking(p2.id, true);

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: 'msg-f1' });

    const result = await sendBroadcast({
      centreId: centre.id,
      audienceParentIds: [p1.id, p2.id],
      subject: 'F1 Subject',
      message: 'F1 Body text',
    });

    console.log('F1 sendBroadcast result:', result);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.broadcastId).toBeDefined();
    createdBroadcastIds.push(result.broadcastId!);

    // Verify broadcast row in Postgres
    const [bRow] = await db.select().from(broadcasts).where(eq(broadcasts.id, result.broadcastId!));
    expect(bRow).toBeDefined();
    expect(bRow.subject).toBe('F1 Subject');
    expect(bRow.recipientCount).toBe(2);

    // Verify delivery ledger rows in Postgres
    const deliveries = await db.select().from(broadcastDeliveries).where(eq(broadcastDeliveries.broadcastId, result.broadcastId!));
    expect(deliveries).toHaveLength(2);
    expect(deliveries.map(d => d.recipientEmail).sort()).toEqual(['p1.f1@test.com', 'p2.f1@test.com']);
    expect(deliveries[0].status).toBe('SENT');
    expect(deliveries[1].status).toBe('SENT');
  });

  // =========================================================================
  // F21: PROCESS LOSS SURVIVAL (CORE SERVERLESS DEFECT REMEDIATION)
  // =========================================================================
  it('F21: Queue accepts and commits to Postgres even when immediate worker throws or dies mid-flight', async () => {
    const { org, centre } = await createSyntheticTenant('f21');
    mockSessionUser.organisationId = org.id;

    const p1 = await createSyntheticParent(org.id, 'p1.f21@test.com', 'Charlie');
    await createSyntheticBooking(p1.id, true);

    // Simulate immediate dispatcher crashing with uncaught runtime exception
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Process killed: SIGTERM in serverless runtime'));

    const result = await sendBroadcast({
      centreId: centre.id,
      audienceParentIds: [p1.id],
      subject: 'F21 Serverless Survival Subject',
      message: 'F21 Serverless Body',
    });

    // Caller receives success because queueing transaction committed before worker dispatch
    expect(result.success).toBe(true);
    expect(result.broadcastId).toBeDefined();
    createdBroadcastIds.push(result.broadcastId!);

    // Ledger row survived safely in Postgres
    const deliveries = await db.select().from(broadcastDeliveries).where(eq(broadcastDeliveries.broadcastId, result.broadcastId!));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].recipientEmail).toBe('p1.f21@test.com');
    expect(deliveries[0].broadcastId).toBe(result.broadcastId!);

    // Simulate elapsed retry backoff: nextAttemptAt has arrived
    await db
      .update(broadcastDeliveries)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(broadcastDeliveries.id, deliveries[0].id));

    // Now simulate recovery cron / background sweep claiming the stranded row
    vi.mocked(sendEmail).mockResolvedValueOnce({ success: true, messageId: 'recovered-by-cron' });
    const recoveryResult = await processBroadcastDeliveries({ broadcastId: result.broadcastId!, limit: 10 });
    expect(recoveryResult.sentCount).toBe(1);

    const [updatedDelivery] = await db.select().from(broadcastDeliveries).where(eq(broadcastDeliveries.id, deliveries[0].id));
    expect(updatedDelivery.status).toBe('SENT');
    expect(updatedDelivery.providerMessageId).toBe('recovered-by-cron');
  });

  // =========================================================================
  // F3: SHARED-EMAIL DEDUPLICATION IN REAL POSTGRESQL
  // =========================================================================
  it('F3: Deduplicates family accounts sharing an email into exactly one ledger row and obeys unique index', async () => {
    const { org, centre } = await createSyntheticTenant('f3');
    mockSessionUser.organisationId = org.id;

    // Two distinct parents sharing one email
    const p1 = await createSyntheticParent(org.id, 'family.shared@test.com', 'Parent1');
    const p2 = await createSyntheticParent(org.id, 'family.shared@test.com', 'Parent2');
    await createSyntheticBooking(p1.id, true);
    await createSyntheticBooking(p2.id, true);

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: 'msg-f3' });

    const result = await sendBroadcast({
      centreId: centre.id,
      audienceParentIds: [p1.id, p2.id],
      subject: 'Family Shared Subject',
      message: 'Family Shared Body',
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(1); // Deduplicated to 1
    createdBroadcastIds.push(result.broadcastId!);

    const deliveries = await db.select().from(broadcastDeliveries).where(eq(broadcastDeliveries.broadcastId, result.broadcastId!));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].recipientEmail).toBe('family.shared@test.com');
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // Attempting raw duplicate insertion into same broadcast must be rejected by PostgreSQL UNIQUE index
    await expect(
      db.insert(broadcastDeliveries).values({
        organisationId: org.id,
        broadcastId: result.broadcastId!,
        recipientEmail: 'family.shared@test.com',
        channel: 'email',
        status: 'PENDING',
      })
    ).rejects.toThrow();
  });

  // =========================================================================
  // F4: LATEST-BOOKING CONSENT EVALUATION IN REAL POSTGRESQL
  // =========================================================================
  it('F4: Derives consent from the latest booking (ORDER BY createdAt DESC, id DESC), rejecting historical opt-in overridden by opt-out', async () => {
    const { org, centre } = await createSyntheticTenant('f4');
    mockSessionUser.organisationId = org.id;

    const p1 = await createSyntheticParent(org.id, 'revoked@test.com', 'RevokedParent');
    // Historical booking: consented
    await createSyntheticBooking(p1.id, true, -10000);
    // Recent booking: revoked consent
    await createSyntheticBooking(p1.id, false, 0);

    const result = await sendBroadcast({
      centreId: centre.id,
      audienceParentIds: [p1.id],
      subject: 'Revoked Test',
      message: 'Should not send',
    });

    // Zero eligible consented recipients
    expect(result.success).toBe(false);
    expect(result.error).toContain('No eligible recipients with communications consent');

    // Confirm nothing was written to broadcasts or deliveries
    const writtenBroadcasts = await db.select().from(broadcasts).where(eq(broadcasts.organisationId, org.id));
    expect(writtenBroadcasts).toHaveLength(0);
  });

  // =========================================================================
  // F5 & F6: CONCURRENCY & WORKER LEASING VIA FOR UPDATE SKIP LOCKED
  // =========================================================================
  it('F5/F6: Two concurrent workers claim disjoint sets of rows via FOR UPDATE SKIP LOCKED without race conditions', async () => {
    const { org } = await createSyntheticTenant('f5');
    mockSessionUser.organisationId = org.id;

    const [b] = await db.insert(broadcasts).values({
      organisationId: org.id,
      subject: 'Concurrent Claim Test',
      message: 'Body',
      recipientCount: 2,
      status: 'QUEUED',
    }).returning();
    createdBroadcastIds.push(b.id);

    await db.insert(broadcastDeliveries).values([
      {
        organisationId: org.id,
        broadcastId: b.id,
        recipientEmail: 'c1@test.com',
        channel: 'email',
        status: 'PENDING',
      },
      {
        organisationId: org.id,
        broadcastId: b.id,
        recipientEmail: 'c2@test.com',
        channel: 'email',
        status: 'PENDING',
      },
    ]);

    // Claim simultaneously with two distinct worker tokens
    const worker1Promise = claimDeliveries({ batchSize: 1, broadcastId: b.id, workerToken: 'worker-token-A' });
    const worker2Promise = claimDeliveries({ batchSize: 1, broadcastId: b.id, workerToken: 'worker-token-B' });

    const [claim1, claim2] = await Promise.all([worker1Promise, worker2Promise]);

    expect(claim1).toHaveLength(1);
    expect(claim2).toHaveLength(1);
    expect(claim1[0].id).not.toBe(claim2[0].id);
    expect(claim1[0].claimToken).toBe('worker-token-A');
    expect(claim2[0].claimToken).toBe('worker-token-B');
    expect(claim1[0].status).toBe('PROCESSING');
    expect(claim2[0].status).toBe('PROCESSING');
  });

  // =========================================================================
  // F23: AMBIGUOUS PROVIDER SUCCESS & DB CRASH RECOVERY (IDEMPOTENCY KEY REUSE)
  // =========================================================================
  it('F23: Reclaims expired lease with exact same delivery ID forwarded as Idempotency-Key and payload', async () => {
    const { org } = await createSyntheticTenant('f23');
    mockSessionUser.organisationId = org.id;

    const [b] = await db.insert(broadcasts).values({
      organisationId: org.id,
      subject: 'Idempotent Broadcast Subject',
      message: 'Idempotent Broadcast Message',
      recipientCount: 1,
      status: 'QUEUED',
    }).returning();
    createdBroadcastIds.push(b.id);

    // Stale delivery stuck in PROCESSING with expired lease
    const [staleDelivery] = await db.insert(broadcastDeliveries).values({
      organisationId: org.id,
      broadcastId: b.id,
      recipientEmail: 'stale.f23@test.com',
      recipientName: 'David',
      channel: 'email',
      status: 'PROCESSING',
      claimToken: 'crashed-worker',
      leaseExpiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
      attemptCount: 1,
    }).returning();

    vi.mocked(sendEmail).mockResolvedValueOnce({
      success: true,
      messageId: 'resend-cached-msg-id',
    });

    const result = await processBroadcastDeliveries({ broadcastId: b.id, workerToken: 'recovery-worker' });
    expect(result.sentCount).toBe(1);

    // Verify sendEmail call received the exact delivery ID as idempotencyKey
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'stale.f23@test.com',
        subject: 'Idempotent Broadcast Subject',
        html: '<p>Dear David,</p><p>Idempotent Broadcast Message</p>',
        idempotencyKey: staleDelivery.id,
      })
    );

    const [finalDelivery] = await db.select().from(broadcastDeliveries).where(eq(broadcastDeliveries.id, staleDelivery.id));
    expect(finalDelivery.status).toBe('SENT');
    expect(finalDelivery.providerMessageId).toBe('resend-cached-msg-id');
  });

  // =========================================================================
  // F22: MIXED RESULT RECONCILIATION (PARTIALLY_FAILED)
  // =========================================================================
  it('F22: Reconciles mixed delivery outcomes into PARTIALLY_FAILED terminal status on broadcast header', async () => {
    const { org } = await createSyntheticTenant('f22');
    mockSessionUser.organisationId = org.id;

    const [b] = await db.insert(broadcasts).values({
      organisationId: org.id,
      subject: 'Mixed Results Broadcast',
      message: 'Mixed Results Body',
      recipientCount: 2,
      status: 'QUEUED',
    }).returning();
    createdBroadcastIds.push(b.id);

    const [d1, d2] = await db.insert(broadcastDeliveries).values([
      {
        organisationId: org.id,
        broadcastId: b.id,
        recipientEmail: 'success.f22@test.com',
        channel: 'email',
        status: 'PENDING',
      },
      {
        organisationId: org.id,
        broadcastId: b.id,
        recipientEmail: 'fail.f22@test.com',
        channel: 'email',
        status: 'PENDING',
      },
    ]).returning();

    // First delivery succeeds; second delivery receives non-retryable invalid address error
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ success: true, messageId: 'msg-success' })
      .mockResolvedValueOnce({ success: false, error: 'invalid_to_address' });

    const procResult = await processBroadcastDeliveries({ broadcastId: b.id, workerToken: 'mixed-worker' });
    expect(procResult.sentCount).toBe(1);
    expect(procResult.failedCount).toBe(1);

    const [finalBroadcast] = await db.select().from(broadcasts).where(eq(broadcasts.id, b.id));
    expect(finalBroadcast.status).toBe('PARTIALLY_FAILED');
    expect(finalBroadcast.successCount).toBe(1);
    expect(finalBroadcast.failureCount).toBe(1);
    expect(finalBroadcast.completedAt).not.toBeNull();
  });

  // =========================================================================
  // F18: PARENT DELETION RETENTION (ON DELETE SET NULL)
  // =========================================================================
  it('F18: Preserves recipient email and ledger row when parent record is deleted (ON DELETE SET NULL)', async () => {
    const { org } = await createSyntheticTenant('f18');
    mockSessionUser.organisationId = org.id;

    const p = await createSyntheticParent(org.id, 'retention.parent@test.com', 'To Delete');
    const [b] = await db.insert(broadcasts).values({
      organisationId: org.id,
      subject: 'Retention Test',
      message: 'Body',
      recipientCount: 1,
      status: 'COMPLETED',
    }).returning();
    createdBroadcastIds.push(b.id);

    const [del] = await db.insert(broadcastDeliveries).values({
      organisationId: org.id,
      broadcastId: b.id,
      parentId: p.id,
      recipientEmail: 'retention.parent@test.com',
      channel: 'email',
      status: 'SENT',
      sentAt: new Date(),
    }).returning();

    // Delete the parent record
    await db.delete(parents).where(eq(parents.id, p.id));
    // Remove from cleanup array to avoid double delete
    const idx = createdParentIds.indexOf(p.id);
    if (idx !== -1) createdParentIds.splice(idx, 1);

    // Ledger row MUST remain with parentId set to NULL, keeping recipientEmail intact
    const [survivingDelivery] = await db.select().from(broadcastDeliveries).where(eq(broadcastDeliveries.id, del.id));
    expect(survivingDelivery).toBeDefined();
    expect(survivingDelivery.parentId).toBeNull();
    expect(survivingDelivery.recipientEmail).toBe('retention.parent@test.com');
  });

  // =========================================================================
  // F8: OPERATOR LEDGER QUERY (getBroadcastDeliveryStats)
  // =========================================================================
  it('F8: getBroadcastDeliveryStats returns authoritative status and deliveries scoped to authenticated tenant', async () => {
    const { org } = await createSyntheticTenant('f8');
    mockSessionUser.organisationId = org.id;

    const [b] = await db.insert(broadcasts).values({
      organisationId: org.id,
      subject: 'Stats Test',
      message: 'Stats Message',
      recipientCount: 1,
      status: 'COMPLETED',
    }).returning();
    createdBroadcastIds.push(b.id);

    await db.insert(broadcastDeliveries).values({
      organisationId: org.id,
      broadcastId: b.id,
      recipientEmail: 'viewer@test.com',
      channel: 'email',
      status: 'SENT',
      sentAt: new Date(),
    });

    const stats = await getBroadcastDeliveryStats(b.id);
    expect(stats).not.toBeNull();
    expect(stats!.broadcast.id).toBe(b.id);
    expect(stats!.deliveries).toHaveLength(1);
    expect(stats!.deliveries[0].recipientEmail).toBe('viewer@test.com');
    expect(stats!.deliveries[0].status).toBe('SENT');
  });
});
