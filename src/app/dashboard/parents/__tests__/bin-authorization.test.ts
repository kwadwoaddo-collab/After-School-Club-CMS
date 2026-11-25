import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hardDeleteParent, restoreParent, softDeleteParent } from '../bin.actions';
import { db } from '@/db';
import { requireApiAuth } from '@/lib/require-auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

vi.mock('@/lib/require-auth', () => ({
  requireApiAuth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: vi.fn(),
}));

const mockAuditValues = vi.fn().mockResolvedValue(true);

vi.mock('@/db', () => ({
  db: {
    query: {
      parents: {
        findFirst: vi.fn(),
      },
      children: {
        findMany: vi.fn(),
      },
      bookings: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn((cb) =>
      cb({
        query: {
          parents: {
            findFirst: vi.fn().mockResolvedValue({ deletedAt: new Date() }),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(true),
          })),
        })),
        insert: vi.fn(() => ({
          values: mockAuditValues,
        })),
      })
    ),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(true),
    })),
    insert: vi.fn(() => ({
      values: mockAuditValues,
    })),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Recovery Bin & Purge Authorization (D5.R + Wave 4 Fail-Closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserAccessibleCentreIds as any).mockReset();
    (db.query.parents.findFirst as any).mockReset();
    (db.query.children.findMany as any).mockReset();
    ((db.query as any).bookings.findFirst as any).mockReset();
    (getUserAccessibleCentreIds as any).mockResolvedValue(['centre-1']);
    (db.query.children.findMany as any).mockResolvedValue([
      { id: 'child-1', parentId: 'parent-1', centreId: 'centre-1' },
    ]);
    ((db.query as any).bookings.findFirst as any).mockResolvedValue(null);
  });

  describe('hardDeleteParent', () => {
    it('allows ORG_OWNER to invoke hardDeleteParent and logs audit event', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'owner-1',
        organisationId: 'org-1',
        role: 'ORG_OWNER',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-1' });

      const res = await hardDeleteParent('parent-1');
      expect(res).toEqual({ success: true });
      expect(requireApiAuth).toHaveBeenCalledWith({ roles: ['ORG_OWNER'] });
      expect(mockAuditValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          userId: 'owner-1',
          eventType: 'parent_hard_deleted',
        })
      );
    });

    it('rejects MANAGER from calling hardDeleteParent', async () => {
      (requireApiAuth as any).mockResolvedValueOnce(null);

      await expect(hardDeleteParent('parent-1')).rejects.toThrow('Unauthorized');
      expect(requireApiAuth).toHaveBeenCalledWith({ roles: ['ORG_OWNER'] });
    });

    it('rejects FRONT_DESK from calling hardDeleteParent', async () => {
      (requireApiAuth as any).mockResolvedValueOnce(null);

      await expect(hardDeleteParent('parent-1')).rejects.toThrow('Unauthorized');
    });

    it('rejects TUTOR from calling hardDeleteParent', async () => {
      (requireApiAuth as any).mockResolvedValueOnce(null);

      await expect(hardDeleteParent('parent-1')).rejects.toThrow('Unauthorized');
    });

    it('rejects unauthenticated calls to hardDeleteParent', async () => {
      (requireApiAuth as any).mockResolvedValueOnce(null);

      await expect(hardDeleteParent('parent-1')).rejects.toThrow('Unauthorized');
    });

    it('enforces organisation isolation (cannot purge parent belonging to another org)', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'owner-1',
        organisationId: 'org-1',
        role: 'ORG_OWNER',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce(null);

      await expect(hardDeleteParent('foreign-parent-id')).rejects.toThrow('Parent not found');
    });
  });

  describe('restoreParent', () => {
    it('allows ORG_OWNER to restore a soft-deleted family even when childless', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'owner-1',
        organisationId: 'org-1',
        role: 'ORG_OWNER',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-1' });
      (db.query.children.findMany as any).mockResolvedValue([]);

      const res = await restoreParent('parent-1');
      expect(res).toEqual({ success: true });
      expect(requireApiAuth).toHaveBeenCalledWith({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    });

    it('allows MANAGER to restore a soft-deleted family linked to their centre', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'manager-1',
        organisationId: 'org-1',
        role: 'MANAGER',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-1' });

      const res = await restoreParent('parent-1');
      expect(res).toEqual({ success: true });
      expect(getUserAccessibleCentreIds).toHaveBeenCalledWith('manager-1');
    });

    it('allows FRONT_DESK to restore a soft-deleted family linked to their centre', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'front-desk-1',
        organisationId: 'org-1',
        role: 'FRONT_DESK',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-1' });

      const res = await restoreParent('parent-1');
      expect(res).toEqual({ success: true });
    });

    it('rejects TUTOR from restoring a family', async () => {
      (requireApiAuth as any).mockResolvedValueOnce(null);

      await expect(restoreParent('parent-1')).rejects.toThrow('Unauthorized');
    });

    it('fails closed when getUserAccessibleCentreIds throws for MANAGER', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'manager-1',
        organisationId: 'org-1',
        role: 'MANAGER',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-1' });
      (getUserAccessibleCentreIds as any).mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(restoreParent('parent-1')).rejects.toThrow('DB connection lost');
    });

    it('blocks MANAGER from restoring or soft-deleting childless or unassigned-centre parents', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        user: { id: 'manager-1', role: 'MANAGER' },
        organisationId: 'org-1',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-childless' });
      (db.query.children.findMany as any).mockResolvedValueOnce([]);

      await expect(softDeleteParent('parent-childless')).rejects.toThrow('Unauthorized');

      (requireApiAuth as any).mockResolvedValueOnce({
        user: { id: 'manager-1', role: 'MANAGER' },
        organisationId: 'org-1',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-unassigned' });
      (db.query.children.findMany as any).mockResolvedValueOnce([
        { id: 'child-unassigned', parentId: 'parent-unassigned', centreId: null },
      ]);

      await expect(softDeleteParent('parent-unassigned')).rejects.toThrow('Unauthorized');
    });

    it('logs parent_soft_deleted audit event when softDeleteParent succeeds', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        user: { id: 'manager-1', role: 'MANAGER' },
        organisationId: 'org-1',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-1' });

      const res = await softDeleteParent('parent-1');
      expect(res).toEqual({ success: true });
      expect(mockAuditValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          userId: 'manager-1',
          eventType: 'parent_soft_deleted',
        })
      );
    });
  });
});
