import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireTenantSession = vi.fn();
const mockGetApiSession = vi.fn();
const mockGetUserAccessibleCentreIds = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerInfo = vi.fn();
const mockSendStatusEmail = vi.fn().mockResolvedValue(undefined);
const mockCreateRegNotification = vi.fn().mockResolvedValue(undefined);

const mockTxExecute = vi.fn();
const mockTxSelectLimit = vi.fn();
const mockTxInsertValues = vi.fn();

const mockCentreFindFirst = vi.fn();
const mockCentreUpdateSet = vi.fn();
const mockDbInsertValues = vi.fn();
const mockParentFindManyChildren = vi.fn();
const mockParentSelectLimit = vi.fn();
const mockParentUpdateReturning = vi.fn();

vi.mock('@/lib/session', () => ({
  requireTenantSession: (...args: any[]) => mockRequireTenantSession(...args),
  getApiSession: (...args: any[]) => mockGetApiSession(...args),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: (...args: any[]) => mockGetUserAccessibleCentreIds(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: any[]) => mockLoggerError(...args),
    warn: (...args: any[]) => mockLoggerWarn(...args),
    info: (...args: any[]) => mockLoggerInfo(...args),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendRegistrationStatusUpdate: (...args: any[]) => mockSendStatusEmail(...args),
    sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/parent-notifications', () => ({
  createRegistrationNotification: (...args: any[]) => mockCreateRegNotification(...args),
}));

vi.mock('@/lib/services/booking-outcome-sync', () => ({
  resolveBookingForRegistration: vi.fn().mockResolvedValue(null),
  syncBookingOutcomeFromRegistration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (cb: any) =>
      cb({
        execute: (...args: any[]) => mockTxExecute(...args),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: (...args: any[]) => mockTxSelectLimit(...args),
            })),
            innerJoin: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: (...args: any[]) => mockTxInsertValues(...args),
        })),
        update: vi.fn(() => ({
          set: (...args: any[]) => {
            mockCentreUpdateSet(...args);
            return {
              where: vi.fn(() => ({
                returning: (...rArgs: any[]) => mockParentUpdateReturning(...rArgs),
              })),
            };
          },
        })),
      })
    ),
    query: {
      centres: {
        findFirst: (...args: any[]) => mockCentreFindFirst(...args),
      },
      children: {
        findMany: (...args: any[]) => mockParentFindManyChildren(...args),
      },
      parents: {
        findFirst: vi.fn(),
      },
      registrations: {
        findFirst: vi.fn(),
      },
      organisations: {
        findFirst: vi.fn(),
      },
      bookings: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: (...args: any[]) => mockParentSelectLimit(...args),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: (...args: any[]) => {
        mockCentreUpdateSet(...args);
        return {
          where: vi.fn(() => ({
            returning: (...rArgs: any[]) => mockParentUpdateReturning(...rArgs),
          })),
        };
      },
    })),
    insert: vi.fn(() => ({
      values: (...args: any[]) => mockDbInsertValues(...args),
    })),
  },
}));

describe('Wave 4B Branch 5 — School-Year Rollover, Centres, Registrations & Parents Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rollSchoolYearsAction (BE P1-1 + SEC-W4-10)', () => {
    it('exports only async server action functions from roll-actions.ts', async () => {
      const mod = await import('../roll-actions');
      expect(Object.keys(mod)).toEqual(['rollSchoolYearsAction']);
      expect(typeof mod.rollSchoolYearsAction).toBe('function');
    });

    it('rejects non-ORG_OWNER callers with Forbidden', async () => {
      mockRequireTenantSession.mockResolvedValueOnce({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      const { rollSchoolYearsAction } = await import('../roll-actions');
      await expect(rollSchoolYearsAction()).rejects.toThrow('Forbidden');
    });

    it('acquires advisory lock, executes set-based CASE SQL, records audit event, and revalidates', async () => {
      mockRequireTenantSession.mockResolvedValueOnce({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      });
      mockTxExecute
        .mockResolvedValueOnce([{ locked: true }])
        .mockResolvedValueOnce([{ rolled_count: 14 }]);
      mockTxSelectLimit.mockResolvedValueOnce([]);
      mockTxInsertValues.mockResolvedValueOnce(undefined);

      const { rollSchoolYearsAction } = await import('../roll-actions');
      const res = await rollSchoolYearsAction();

      expect(res).toEqual({
        success: true,
        rolledCount: 14,
        message: 'Successfully rolled school years forward for 14 students.',
      });
      expect(mockTxExecute).toHaveBeenCalledTimes(2);
      expect(mockTxInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          userId: 'owner-1',
          eventType: 'school_year_rollover_completed',
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/students');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
    });

    it('blocks duplicate rollover within the same academic year when audit event exists', async () => {
      mockRequireTenantSession.mockResolvedValueOnce({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      });
      mockTxExecute.mockResolvedValueOnce([{ locked: true }]);
      mockTxSelectLimit.mockResolvedValueOnce([{ id: 'audit-existing' }]);

      const { rollSchoolYearsAction } = await import('../roll-actions');
      const res = await rollSchoolYearsAction();

      expect(res.success).toBe(false);
      expect(res.rolledCount).toBe(0);
      expect(res.message).toBe('School years have already been rolled for this academic year.');
      expect(mockTxExecute).toHaveBeenCalledTimes(1);
      expect(mockTxInsertValues).not.toHaveBeenCalled();
    });

    it('blocks concurrent rollover when advisory lock is already held', async () => {
      mockRequireTenantSession.mockResolvedValueOnce({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      });
      mockTxExecute.mockResolvedValueOnce([{ locked: false }]);

      const { rollSchoolYearsAction } = await import('../roll-actions');
      const res = await rollSchoolYearsAction();

      expect(res.success).toBe(false);
      expect(res.rolledCount).toBe(0);
      expect(res.message).toContain('currently in progress');
    });

    it('sanitizes raw SQL errors on failure while logging full details via logger.error', async () => {
      mockRequireTenantSession.mockResolvedValueOnce({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      });
      mockTxExecute.mockRejectedValueOnce(new Error('PostgresError: relation "children" syntax near org-1'));

      const { rollSchoolYearsAction } = await import('../roll-actions');
      const res = await rollSchoolYearsAction();

      expect(res).toEqual({
        success: false,
        rolledCount: 0,
        message: 'Failed to roll school years. Please try again.',
      });
      expect(res.message).not.toContain('PostgresError');
      expect(mockLoggerError).toHaveBeenCalledTimes(1);
    });

    it('preserves composite school years in canonical computeNextSchoolYear helper', async () => {
      const { computeNextSchoolYear } = await import('@/app/api/cron/school-year-roll/route');
      expect(computeNextSchoolYear('Year 3/4')).toBe('Year 3/4');
      expect(computeNextSchoolYear('Y5/6')).toBe('Y5/6');
      expect(computeNextSchoolYear('Nursery')).toBe('Reception');
      expect(computeNextSchoolYear('Reception')).toBe('Y1');
      expect(computeNextSchoolYear('Year 4')).toBe('Y5');
      expect(computeNextSchoolYear('Y13')).toBe('Graduated');
      expect(computeNextSchoolYear('Graduated')).toBe('Graduated');
    });
  });

  describe('updateCentreAction & PATCH /api/centres/[id] (Blind Spot #2 + SEC-W4-11)', () => {
    it('does not wipe omitted fields (sessionSlots, managerName, billingEmail) to NULL on partial update', async () => {
      mockRequireTenantSession.mockResolvedValueOnce({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      });
      mockDbInsertValues.mockResolvedValueOnce(undefined);

      const { updateCentreAction } = await import('@/app/dashboard/centres/[id]/settings/actions');
      await updateCentreAction('11111111-1111-4111-8111-111111111111', {
        bankName: 'Lloyds',
        sortCode: '20-00-00',
        accountNo: '12345678',
      });

      expect(mockCentreUpdateSet).toHaveBeenCalledTimes(1);
      const setPayload = mockCentreUpdateSet.mock.calls[0][0];
      expect(setPayload.bankName).toBe('Lloyds');
      expect(setPayload.sortCode).toBe('200000');
      expect(setPayload.accountNo).toBe('12345678');
      expect('sessionSlots' in setPayload).toBe(false);
      expect('managerName' in setPayload).toBe(false);
      expect('billingPhone' in setPayload).toBe(false);
      expect('billingEmail' in setPayload).toBe(false);
      expect('name' in setPayload).toBe(false);
    });

    it('rejects invalid sortCode and unsafe signatureUrl in PATCH /api/centres/[id], and audits bank changes', async () => {
      const centreUuid = '11111111-1111-4111-8111-111111111111';
      mockGetApiSession.mockResolvedValue({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      });
      const { PATCH } = await import('@/app/api/centres/[id]/route');

      const badSortRes = await PATCH(
        new Request('http://localhost/api/centres/' + centreUuid, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortCode: '12-34' }),
        }) as any,
        { params: Promise.resolve({ id: centreUuid }) }
      );
      expect(badSortRes.status).toBe(400);

      const badSigRes = await PATCH(
        new Request('http://localhost/api/centres/' + centreUuid, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signatureUrl: 'javascript:alert(1)' }),
        }) as any,
        { params: Promise.resolve({ id: centreUuid }) }
      );
      expect(badSigRes.status).toBe(400);

      mockCentreFindFirst.mockResolvedValueOnce({
        id: centreUuid,
        organisationId: 'org-1',
        bankName: 'Old Bank',
        sortCode: '111111',
        accountNo: '11111111',
      });
      mockParentUpdateReturning.mockResolvedValueOnce([{ id: centreUuid, bankName: 'Barclays' }]);

      const okBankRes = await PATCH(
        new Request('http://localhost/api/centres/' + centreUuid, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bankName: 'Barclays', sortCode: '20-00-00', accountNo: '87654321' }),
        }) as any,
        { params: Promise.resolve({ id: centreUuid }) }
      );
      expect(okBankRes.status).toBe(200);
      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          eventType: 'centre_bank_details_updated',
        })
      );
    });
  });

  describe('Parent Childless Guard & Email Audit (SEC-W4-10)', () => {
    it('blocks non-owner MANAGER from PATCHing a childless parent and audits owner email changes', async () => {
      const parentUuid = '22222222-2222-4222-8222-222222222222';
      const { PATCH } = await import('@/app/api/parents/[id]/route');

      mockGetApiSession.mockResolvedValueOnce({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      mockParentSelectLimit.mockResolvedValueOnce([{ id: parentUuid, email: 'old@example.com' }]);
      mockGetUserAccessibleCentreIds.mockResolvedValueOnce(['centre-1']);
      mockParentFindManyChildren.mockResolvedValueOnce([]);

      const forbiddenRes = await PATCH(
        new Request('http://localhost/api/parents/' + parentUuid, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'attacker@example.com' }),
        }),
        { params: Promise.resolve({ id: parentUuid }) }
      );
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.headers.get('Cache-Control')).toContain('no-store');

      mockGetApiSession.mockResolvedValueOnce({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      });
      mockParentSelectLimit.mockResolvedValueOnce([{ id: parentUuid, email: 'old@example.com' }]);
      mockParentUpdateReturning.mockResolvedValueOnce([{ id: parentUuid, email: 'new@example.com' }]);

      const ownerRes = await PATCH(
        new Request('http://localhost/api/parents/' + parentUuid, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'new@example.com' }),
        }),
        { params: Promise.resolve({ id: parentUuid }) }
      );
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.headers.get('Cache-Control')).toContain('no-store');
      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          userId: 'owner-1',
          eventType: 'parent_email_updated',
        })
      );
    });
  });
});
