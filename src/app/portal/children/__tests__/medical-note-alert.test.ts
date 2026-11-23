import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentParentMock = vi.fn();
vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: (...args: unknown[]) => getCurrentParentMock(...args),
}));

const findFirstChildMock = vi.fn();
const insertValuesMock = vi.fn();
const insertMock = vi.fn((..._args: unknown[]) => ({
    values: (...args: unknown[]) => insertValuesMock(...args),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            children: {
                findFirst: (...args: unknown[]) => findFirstChildMock(...args),
            },
        },
        insert: (...args: unknown[]) => insertMock(...args),
    },
}));

const notifyOwnersMock = vi.fn();
vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: (...args: unknown[]) => notifyOwnersMock(...args),
}));

const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
vi.mock('@/lib/logger', () => ({
    logger: {
        warn: (...args: unknown[]) => loggerWarnMock(...args),
        error: (...args: unknown[]) => loggerErrorMock(...args),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

import { addMedicalNote } from '../[id]/actions';

describe('addMedicalNote — club owner notification (PR #4b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentParentMock.mockResolvedValue({
            id: 'parent-1',
            firstName: 'Nadia',
            lastName: 'Patel',
            organisationId: 'org-123',
        });
        findFirstChildMock.mockResolvedValue({
            id: 'child-1',
            parentId: 'parent-1',
            organisationId: 'org-123',
            firstName: 'Aarav',
            lastName: 'Patel',
        });
        insertValuesMock.mockResolvedValue(undefined);
        notifyOwnersMock.mockResolvedValue(undefined);
    });

    it('inserts the Medical note and notifies club owners with orgId and child context', async () => {
        const res = await addMedicalNote('child-1', '  Developed penicillin allergy — carry emergency card  ');

        expect(res).toEqual({ success: true });
        expect(insertValuesMock).toHaveBeenCalledTimes(1);
        expect(insertValuesMock).toHaveBeenCalledWith({
            childId: 'child-1',
            content: 'Developed penicillin allergy — carry emergency card',
            authorName: 'Nadia Patel (Parent)',
            category: 'Medical',
        });

        expect(notifyOwnersMock).toHaveBeenCalledTimes(1);
        expect(notifyOwnersMock).toHaveBeenCalledWith(
            expect.objectContaining({
                orgId: 'org-123',
                type: 'system',
                title: 'Parent Added Medical Note',
                message: expect.stringContaining('Aarav Patel'),
            })
        );
        expect(loggerWarnMock).not.toHaveBeenCalled();
    });

    it('does NOT fail saving the parent medical note when notifyOwners throws/rejects', async () => {
        notifyOwnersMock.mockRejectedValueOnce(new Error('Notifications DB unavailable'));

        const res = await addMedicalNote('child-1', 'Asthma inhaler updated to Clenil Modulite');

        expect(res).toEqual({ success: true });
        expect(insertValuesMock).toHaveBeenCalledTimes(1);
        expect(notifyOwnersMock).toHaveBeenCalledTimes(1);
        expect(loggerWarnMock).toHaveBeenCalledTimes(1);
        expect(loggerErrorMock).not.toHaveBeenCalled();
    });

    it('rejects unauthorized or empty submissions without notifying owners', async () => {
        const emptyRes = await addMedicalNote('child-1', '   ');
        expect(emptyRes).toEqual({ success: false, error: 'Note content cannot be empty' });
        expect(insertValuesMock).not.toHaveBeenCalled();
        expect(notifyOwnersMock).not.toHaveBeenCalled();

        getCurrentParentMock.mockResolvedValueOnce(null);
        const unauthRes = await addMedicalNote('child-1', 'Allergic to sesame');
        expect(unauthRes).toEqual({ success: false, error: 'Unauthorized' });
        expect(notifyOwnersMock).not.toHaveBeenCalled();
    });
});
