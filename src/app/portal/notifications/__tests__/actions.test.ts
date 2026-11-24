import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsertValues = vi.fn().mockResolvedValue([]);
const mockUpdateWhere = vi.fn().mockResolvedValue([]);
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockSelectLimit = vi.fn().mockResolvedValue([]);
const mockSelectOrderBy = vi.fn(() => ({ limit: mockSelectLimit }));
const mockSelectWhere = vi.fn(() => ({ orderBy: mockSelectOrderBy }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));

vi.mock('@/db', () => ({
  db: {
    query: {
      parents: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    select: vi.fn(() => ({ from: mockSelectFrom })),
  },
}));

vi.mock('@/lib/parent-auth', () => ({
  getCurrentParent: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getApiSession: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
    and: vi.fn((...args) => ({ op: 'and', args })),
    isNull: vi.fn((col) => ({ op: 'isNull', col })),
    desc: vi.fn((col) => ({ op: 'desc', col })),
  };
});

import { db } from '@/db';
import { getCurrentParent } from '@/lib/parent-auth';
import { getApiSession } from '@/lib/session';
import { createRegistrationNotification as createServerNotification } from '@/lib/parent-notifications';
import {
  createRegistrationNotification as createActionNotification,
  getNotifications,
  markAllRead,
  markRead,
} from '../actions';

describe('Parent Portal notifications security & tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('server-only createRegistrationNotification (@/lib/parent-notifications)', () => {
    it('rejects cross-organisation or soft-deleted parentId without inserting', async () => {
      vi.mocked(db.query.parents.findFirst).mockResolvedValueOnce(undefined);

      const res = await createServerNotification({
        parentId: 'parent-other-org',
        organisationId: 'org-a',
        status: 'approved',
        childName: 'Amara',
        registrationId: 'reg-1',
      });

      expect(res).toEqual({ ok: false, error: 'Parent does not belong to organisation' });
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it('inserts notification when parentId is active and belongs to organisationId', async () => {
      vi.mocked(db.query.parents.findFirst).mockResolvedValueOnce({
        id: 'parent-org-a',
        organisationId: 'org-a',
      } as never);

      const res = await createServerNotification({
        parentId: 'parent-org-a',
        organisationId: 'org-a',
        status: 'approved',
        childName: 'Amara',
        registrationId: 'reg-1',
      });

      expect(res).toEqual({ ok: true });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'parent-org-a',
          organisationId: 'org-a',
          type: 'registration_approved',
          href: '/portal',
        }),
      );
    });
  });

  describe('Server Action createRegistrationNotification (@/app/portal/notifications/actions)', () => {
    const basePayload = {
      parentId: 'parent-1',
      organisationId: 'org-1',
      status: 'approved' as const,
      childName: 'Leo',
      registrationId: 'reg-1',
    };

    it('returns Unauthorised when caller has no authenticated staff session', async () => {
      vi.mocked(getApiSession).mockResolvedValueOnce(null);

      const res = await createActionNotification(basePayload);
      expect(res).toEqual({ ok: false, error: 'Unauthorised' });
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it('returns Forbidden when caller role is TUTOR', async () => {
      vi.mocked(getApiSession).mockResolvedValueOnce({
        user: { id: 'tutor-1', organisationId: 'org-1', role: 'TUTOR' },
      } as never);

      const res = await createActionNotification(basePayload);
      expect(res).toEqual({ ok: false, error: 'Forbidden' });
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it('returns Forbidden when payload organisationId does not match session.user.organisationId', async () => {
      vi.mocked(getApiSession).mockResolvedValueOnce({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      } as never);

      const res = await createActionNotification({
        ...basePayload,
        organisationId: 'org-2',
      });
      expect(res).toEqual({ ok: false, error: 'Forbidden' });
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it('returns Forbidden when target parentId belongs to another organisation (IDOR)', async () => {
      vi.mocked(getApiSession).mockResolvedValueOnce({
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      } as never);
      vi.mocked(db.query.parents.findFirst).mockResolvedValueOnce({
        id: 'parent-other',
        organisationId: 'org-2',
      } as never);

      const res = await createActionNotification({
        ...basePayload,
        parentId: 'parent-other',
      });
      expect(res).toEqual({ ok: false, error: 'Forbidden' });
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] as const)(
      'allows %s to create notification for an active parent in their own organisation',
      async (role) => {
        vi.mocked(getApiSession).mockResolvedValueOnce({
          user: { id: `staff-${role}`, organisationId: 'org-1', role },
        } as never);
        vi.mocked(db.query.parents.findFirst)
          .mockResolvedValueOnce({ id: 'parent-1', organisationId: 'org-1' } as never)
          .mockResolvedValueOnce({ id: 'parent-1', organisationId: 'org-1' } as never);

        const res = await createActionNotification(basePayload);
        expect(res).toEqual({ ok: true });
        expect(mockInsertValues).toHaveBeenCalledOnce();
      },
    );
  });

  describe('Parent session org-scoping on getNotifications / markAllRead / markRead', () => {
    it('scopes getNotifications, markAllRead, and markRead by both parent.id and parent.organisationId', async () => {
      vi.mocked(getCurrentParent).mockResolvedValue({
        id: 'parent-99',
        organisationId: 'org-99',
      } as never);

      await getNotifications();
      expect(mockSelectWhere).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'and',
          args: expect.arrayContaining([
            expect.objectContaining({ op: 'eq', val: 'parent-99' }),
            expect.objectContaining({ op: 'eq', val: 'org-99' }),
          ]),
        }),
      );

      await markAllRead();
      expect(mockUpdateWhere).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'and',
          args: expect.arrayContaining([
            expect.objectContaining({ op: 'eq', val: 'parent-99' }),
            expect.objectContaining({ op: 'eq', val: 'org-99' }),
          ]),
        }),
      );

      mockUpdateWhere.mockClear();
      await markRead('notif-42');
      expect(mockUpdateWhere).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'and',
          args: expect.arrayContaining([
            expect.objectContaining({ op: 'eq', val: 'notif-42' }),
            expect.objectContaining({ op: 'eq', val: 'parent-99' }),
            expect.objectContaining({ op: 'eq', val: 'org-99' }),
          ]),
        }),
      );
    });
  });
});
