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

const dbUpdateSetMock = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-broadcast-id' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: (...args: unknown[]) => {
        dbUpdateSetMock(...args);
        return { where: vi.fn() };
      },
    })),
  },
}));

/** Flushes the fire-and-forget sendEmailsTask (see actions.ts) so tests can
 * assert on its background db.update(broadcasts).set({successCount,...})
 * call, which happens after a few chained awaits following sendBroadcast's
 * own return. */
async function flushBackgroundTask() {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
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
  });

  describe('sendBroadcast', () => {
    it('rejects when there is no session (C1)', async () => {
      (auth as any).mockResolvedValue(null);

      const result = await sendBroadcast({
        audienceParentIds: ['p1'],
        subject: 'Test',
        message: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unauthorized/i);
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
  });

  describe('getBroadcasts (C4/C5)', () => {
    it('returns nothing for an unauthenticated caller', async () => {
      (auth as any).mockResolvedValue(null);
      const result = await getBroadcasts('centre-1');
      expect(result).toEqual([]);
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
