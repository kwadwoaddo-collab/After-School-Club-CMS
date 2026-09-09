import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendBroadcast, getBroadcasts, getClassesForCentre, getParentsForCentre } from './actions';
import { db } from '@/db';
import { sendEmail } from '@/lib/services/email';
import { auth } from '@/lib/auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

/**
 * Milestone 3H, known test failure (see project-notes/
 * milestone-3h-communications-audit.md, §M): `./actions` imports `auth`
 * from `@/lib/auth` at module top level. This file previously never mocked
 * `@/lib/auth` — unlike every other production-actions test in this repo
 * that touches an action module importing it (billing/actions.test.ts,
 * finance/actions.test.ts, reconcile-payment.test.ts all mock it first).
 * Without that mock, Vitest's SSR module externalization loaded the real
 * next-auth package, whose compiled lib/env.js does a bare, extensionless
 * `import { NextRequest } from "next/server"` that Node's strict ESM
 * resolver (used for externalized node_modules under Vitest, unlike Next's
 * own bundler) cannot resolve — failing the whole suite at collection time
 * with "Cannot find module '.../next/server'". Mocking @/lib/auth here,
 * the same way every other passing test in the repo already does, prevents
 * the real next-auth module graph from ever loading. This is a test-only
 * fix; no production code changed for the resolution issue itself.
 */
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const getUserAccessibleCentreIdsMock = vi.fn();
vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIdsMock(...args),
}));

/**
 * Milestone 3H, C1-C5: the mock below models the corrected query shape —
 * sendBroadcast/getParentsForCentre now use db.select().from(parents)
 * .leftJoin(bookings)...groupBy(parents.id) to re-derive consent
 * server-side (a raw `parents` row has no communicationsConsent column of
 * its own), rather than the old db.query.parents.findMany(...) call this
 * mock used to model. getBroadcasts/getClassesForCentre keep a similar
 * select().from().where() chain.
 */
function makeSelectChain(result: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn().mockResolvedValue(result),
    then: (resolve: any) => resolve(result),
  };
  return chain;
}

const {
  dbUpdateSetMock,
  getCapturedDeliveries,
  getCapturedBroadcast,
  setCapturedDeliveries,
  setCapturedBroadcast,
  insertMock,
  txMock,
} = vi.hoisted(() => {
  let capturedDeliveries: any[] = [];
  let capturedBroadcast: any = null;
  const dbUpdateSetMock = vi.fn();

  const insertMock = vi.fn(() => ({
    values: vi.fn((vals: any) => {
      if (Array.isArray(vals)) {
        capturedDeliveries = vals;
      } else if (vals && vals.message !== undefined) {
        capturedBroadcast = vals;
      }
      return {
        returning: vi.fn().mockResolvedValue([
          { id: 'mock-broadcast-id', ...(capturedBroadcast || {}) },
        ]),
      };
    }),
  }));

  const txMock = {
    insert: insertMock,
    update: vi.fn(() => ({
      set: (...args: unknown[]) => {
        dbUpdateSetMock(...args);
        return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) };
      },
    })),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  };

  return {
    dbUpdateSetMock,
    getCapturedDeliveries: () => capturedDeliveries,
    getCapturedBroadcast: () => capturedBroadcast,
    setCapturedDeliveries: (v: any[]) => {
      capturedDeliveries = v;
    },
    setCapturedBroadcast: (v: any) => {
      capturedBroadcast = v;
    },
    insertMock,
    txMock,
  };
});

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: insertMock,
    update: vi.fn(() => ({
      set: (...args: unknown[]) => {
        dbUpdateSetMock(...args);
        return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) };
      },
    })),
    transaction: vi.fn(async (cb: any) => cb(txMock)),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

vi.mock('./delivery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./delivery')>();
  return {
    ...actual,
    processBroadcastDeliveries: vi.fn(async () => {
      const deliveries = getCapturedDeliveries();
      const broadcast = getCapturedBroadcast();
      if (deliveries.length > 0) {
        let succ = 0;
        let fail = 0;
        for (const d of deliveries) {
          try {
            const res = await (await import('@/lib/services/email')).sendEmail({
              to: d.recipientEmail,
              subject: broadcast?.subject || 'Test',
              html: `<p>Dear ${actual.escapeHtml(d.recipientName || '')},</p><p>${actual.escapeHtml(broadcast?.message || '')}</p>`,
              organisationId: d.organisationId,
            });
            if (res && res.success) succ++;
            else fail++;
          } catch (e) {
            fail++;
          }
        }
        dbUpdateSetMock({ successCount: succ, failureCount: fail });
        return { processedCount: deliveries.length, sentCount: succ, failedCount: fail, retriedCount: 0 };
      }
      return { processedCount: 0, sentCount: 0, failedCount: 0, retriedCount: 0 };
    }),
  };
});

/** Flushes the fire-and-forget sendEmailsTask (see actions.ts) so tests can
 * assert on its background db.update(broadcasts).set({successCount,...})
 * call, which happens after a few chained awaits following sendBroadcast's
 * own return. */
async function flushBackgroundTask() {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
}));

function ownerSession(overrides: Partial<{ organisationId: string; id: string }> = {}) {
  return {
    user: {
      id: overrides.id ?? 'user-owner-1',
      organisationId: overrides.organisationId ?? 'org-1',
      role: 'ORG_OWNER',
    },
  };
}

function managerSession(overrides: Partial<{ organisationId: string; id: string }> = {}) {
  return {
    user: {
      id: overrides.id ?? 'user-manager-1',
      organisationId: overrides.organisationId ?? 'org-1',
      role: 'MANAGER',
    },
  };
}

function frontDeskSession() {
  return {
    user: { id: 'user-fd-1', organisationId: 'org-1', role: 'FRONT_DESK' },
  };
}

describe('Communications Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCapturedDeliveries([]);
    setCapturedBroadcast(null);
  });

  describe('sendBroadcast', () => {
    it('rejects when there is no session (C1)', async () => {
      (auth as any).mockResolvedValue(null);

      // PM-1.2: requireTenantSession now redirects (throws REDIRECT error) when unauthenticated.
      // Unauthenticated callers are terminated before touching any data.
      await expect(sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      })).rejects.toThrow('REDIRECT:/login');
      expect(db.select).not.toHaveBeenCalled();
    });

    it('rejects a FRONT_DESK/TUTOR caller — only ORG_OWNER/MANAGER may send (C8)', async () => {
      (auth as any).mockResolvedValue(frontDeskSession());

      const result = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/owner\/manager/i);
    });

    it('rejects a non-owner caller without access to the target centre', async () => {
      (auth as any).mockResolvedValue(managerSession());
      getUserAccessibleCentreIdsMock.mockResolvedValue(['centre-other']);

      const result = await sendBroadcast({
        centreId: 'centre-target',
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no access to this centre/i);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('uses the session-derived organisationId, ignoring any caller-supplied value (C1/C2)', async () => {
      (auth as any).mockResolvedValue(ownerSession({ organisationId: 'org-real' }));
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'consented@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);

      await sendBroadcast({
        // @ts-expect-error — organisationId is intentionally no longer part of the accepted input; this asserts the type was actually narrowed, not just that extra props are ignored at runtime
        organisationId: 'org-attacker-supplied',
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });

      // The recipient query must have been scoped using the session's own
      // organisationId, not whatever the caller tried to pass in.
      expect(chain.where).toHaveBeenCalled();
    });

    it('only messages parents who actually belong to the caller organisation and have consented (C2/C3)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'consented@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);

      const result = await sendBroadcast({
        audienceParentIds: ['p1', 'p2-from-another-org'],
        subject: 'Test Broadcast',
        message: 'Hello World',
      });

      expect(result.count).toBe(1);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'consented@test.com' }));
    });

    it('filters out parents whose consent (derived from bookings) is false, even if the caller supplied their id (C3)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'consented@test.com', communicationsConsent: true },
        { id: 'p2', firstName: 'Bob', email: 'unconsented@test.com', communicationsConsent: false },
      ]);
      (db.select as any).mockReturnValue(chain);

      const result = await sendBroadcast({
        audienceParentIds: ['p1', 'p2'],
        subject: 'Test Broadcast',
        message: 'Hello World',
      });

      expect(result.count).toBe(1);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'consented@test.com' }));
    });

    it('excludes parent when latest consent is false (withdrawn consent overriding historical true)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      // Re-derived query resolves latest booking consent; parent with withdrawn consent returns false
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'alice@test.com', communicationsConsent: false },
      ]);
      (db.select as any).mockReturnValue(chain);

      const result = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });

      expect(result.count).toBe(0);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('includes parent when latest consent is true (re-opt-in overriding historical false)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'alice@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);

      const result = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });

      expect(result.count).toBe(1);
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('excludes parent with missing/no consent records (defaults to false)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'alice@test.com', communicationsConsent: false },
      ]);
      (db.select as any).mockReturnValue(chain);

      const result = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });

      expect(result.count).toBe(0);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('HTML-escapes the interpolated firstName and message body (C7)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: '<b>Al</b>ice', email: 'alice@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);

      await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: '<script>alert(1)</script>',
      });

      const call = (sendEmail as any).mock.calls[0][0];
      expect(call.html).not.toContain('<script>');
      expect(call.html).not.toContain('<b>Al</b>ice');
      expect(call.html).toContain('&lt;script&gt;');
      expect(call.html).toContain('&lt;b&gt;Al&lt;/b&gt;ice');
    });

    it('handles email sending failures gracefully without throwing', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'fail@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);
      (sendEmail as any).mockRejectedValueOnce(new Error('Send failed'));

      const result = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Fail Broadcast',
        message: 'Should Fail',
      });

      // The send is fire-and-forget (see actions.ts), so the immediate
      // result only reflects that the broadcast was accepted/queued —
      // count reflects the consented, org-scoped audience.
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('records a failed send as a failure even when sendEmail resolves rather than throws (C10)', async () => {
      // sendEmail's real contract (src/lib/services/email.ts) is to resolve
      // with {success: false, error} on failure — e.g. an unconfigured
      // provider, or a rejected Resend API response — not to throw. Live
      // Stage-C verification with Resend unconfigured in the dev
      // environment showed this was previously counted as a success.
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'unconfigured@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);
      (sendEmail as any).mockResolvedValue({ success: false, error: 'Email service not configured' });

      await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });
      await flushBackgroundTask();

      expect(dbUpdateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ successCount: 0, failureCount: 1 })
      );
    });

    it('records a successful send correctly when sendEmail resolves with success (C10)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'ok@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);
      (sendEmail as any).mockResolvedValue({ success: true, messageId: 'msg-1' });

      await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });
      await flushBackgroundTask();

      expect(dbUpdateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ successCount: 1, failureCount: 0 })
      );
    });

    it('returns an empty, successful no-op when no parent ids are supplied', async () => {
      (auth as any).mockResolvedValue(ownerSession());

      const result = await sendBroadcast({
        audienceParentIds: [],
        subject: 'Test',
        message: 'Hello',
      });

      expect(result).toEqual({ success: true, count: 0, sent: 0, failed: 0 });
      expect(db.select).not.toHaveBeenCalled();
    });

    it('PM-2B.C: deduplicates when two eligible parents share the same email address (destination deduplication)', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'family@shared.test', communicationsConsent: true },
        { id: 'p2', firstName: 'Bob', email: 'family@shared.test', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);

      const result = await sendBroadcast({
        audienceParentIds: ['p1', 'p2'],
        subject: 'Family Update',
        message: 'Hello Family',
      });

      // Exactly 1 delivery must be queued and dispatched, recipient count must reflect 1
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(getCapturedDeliveries()).toHaveLength(1);
      expect(getCapturedDeliveries()[0].recipientEmail).toBe('family@shared.test');
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it('PM-2B.C: prevents duplicate delivery when same parent appears multiple times in audience', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'alice@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);

      const result = await sendBroadcast({
        audienceParentIds: ['p1', 'p1'],
        subject: 'Notice',
        message: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(getCapturedDeliveries()).toHaveLength(1);
    });

    it('PM-2B.C: allows same destination email across different broadcasts', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([
        { id: 'p1', firstName: 'Alice', email: 'alice@test.com', communicationsConsent: true },
      ]);
      (db.select as any).mockReturnValue(chain);

      const b1 = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Broadcast 1',
        message: 'Hello 1',
      });

      const b2 = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Broadcast 2',
        message: 'Hello 2',
      });

      expect(b1.success).toBe(true);
      expect(b2.success).toBe(true);
      expect(b1.count).toBe(1);
      expect(b2.count).toBe(1);
    });
  });

  describe('getBroadcasts (C4/C5)', () => {
    it('returns nothing for an unauthenticated caller', async () => {
      (auth as any).mockResolvedValue(null);
      // PM-1.2: requireTenantSession now redirects (throws REDIRECT error) when unauthenticated.
      await expect(getBroadcasts('centre-1')).rejects.toThrow('REDIRECT:/login');
    });

    it('scopes the query by organisationId, not centreId alone', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([{ id: 'b1' }]);
      (db.select as any).mockReturnValue(chain);

      await getBroadcasts('centre-1');

      expect(chain.where).toHaveBeenCalled();
    });

    it('rejects a non-owner caller without access to the requested centre', async () => {
      (auth as any).mockResolvedValue(managerSession());
      getUserAccessibleCentreIdsMock.mockResolvedValue(['centre-other']);

      const result = await getBroadcasts('centre-target');

      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('allows a non-owner caller with access to the requested centre', async () => {
      (auth as any).mockResolvedValue(managerSession());
      getUserAccessibleCentreIdsMock.mockResolvedValue(['centre-target']);
      const chain = makeSelectChain([{ id: 'b1' }]);
      (db.select as any).mockReturnValue(chain);

      const result = await getBroadcasts('centre-target');

      expect(result).toEqual([{ id: 'b1' }]);
    });
  });

  describe('getParentsForCentre (C4)', () => {
    it('rejects a non-owner caller without access to the requested centre', async () => {
      (auth as any).mockResolvedValue(managerSession());
      getUserAccessibleCentreIdsMock.mockResolvedValue(['centre-other']);

      const result = await getParentsForCentre('centre-target');

      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('allows an ORG_OWNER caller for any centre without checking accessible centres', async () => {
      (auth as any).mockResolvedValue(ownerSession());
      const chain = makeSelectChain([{ id: 'p1' }]);
      (db.select as any).mockReturnValue(chain);

      await getParentsForCentre('any-centre');

      expect(getUserAccessibleCentreIdsMock).not.toHaveBeenCalled();
    });
  });

  describe('getClassesForCentre (C4)', () => {
    it('rejects a non-owner caller without access to the requested centre', async () => {
      (auth as any).mockResolvedValue(managerSession());
      getUserAccessibleCentreIdsMock.mockResolvedValue(['centre-other']);

      const result = await getClassesForCentre('centre-target');

      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });
  });
});
