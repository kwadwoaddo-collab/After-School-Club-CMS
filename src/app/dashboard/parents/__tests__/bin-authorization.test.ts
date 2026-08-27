import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hardDeleteParent, restoreParent, softDeleteParent } from '../bin.actions';
import { db } from '@/db';
import { requireApiAuth } from '@/lib/require-auth';

vi.mock('@/lib/require-auth', () => ({
  requireApiAuth: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      parents: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn((cb) => cb({
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
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(true),
    })),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Recovery Bin & Purge Authorization (D5.R)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hardDeleteParent', () => {
    it('allows ORG_OWNER to invoke hardDeleteParent', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'owner-1',
        organisationId: 'org-1',
        role: 'ORG_OWNER',
      });
      (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-1' });

      const res = await hardDeleteParent('parent-1');
      expect(res).toEqual({ success: true });
      expect(requireApiAuth).toHaveBeenCalledWith({ roles: ['ORG_OWNER'] });
    });

    it('rejects MANAGER from calling hardDeleteParent', async () => {
      (requireApiAuth as any).mockResolvedValueOnce(null); // requireApiAuth returns null when role not allowed

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
      (db.query.parents.findFirst as any).mockResolvedValueOnce(null); // Parent not in org-1

      await expect(hardDeleteParent('foreign-parent-id')).rejects.toThrow('Parent not found');
    });
  });

  describe('restoreParent', () => {
    it('allows ORG_OWNER to restore a soft-deleted family', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'owner-1',
        organisationId: 'org-1',
        role: 'ORG_OWNER',
      });
      (db.query.parents.findFirst as any)
        .mockResolvedValueOnce({ id: 'parent-1' }) // owned check
        .mockResolvedValueOnce({ deletedAt: new Date() }); // parentToRestore check

      const res = await restoreParent('parent-1');
      expect(res).toEqual({ success: true });
      expect(requireApiAuth).toHaveBeenCalledWith({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    });

    it('allows MANAGER to restore a soft-deleted family', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'manager-1',
        organisationId: 'org-1',
        role: 'MANAGER',
      });
      (db.query.parents.findFirst as any)
        .mockResolvedValueOnce({ id: 'parent-1' })
        .mockResolvedValueOnce({ deletedAt: new Date() });

      const res = await restoreParent('parent-1');
      expect(res).toEqual({ success: true });
    });

    it('allows FRONT_DESK to restore a soft-deleted family', async () => {
      (requireApiAuth as any).mockResolvedValueOnce({
        userId: 'front-desk-1',
        organisationId: 'org-1',
        role: 'FRONT_DESK',
      });
      (db.query.parents.findFirst as any)
        .mockResolvedValueOnce({ id: 'parent-1' })
        .mockResolvedValueOnce({ deletedAt: new Date() });

      const res = await restoreParent('parent-1');
      expect(res).toEqual({ success: true });
    });

    it('rejects TUTOR from restoring a family', async () => {
      (requireApiAuth as any).mockResolvedValueOnce(null);

      await expect(restoreParent('parent-1')).rejects.toThrow('Unauthorized');
    });
  });
});
