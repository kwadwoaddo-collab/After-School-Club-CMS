import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';

const requireTenantSessionMock = vi.fn();
const getUserAccessibleCentreIdsMock = vi.fn();
const getCurrentParentMock = vi.fn();
const notifyOwnersMock = vi.fn();

const studentNotesFindManyMock = vi.fn();
const studentNotesFindFirstMock = vi.fn();
const childrenFindFirstMock = vi.fn();
const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const deleteWhereMock = vi.fn();

vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => requireTenantSessionMock(...args),
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIdsMock(...args),
}));

vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: (...args: unknown[]) => getCurrentParentMock(...args),
}));

vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: (...args: unknown[]) => notifyOwnersMock(...args),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/db', () => ({
    db: {
        select: vi.fn(() => ({
            from: () => ({
                where: () => ({
                    limit: () => Promise.resolve([
                        {
                            id: 'child-1',
                            parentId: 'parent-1',
                            centreId: 'centre-1',
                            organisationId: 'org-1',
                        },
                    ]),
                }),
            }),
        })),
        query: {
            studentNotes: {
                findMany: (...args: unknown[]) => studentNotesFindManyMock(...args),
                findFirst: (...args: unknown[]) => studentNotesFindFirstMock(...args),
            },
            children: {
                findFirst: (...args: unknown[]) => childrenFindFirstMock(...args),
            },
        },
        insert: vi.fn(() => ({
            values: (...args: unknown[]) => insertValuesMock(...args),
        })),
        update: vi.fn(() => ({
            set: () => ({
                where: (...args: unknown[]) => updateWhereMock(...args),
            }),
        })),
        delete: vi.fn(() => ({
            where: (...args: unknown[]) => deleteWhereMock(...args),
        })),
    },
}));

import {
    getStudentNotes,
    addStudentNote,
    editStudentNote,
    deleteStudentNote,
    toggleStudentNotePin,
} from '@/features/students/notes.actions';
import { addMedicalNote } from '@/app/portal/children/[id]/actions';
import InternalNotesTimeline from '@/features/students/components/InternalNotesTimeline';

function makeStaffSession(role: 'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR', id = 'staff-1') {
    return {
        user: {
            id,
            name: 'Staff User',
            organisationId: 'org-1',
            role,
        },
    };
}

describe('P0 Safeguarding & Internal Notes Isolation (SEC-F-01)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getUserAccessibleCentreIdsMock.mockResolvedValue(['centre-1']);
        insertValuesMock.mockResolvedValue([]);
        updateWhereMock.mockResolvedValue([]);
        deleteWhereMock.mockResolvedValue([]);
    });

    it('Parent Portal ChildDetailsPage enforces strict parent-authored medical/health note query filter (closing deleted-staff userId=NULL loophole)', () => {
        const rootDir = path.resolve(__dirname, '../../../../');
        const pageSrc = fs.readFileSync(
            path.join(rootDir, 'src/app/portal/children/[id]/page.tsx'),
            'utf8'
        );

        expect(pageSrc).toContain('isNull(notes.userId)');
        expect(pageSrc).toContain("like(notes.authorName, '% (Parent)')");
        expect(pageSrc).toContain("'Medical', 'Dietary', 'Allergy', 'Health', 'Medication'");
        expect(pageSrc).not.toContain("note.category === 'Safeguarding'");
    });

    it('Parent Portal addMedicalNote rejects Safeguarding and unrecognised categories while allowing Health/Medical/Dietary', async () => {
        getCurrentParentMock.mockResolvedValue({
            id: 'parent-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            organisationId: 'org-1',
        });
        childrenFindFirstMock.mockResolvedValue({
            id: 'child-1',
            firstName: 'Byron',
            lastName: 'Lovelace',
            parentId: 'parent-1',
            organisationId: 'org-1',
        });

        const rejectedSafeguarding = await addMedicalNote('child-1', 'Attempted safeguarding injection', 'Safeguarding');
        expect(rejectedSafeguarding.success).toBe(false);
        expect(rejectedSafeguarding.error).toMatch(/Invalid note category/i);
        expect(insertValuesMock).not.toHaveBeenCalled();

        const acceptedHealth = await addMedicalNote('child-1', 'Uses blue salbutamol inhaler', 'Health');
        expect(acceptedHealth.success).toBe(true);
        expect(insertValuesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                childId: 'child-1',
                userId: null,
                authorName: 'Ada Lovelace (Parent)',
                category: 'Health',
            })
        );
    });

    it('getStudentNotes strips Safeguarding notes for FRONT_DESK and TUTOR while returning them to MANAGER and ORG_OWNER', async () => {
        const mixedNotes = [
            { id: 'n-med', childId: 'child-1', category: 'Medical', content: 'Peanut allergy', createdAt: new Date() },
            { id: 'n-sg', childId: 'child-1', category: 'Safeguarding', content: 'Confidential MASH referral', createdAt: new Date() },
        ];
        studentNotesFindManyMock.mockResolvedValue(mixedNotes);

        requireTenantSessionMock.mockResolvedValue(makeStaffSession('FRONT_DESK'));
        const frontDeskNotes = await getStudentNotes('child-1');
        expect(frontDeskNotes).toHaveLength(1);
        expect(frontDeskNotes[0].id).toBe('n-med');

        requireTenantSessionMock.mockResolvedValue(makeStaffSession('MANAGER'));
        const managerNotes = await getStudentNotes('child-1');
        expect(managerNotes).toHaveLength(2);
    });

    it('blocks FRONT_DESK and TUTOR from creating, editing, pinning, or deleting Safeguarding notes even if userId matches', async () => {
        requireTenantSessionMock.mockResolvedValue(makeStaffSession('FRONT_DESK', 'fd-1'));

        await expect(addStudentNote('child-1', 'Confidential disclosure', 'Safeguarding')).rejects.toThrow(/Forbidden/i);
        await expect(addStudentNote('child-1', 'Case bypass attempt', ' safeguarding ')).rejects.toThrow(/Forbidden/i);

        studentNotesFindFirstMock.mockResolvedValue({
            id: 'note-sg-1',
            childId: 'child-1',
            userId: 'fd-1', // Even if previously authored by fd-1
            category: 'Safeguarding',
            content: 'Confidential record',
        });

        await expect(deleteStudentNote('note-sg-1')).rejects.toThrow(/Forbidden/i);
        await expect(toggleStudentNotePin('note-sg-1', true)).rejects.toThrow(/Forbidden/i);
        await expect(editStudentNote('note-sg-1', 'Updated text', 'General')).rejects.toThrow(/Forbidden/i);

        // Escalation attempt on a General note -> Safeguarding
        studentNotesFindFirstMock.mockResolvedValue({
            id: 'note-gen-1',
            childId: 'child-1',
            userId: 'fd-1',
            category: 'General',
            content: 'Normal note',
        });
        await expect(editStudentNote('note-gen-1', 'Escalating category', 'Safeguarding')).rejects.toThrow(/Forbidden/i);
    });

    it('InternalNotesTimeline hides Safeguarding radio option and filters Safeguarding notes unless canManageSafeguarding is true', () => {
        const notes = [
            { id: '1', content: 'Needs inhaler', authorName: 'Jane', category: 'Medical', createdAt: new Date() },
            { id: '2', content: 'DSL confidential concern', authorName: 'Lead', category: 'Safeguarding', createdAt: new Date() },
        ];

        const frontDeskHtml = renderToStaticMarkup(
            React.createElement(InternalNotesTimeline, {
                childId: 'child-1',
                initialNotes: notes,
                canManageSafeguarding: false,
            })
        );
        expect(frontDeskHtml).toContain('Needs inhaler');
        expect(frontDeskHtml).not.toContain('DSL confidential concern');
        expect(frontDeskHtml).not.toContain('Safeguarding');

        const managerHtml = renderToStaticMarkup(
            React.createElement(InternalNotesTimeline, {
                childId: 'child-1',
                initialNotes: notes,
                canManageSafeguarding: true,
            })
        );
        expect(managerHtml).toContain('DSL confidential concern');
        expect(managerHtml).toContain('Safeguarding');
    });
});
