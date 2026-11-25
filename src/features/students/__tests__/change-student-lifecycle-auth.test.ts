import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireTenantSessionMock = vi.fn();
const getUserAccessibleCentreIdsMock = vi.fn();
const assertOrgActiveMock = vi.fn();
const loggerErrorMock = vi.fn();

const txExecuteMock = vi.fn();
const childFindFirstMock = vi.fn();
const txSelectLimitMock = vi.fn();
const txInsertValuesMock = vi.fn();
const txUpdateWhereMock = vi.fn();
const dbTransactionMock = vi.fn();
const studentSelectLimitMock = vi.fn();
const studentNotesFindManyMock = vi.fn();
const studentNotesFindFirstMock = vi.fn();

vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => requireTenantSessionMock(...args),
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIdsMock(...args),
}));

vi.mock('@/lib/org-approval-guard', () => ({
    assertOrgActive: (...args: unknown[]) => assertOrgActiveMock(...args),
}));

vi.mock('@/lib/enrolment/finance-eligibility', () => ({
    confirmedEnrolmentChildSql: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        error: (...args: unknown[]) => loggerErrorMock(...args),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/db', () => ({
    db: {
        transaction: (...args: unknown[]) => dbTransactionMock(...args),
        select: vi.fn(() => ({
            from: () => ({
                where: () => ({
                    limit: () => studentSelectLimitMock(),
                }),
            }),
        })),
        query: {
            studentNotes: {
                findMany: (...args: unknown[]) => studentNotesFindManyMock(...args),
                findFirst: (...args: unknown[]) => studentNotesFindFirstMock(...args),
            },
        },
        insert: vi.fn(() => ({
            values: (...args: unknown[]) => txInsertValuesMock(...args),
        })),
        update: vi.fn(() => ({
            set: () => ({
                where: (...args: unknown[]) => txUpdateWhereMock(...args),
            }),
        })),
    },
}));

import * as studentsActionsModule from '@/features/students/actions';
import * as notesActionsModule from '@/features/students/notes.actions';
import { changeStudentLifecycle } from '@/features/students/actions';
import { addStudentNote, editStudentNote, getStudentNotes } from '@/features/students/notes.actions';

describe('Wave 4 P0 SEC-W4-01 & Notes Hardening (fix/w4-be-01)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        assertOrgActiveMock.mockResolvedValue(undefined);
        txExecuteMock.mockResolvedValue([]);
        txInsertValuesMock.mockResolvedValue([]);
        txUpdateWhereMock.mockResolvedValue([]);
        txSelectLimitMock.mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]);
        childFindFirstMock.mockResolvedValue({
            id: '11111111-1111-4111-8111-111111111111',
            parentId: '22222222-2222-4222-8222-222222222222',
            centreId: 'centre-a',
            organisationId: 'org-session',
        });
        dbTransactionMock.mockImplementation(async (cb: any) =>
            cb({
                execute: txExecuteMock,
                query: { children: { findFirst: childFindFirstMock } },
                select: () => ({
                    from: () => ({
                        where: () => ({ limit: txSelectLimitMock }),
                        innerJoin: () => ({ where: () => Promise.resolve([]) }),
                    }),
                }),
                insert: () => ({ values: txInsertValuesMock }),
                update: () => ({ set: () => ({ where: txUpdateWhereMock }) }),
            }),
        );
    });

    it("enforces Next.js 16 'use server' AsyncFunction export rule while preserving getStudentExportData & changeStudentLifecycle", () => {
        const studentExports = Object.entries(studentsActionsModule);
        expect(Object.keys(studentsActionsModule).sort()).toEqual([
            'changeStudentLifecycle',
            'getStudentExportData',
        ]);
        for (const [, value] of studentExports) {
            expect(typeof value).toBe('function');
            expect(value.constructor.name).toBe('AsyncFunction');
        }

        for (const [, value] of Object.entries(notesActionsModule)) {
            expect(typeof value).toBe('function');
            expect(value.constructor.name).toBe('AsyncFunction');
        }
    });

    it('rejects unauthenticated forged { organisationId, userId } payloads before opening any transaction', async () => {
        requireTenantSessionMock.mockRejectedValueOnce(new Error('REDIRECT:/login'));

        await expect(
            changeStudentLifecycle({
                childId: '11111111-1111-4111-8111-111111111111',
                status: 'stopped',
                reason: 'Forged external attack',
                organisationId: 'org-victim',
                userId: 'user-victim-owner',
            } as any),
        ).rejects.toThrow('REDIRECT:/login');

        expect(requireTenantSessionMock).toHaveBeenCalledOnce();
        expect(dbTransactionMock).not.toHaveBeenCalled();
    });

    it('rejects TUTOR and FRONT_DESK callers even when forged { organisationId, userId } are supplied', async () => {
        for (const role of ['TUTOR', 'FRONT_DESK']) {
            vi.clearAllMocks();
            requireTenantSessionMock.mockResolvedValueOnce({
                user: { id: 'staff-1', organisationId: 'org-1', role },
            });

            await expect(
                changeStudentLifecycle({
                    childId: '11111111-1111-4111-8111-111111111111',
                    status: 'stopped',
                    reason: 'Privilege escalation attempt',
                    organisationId: 'org-victim',
                    userId: 'owner-victim',
                } as any),
            ).rejects.toThrow(/Owner or Manager/i);

            expect(assertOrgActiveMock).toHaveBeenCalledWith('org-1');
            expect(dbTransactionMock).not.toHaveBeenCalled();
        }
    });

    it('ignores forged { organisationId, userId } for MANAGER and enforces session tenant + accessible centre IDs', async () => {
        requireTenantSessionMock.mockResolvedValueOnce({
            user: { id: 'manager-session', organisationId: 'org-session', role: 'MANAGER' },
        });
        getUserAccessibleCentreIdsMock.mockResolvedValueOnce(['centre-b']);

        await expect(
            changeStudentLifecycle({
                childId: '11111111-1111-4111-8111-111111111111',
                status: 'paused',
                reason: 'Cross-centre attempt',
                organisationId: 'org-forged',
                userId: 'owner-forged',
            } as any),
        ).rejects.toThrow(/Forbidden: No access to this centre/);

        expect(assertOrgActiveMock).toHaveBeenCalledWith('org-session');
        expect(getUserAccessibleCentreIdsMock).toHaveBeenCalledWith('manager-session');
        expect(txInsertValuesMock).not.toHaveBeenCalled();
    });

    it('writes session userId and organisationId to enrolment and audit events when authorized MANAGER succeeds', async () => {
        requireTenantSessionMock.mockResolvedValueOnce({
            user: { id: 'manager-session', organisationId: 'org-session', role: 'MANAGER' },
        });
        getUserAccessibleCentreIdsMock.mockResolvedValueOnce(['centre-a']);

        const res = await changeStudentLifecycle({
            childId: '11111111-1111-4111-8111-111111111111',
            status: 'paused',
            effectiveDate: '2026-11-25',
            reason: 'Family holiday break',
            organisationId: 'org-forged',
            userId: 'owner-forged',
        } as any);

        expect(res).toEqual({ success: true });
        expect(txInsertValuesMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                organisationId: 'org-session',
                createdBy: 'manager-session',
                status: 'paused',
            }),
        );
        expect(txInsertValuesMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                organisationId: 'org-session',
                userId: 'manager-session',
                eventType: 'student_enrolment_status_changed',
            }),
        );
    });

    it('denies TUTOR access to unassigned (centreId === null) students and enforces <= 5000 char note limit', async () => {
        studentSelectLimitMock.mockResolvedValue([
            {
                id: 'child-unassigned',
                parentId: 'parent-1',
                centreId: null,
                organisationId: 'org-1',
            },
        ]);
        getUserAccessibleCentreIdsMock.mockResolvedValue(['centre-a']);

        requireTenantSessionMock.mockResolvedValue({
            user: { id: 'tutor-1', organisationId: 'org-1', role: 'TUTOR', name: 'Tutor' },
        });

        // getStudentNotes returns [] when assertChildAccess throws Forbidden
        expect(await getStudentNotes('child-unassigned')).toEqual([]);
        expect(studentNotesFindManyMock).not.toHaveBeenCalled();

        // addStudentNote rejects TUTOR on unassigned student
        await expect(addStudentNote('child-unassigned', 'Valid note')).rejects.toThrow('Forbidden');

        // Over-5000-character note rejected on both addStudentNote and editStudentNote
        const oversized = 'x'.repeat(5001);
        await expect(addStudentNote('child-unassigned', oversized)).rejects.toThrow(/cannot exceed 5000 characters/);
        await expect(editStudentNote('note-1', oversized)).rejects.toThrow(/cannot exceed 5000 characters/);
    });
});
