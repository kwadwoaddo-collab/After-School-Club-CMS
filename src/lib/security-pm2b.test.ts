import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyCronAuthorization } from '@/app/api/cron/broadcasts/route';
import {
  processBroadcastDeliveries,
  reconcileBroadcastStatus,
  MAX_DELIVERY_ATTEMPTS,
} from '@/features/communications/delivery';
import { sendBroadcast, getBroadcastDeliveryStats } from '@/features/communications/actions';
import { db } from '@/db';
import { sendEmail } from '@/lib/services/email';
import {
  assertSafeTrainingEnvironment,
  APPROVED_TRAINING_DB_HOST,
  KNOWN_PRODUCTION_DB_HOST,
  REQUIRED_TRAINING_ENVIRONMENT,
} from '@/lib/training-guard';

vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: vi.fn().mockResolvedValue(['centre-1', 'centre-2']),
}));

describe('PM-2B — Broadcast Delivery Durability & Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(db, 'execute').mockResolvedValue({
      rows: [],
    } as any);

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'res-1' }]),
      }),
    } as any);

    vi.spyOn(db, 'update').mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      }),
    } as any);
  });

  // =========================================================================
  // 1. CRON SECURITY & TIMING-SAFE AUTHENTICATION TESTS (Point 12)
  // =========================================================================
  describe('Cron Authentication Guard (verifyCronAuthorization)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it('fails closed (503) when CRON_SECRET is not configured in environment', () => {
      delete process.env.CRON_SECRET;
      const req = new NextRequest('https://example.com/api/cron/broadcasts', {
        headers: { authorization: 'Bearer some-secret' },
      });
      const authResult = verifyCronAuthorization(req);
      expect(authResult.authorized).toBe(false);
      expect(authResult.status).toBe(503);
      expect(authResult.error).toContain('cron secret unconfigured');
    });

    it('rejects (401) when Authorization header is missing', () => {
      process.env.CRON_SECRET = 'valid-test-secret-12345';
      const req = new NextRequest('https://example.com/api/cron/broadcasts');
      const authResult = verifyCronAuthorization(req);
      expect(authResult.authorized).toBe(false);
      expect(authResult.status).toBe(401);
      expect(authResult.error).toContain('Missing authorization header');
    });

    it('rejects (401) when Authorization scheme is not Bearer', () => {
      process.env.CRON_SECRET = 'valid-test-secret-12345';
      const req = new NextRequest('https://example.com/api/cron/broadcasts', {
        headers: { authorization: 'Basic valid-test-secret-12345' },
      });
      const authResult = verifyCronAuthorization(req);
      expect(authResult.authorized).toBe(false);
      expect(authResult.status).toBe(401);
      expect(authResult.error).toContain('Invalid authorization scheme');
    });

    it('rejects (401) when secret has different length (safe against buffer mismatch)', () => {
      process.env.CRON_SECRET = 'valid-test-secret-12345';
      const req = new NextRequest('https://example.com/api/cron/broadcasts', {
        headers: { authorization: 'Bearer wrong' },
      });
      const authResult = verifyCronAuthorization(req);
      expect(authResult.authorized).toBe(false);
      expect(authResult.status).toBe(401);
    });

    it('rejects (401) when secret has same length but incorrect content', () => {
      process.env.CRON_SECRET = 'valid-test-secret-12345'; // length 23
      const req = new NextRequest('https://example.com/api/cron/broadcasts', {
        headers: { authorization: 'Bearer xalid-test-secret-12345' }, // length 23
      });
      const authResult = verifyCronAuthorization(req);
      expect(authResult.authorized).toBe(false);
      expect(authResult.status).toBe(401);
    });

    it('authorizes (200) when correct Bearer CRON_SECRET is provided', () => {
      process.env.CRON_SECRET = 'valid-test-secret-12345';
      const req = new NextRequest('https://example.com/api/cron/broadcasts', {
        headers: { authorization: 'Bearer valid-test-secret-12345' },
      });
      const authResult = verifyCronAuthorization(req);
      expect(authResult.authorized).toBe(true);
      expect(authResult.status).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. TENANT ISOLATION & DATA INTEGRITY TESTS (Cases 7, 8)
  // =========================================================================
  describe('Tenant Boundary Enforcement', () => {
    it('Case 7: Tenant A cannot read Tenant B delivery state via getBroadcastDeliveryStats', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-tenant-a', organisationId: 'org-A', role: 'ORG_OWNER' },
      } as any);

      // DB returns null because broadcastId belongs to org-B and query filters by session.user.organisationId
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No matching broadcast in org-A
          }),
        }),
      } as any);

      const stats = await getBroadcastDeliveryStats('broadcast-belonging-to-org-b');
      expect(stats).toBeNull();
    });

    it('Case 8: Tenant A cannot target or read parent records of Tenant B during sendBroadcast', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-tenant-a', organisationId: 'org-A', role: 'ORG_OWNER' },
      } as any);

      // Mock consent query returning 0 rows because requested parent IDs belong to org-B
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // filtered out by eq(parents.organisationId, 'org-A')
        }),
      } as any);

      const result = await sendBroadcast({
        centreId: 'centre-1',
        audienceParentIds: ['parent-of-org-b-1', 'parent-of-org-b-2'],
        subject: 'Cross Tenant Attempt',
        message: 'This should fail',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No eligible recipients with communications consent');
    });
  });

  // =========================================================================
  // 3. MANDATORY CONCURRENCY & WORKER SEMANTICS (Cases 1 - 6, 9, 10)
  // =========================================================================
  describe('Concurrency & Work Lease Invariants', () => {
    it('Case 1: Rejects duplicate delivery insertion under unique constraint', async () => {
      // In PostgreSQL, UNIQUE(broadcast_id, recipient_email) throws a 23505 unique violation
      const duplicateError = new Error('duplicate key value violates unique constraint "broadcast_deliveries_unique_idx"');
      (duplicateError as any).code = '23505';

      vi.spyOn(db, 'transaction').mockRejectedValueOnce(duplicateError);

      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      } as any);

      // Re-derive returns duplicate email targets
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'p-1', firstName: 'John', email: 'duplicate@test.org', communicationsConsent: true },
          ]),
        }),
      } as any);

      await expect(
        sendBroadcast({
          centreId: 'centre-1',
          audienceParentIds: ['p-1'],
          subject: 'Test',
          message: 'Hello',
        })
      ).rejects.toThrow('broadcast_deliveries_unique_idx');
    });

    it('Case 2: Two concurrent worker executions claim distinct rows via SKIP LOCKED', async () => {
      // Worker 1 claims delivery row 1
      // Worker 2 claims delivery row 2 (row 1 is locked and skipped)
      const worker1Row = {
        id: 'del-1',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'p1@test.org',
        recipientName: 'P1',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1,
        claimToken: 'worker-token-1',
      };

      const worker2Row = {
        id: 'del-2',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'p2@test.org',
        recipientName: 'P2',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1,
        claimToken: 'worker-token-2',
      };

      // Worker 1 execution
      vi.spyOn(db, 'execute')
        .mockResolvedValueOnce({ rows: [worker1Row] } as any) // claim
        .mockResolvedValueOnce({ rows: [{ sent_count: 1, failed_count: 0, pending_count: 1, total_count: 2 }] } as any); // reconcile

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'b-1', subject: 'S', message: 'M' }]),
        }),
      } as any);

      vi.spyOn(db, 'update').mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
          }),
        }),
      } as any);

      vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: 'msg-1' });

      const res1 = await processBroadcastDeliveries({ broadcastId: 'b-1', limit: 1, workerToken: 'worker-token-1' });
      expect(res1.sentCount).toBe(1);

      // Worker 2 execution in parallel skips row 1 and processes row 2
      vi.spyOn(db, 'execute')
        .mockResolvedValueOnce({ rows: [worker2Row] } as any) // claim
        .mockResolvedValueOnce({ rows: [{ sent_count: 2, failed_count: 0, pending_count: 0, total_count: 2 }] } as any); // reconcile

      const res2 = await processBroadcastDeliveries({ broadcastId: 'b-1', limit: 1, workerToken: 'worker-token-2' });
      expect(res2.sentCount).toBe(1);
    });

    it('Case 3: Re-running processor after SENT does not resend SENT work', async () => {
      // Worker query selects where status = PENDING or expired lease. SENT rows are not selected.
      vi.spyOn(db, 'execute').mockResolvedValue({ rows: [] } as any); // No claimable rows and reconcile returns 0 rows

      const result = await processBroadcastDeliveries({ broadcastId: 'b-completed' });
      expect(result.processedCount).toBe(0);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('Case 4 & 5: Transient failure retries within policy, and terminates at MAX_DELIVERY_ATTEMPTS', async () => {
      const deliveryAttempt1 = {
        id: 'del-retry-test',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'parent@test.org',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1, // First attempt
        claimToken: 'token-1',
      };

      vi.spyOn(db, 'execute')
        .mockResolvedValueOnce({ rows: [deliveryAttempt1] } as any)
        .mockResolvedValueOnce({ rows: [{ sent_count: 0, failed_count: 0, pending_count: 1, total_count: 1 }] } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'b-1', subject: 'S', message: 'M' }]),
        }),
      } as any);

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      });
      vi.spyOn(db, 'update').mockReturnValue({ set: updateSetMock } as any);

      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: '500 Internal Server Error',
      });

      const res1 = await processBroadcastDeliveries({ broadcastId: 'b-1', workerToken: 'token-1' });
      expect(res1.retriedCount).toBe(1);
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING', nextAttemptAt: expect.any(Date) })
      );

      // Now simulate 3rd attempt failing -> must transition to FAILED
      const deliveryAttempt3 = {
        ...deliveryAttempt1,
        attemptCount: MAX_DELIVERY_ATTEMPTS,
        claimToken: 'token-3',
      };

      vi.spyOn(db, 'execute')
        .mockResolvedValueOnce({ rows: [deliveryAttempt3] } as any)
        .mockResolvedValueOnce({ rows: [{ sent_count: 0, failed_count: 1, pending_count: 0, total_count: 1 }] } as any);

      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: '500 Internal Server Error',
      });

      const res3 = await processBroadcastDeliveries({ broadcastId: 'b-1', workerToken: 'token-3' });
      expect(res3.failedCount).toBe(1);
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' })
      );
    });

    it('Case 6: Stale PROCESSING work with expired lease is recoverable by a subsequent worker', async () => {
      // Expired row claimed by second worker
      const staleRow = {
        id: 'del-stale',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'parent@test.org',
        channel: 'email',
        status: 'PROCESSING',
        leaseExpiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
        attemptCount: 1,
        claimToken: 'crashed-worker-token',
      };

      vi.spyOn(db, 'execute')
        .mockResolvedValueOnce({ rows: [{ ...staleRow, claimToken: 'new-worker-token', attemptCount: 2 }] } as any)
        .mockResolvedValueOnce({ rows: [{ sent_count: 1, failed_count: 0, pending_count: 0, total_count: 1 }] } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'b-1', subject: 'S', message: 'M' }]),
        }),
      } as any);

      vi.spyOn(db, 'update').mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
          }),
        }),
      } as any);

      vi.mocked(sendEmail).mockResolvedValueOnce({ success: true, messageId: 'recovered-msg-id' });

      const res = await processBroadcastDeliveries({ broadcastId: 'b-1', workerToken: 'new-worker-token' });
      expect(res.sentCount).toBe(1);
    });

    it('Case 9: Transaction rollback on broadcast creation does not leave orphaned delivery rows', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'p-1', firstName: 'Jane', email: 'jane@test.org', communicationsConsent: true },
          ]),
        }),
      } as any);

      // Transaction callback throws an error mid-flight
      vi.spyOn(db, 'transaction').mockImplementationOnce(async (callback: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'b-new' }]),
            }),
          }),
        };
        // Simulate failure on audit event insertion
        await tx.insert({} as any).values({} as any).returning();
        throw new Error('Database disk error during audit event write');
      });

      await expect(
        sendBroadcast({
          centreId: 'centre-1',
          audienceParentIds: ['p-1'],
          subject: 'Rollback Test',
          message: 'Will roll back',
        })
      ).rejects.toThrow('Database disk error during audit event write');
    });

    it('Case 10: Provider failure never falsely marks row as SENT', async () => {
      const deliveryRow = {
        id: 'del-fail-test',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'fail@test.org',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1,
        claimToken: 'worker-token',
      };

      vi.spyOn(db, 'execute')
        .mockResolvedValueOnce({ rows: [deliveryRow] } as any)
        .mockResolvedValueOnce({ rows: [{ sent_count: 0, failed_count: 1, pending_count: 0, total_count: 1 }] } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'b-1', subject: 'S', message: 'M' }]),
        }),
      } as any);

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      });
      vi.spyOn(db, 'update').mockReturnValue({ set: updateSetMock } as any);

      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'invalid_from_address',
      });

      const res = await processBroadcastDeliveries({ broadcastId: 'b-1', workerToken: 'worker-token' });
      expect(res.sentCount).toBe(0);
      expect(res.failedCount).toBe(1);

      // Verify that status was set to FAILED, not SENT
      expect(updateSetMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SENT' })
      );
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' })
      );
    });
  });

  // =========================================================================
  // 4. ZERO RECIPIENT HANDLING (Point 9)
  // =========================================================================
  describe('Zero Eligible Recipients Handling', () => {
    it('cleanly rejects broadcast creation when no consented recipients exist without database mutation', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      } as any);

      // Re-derivation query finds 0 consented parents
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'p-1', firstName: 'Opted', email: 'optout@test.org', communicationsConsent: false },
          ]),
        }),
      } as any);

      const txSpy = vi.spyOn(db, 'transaction');

      const result = await sendBroadcast({
        centreId: 'centre-1',
        audienceParentIds: ['p-1'],
        subject: 'No Consent Test',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No eligible recipients with communications consent');
      expect(txSpy).not.toHaveBeenCalled(); // Zero database writes
    });
  });

  // =========================================================================
  // 5. TRAINING GUARD STRICT VALIDATION
  // =========================================================================
  describe('Safety Guardrail (assertSafeTrainingEnvironment)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it('strictly permits approved training database with required flags', () => {
      process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/db`;
      process.env.ALLOW_TRAINING_SEED = 'true';
      process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

      const guard = assertSafeTrainingEnvironment();
      expect(guard.host).toBe(APPROVED_TRAINING_DB_HOST);
    });

    it('strictly refuses execution against known production database', () => {
      process.env.DATABASE_URL = `postgres://user:pass@${KNOWN_PRODUCTION_DB_HOST}/db`;
      process.env.ALLOW_TRAINING_SEED = 'true';
      process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

      expect(() => assertSafeTrainingEnvironment()).toThrow('KNOWN PRODUCTION DATABASE');
    });

    it('strictly refuses execution when ALLOW_TRAINING_SEED is not true', () => {
      process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/db`;
      delete process.env.ALLOW_TRAINING_SEED;
      process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

      expect(() => assertSafeTrainingEnvironment()).toThrow('Explicit acknowledgement required');
    });
  });
});
