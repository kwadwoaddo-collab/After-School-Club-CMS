import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * Regression test for the production Students page bug (Milestone 0/0A
 * discovery: KPI header reported "2 students" while the rendered table
 * showed "No students yet").
 *
 * Root cause, confirmed by reading the source (src/app/dashboard/students/
 * page.tsx): NOT a count-vs-list filtering disagreement as the Discovery
 * hypothesis suspected (nullable children.centreId). The count query, the
 * filtered-count query, and the row query all reuse the exact same
 * `conditions` array, so their filtering semantics were already identical.
 *
 * The actual defect is a variable-shadowing bug:
 *
 *   let enrichedStudents: StudentRow[] = [];          // outer, function-scoped
 *   ...
 *   try {
 *     ...
 *     const enrichedStudents: StudentRow[] = studentsList.map(...)  // <-- shadows
 *     ...
 *   } catch { hasError = true; }
 *
 *   <StudentsTable students={enrichedStudents} .../>  // always reads the OUTER []
 *
 * `const enrichedStudents` inside the try block creates a new block-scoped
 * binding that shadows the outer `let`. The computed rows are discarded
 * when the try block ends; the JSX always renders the outer variable, which
 * is never reassigned and stays `[]` — regardless of how many rows the
 * query actually returned. Meanwhile `stats.totalCount` (assigned via
 * `stats = fetchedStats`, a plain assignment, not a shadowing redeclaration)
 * reports the real count correctly. That mismatch between a working KPI and
 * an always-empty list is exactly the reported symptom.
 *
 * This is independently corroborated by ESLint: running `prefer-const` on
 * the pre-fix file flags `'enrichedStudents' is never reassigned. Use
 * 'const' instead` for the outer `let` at line 38 — which is only true
 * because the shadowing bug prevented the (intended) reassignment from ever
 * reaching it.
 *
 * The fix removes the inner `const`/type annotation so the map result
 * assigns to the single outer `enrichedStudents` binding instead of
 * shadowing it.
 *
 * This test drives the real page function with a mocked (but realistic)
 * database layer and asserts the KPI total and the row count passed to
 * <StudentsTable> are consistent — i.e. that the rows the query actually
 * produced are the rows that reach the table, not a stale empty array.
 */

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((path: string) => {
        throw new Error(`REDIRECT:${path}`);
    }),
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

// Build a chainable query-builder stand-in: every builder method returns the
// same object (so `.from().innerJoin().where().orderBy().limit().offset()`
// all resolve back to `chain`), and the chain itself is thenable so `await`
// works no matter which method call in the chain is the last one used by a
// given query (some queries in this page stop at `.where()`, others go all
// the way to `.offset()`).
function makeChain(resolvedValue: unknown) {
    const chain: Record<string, unknown> = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        offset: vi.fn(() => chain),
        then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
    };
    return chain;
}

const orgRow = { id: 'org-1', name: 'Bright Star Academy' };
const statsRow = {
    totalCount: 2,
    registeredCount: 2,
    leadCount: 0,
    medicalAlertCount: 0,
    lowAttendanceCount: 0,
};
const studentRows = [
    {
        id: 'child-1',
        firstName: 'Ava',
        lastName: 'Brown',
        dateOfBirth: new Date('2015-04-01'),
        schoolYear: 'Year 4',
        isRegistered: true,
        source: 'manual',
        parentFirstName: 'Mark',
        parentLastName: 'Brown',
        parentEmail: 'mark@example.com',
        parentPhone: '07700900000',
        parentId: 'parent-1',
        bookingCount: 3,
        pastCount: 3,
        presentCount: 3,
        nextAssessment: null,
        hasMedicalNotes: false,
        hasSafeguardingNotes: false,
    },
    {
        id: 'child-2',
        firstName: 'Sam',
        lastName: 'Brown',
        dateOfBirth: new Date('2017-09-01'),
        schoolYear: 'Year 2',
        isRegistered: true,
        source: 'manual',
        parentFirstName: 'Mark',
        parentLastName: 'Brown',
        parentEmail: 'mark@example.com',
        parentPhone: '07700900000',
        parentId: 'parent-1',
        bookingCount: 1,
        pastCount: 1,
        presentCount: 1,
        nextAssessment: null,
        hasMedicalNotes: false,
        hasSafeguardingNotes: false,
    },
];

function makeDbMock() {
    // Call order in the real page, in sequence:
    //   1. organisations lookup            -> [orgRow]
    //   2. statsQuery                      -> [statsRow]
    //   3. filtered-count query            -> [{ filteredCount: 2 }]
    //   4. paginated studentsList query    -> studentRows
    const selectQueue: unknown[] = [
        [orgRow],
        [statsRow],
        [{ filteredCount: 2 }],
        studentRows,
    ];

    return {
        query: {
            users: {
                findFirst: vi.fn().mockResolvedValue({
                    role: 'ORG_OWNER',
                    organisationId: 'org-1',
                }),
            },
            centres: {
                findMany: vi.fn().mockResolvedValue([
                    { id: 'centre-1', name: 'Dagenham', organisationId: 'org-1' },
                ]),
            },
        },
        select: vi.fn(() => makeChain(selectQueue.shift())),
    };
}

vi.mock('@/db', () => ({ db: makeDbMock() }));

function findElementByType(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
    if (node == null || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findElementByType(child, type);
            if (found) return found;
        }
        return null;
    }
    if (React.isValidElement(node)) {
        if (node.type === type) {
            return node as unknown as { props: Record<string, unknown> };
        }
        const props = node.props as Record<string, unknown>;
        return findElementByType(props?.children, type);
    }
    return null;
}

describe('StudentsPage — KPI/list consistency regression (Workstream 4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('passes the actual queried rows to StudentsTable, matching the KPI total, instead of a stale empty array', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: {
                id: 'user-1',
                organisationId: 'org-1',
                role: 'ORG_OWNER',
                name: 'Test Owner',
                email: 'owner@example.com',
            },
        });

        const { default: StudentsPage } = await import('./page');
        const { default: StudentsTable } = await import(
            '@/features/students/components/StudentsTable'
        );

        const element = await StudentsPage({ searchParams: Promise.resolve({}) });

        // The KPI badge/header reads stats.totalCount, which comes straight
        // from the mocked statsQuery result — that path was never buggy.
        // The regression is specifically about the *list* reflecting the
        // same underlying data: the query returned 2 rows (studentRows,
        // matching statsRow.totalCount = 2 above), so the rows reaching
        // <StudentsTable> must also be those same 2 rows — pre-fix, the
        // shadowing bug meant this array was always [] regardless.
        const tableElement = findElementByType(element, StudentsTable);
        expect(tableElement).not.toBeNull();
        const students = tableElement!.props.students as unknown[];
        expect(students).toHaveLength(statsRow.totalCount);
        expect((students[0] as { id: string }).id).toBe('child-1');
        expect((students[1] as { id: string }).id).toBe('child-2');
    });
});
