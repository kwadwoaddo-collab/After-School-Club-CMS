'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { db } from '@/db';
import { children, parents } from '@/db/schema';
import { eq, and, or, inArray, isNull, desc } from 'drizzle-orm';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

/**
 * Milestone 3I, O.3/O.4/O.5: this is Reports' student-CSV-export data
 * source (its only caller is src/app/dashboard/reports/ReportsClient.tsx —
 * grep verified). It previously blocked only TUTOR — unlike the Reports
 * *page*, which also redirects FRONT_DESK away — and had no centre scoping
 * or soft-delete filtering at all (org-gated only), unlike the frozen
 * Students list page (src/app/dashboard/students/page.tsx:94-109), which
 * restricts its own "all centres" view to
 * `inArray(children.centreId, accessibleCentreIds) OR children.centreId IS
 * NULL` (children can be centre-less) and excludes soft-deleted children
 * and parents. All three fixed narrowly to mirror that established
 * precedent exactly. See project-notes/milestone-3i-reports-audit.md,
 * O.3/O.4/O.5.
 */
export async function getStudentExportData() {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Only Owner/Manager may export reports (Tutor and Front Desk cannot)
    const exportRole = (session.user as any).role;
    if (exportRole === 'TUTOR' || exportRole === 'FRONT_DESK') {
        throw new Error('Forbidden: only Owner/Manager may export reports');
    }

    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (accessibleCentreIds.length === 0) return [];

    return await db
        .select({
            studentId: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            parentFirstName: parents.firstName,
            parentLastName: parents.lastName,
            parentEmail: parents.email,
            parentPhone: parents.phone,
            createdAt: children.createdAt,
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(and(
            eq(parents.organisationId, session.user.organisationId),
            or(
                inArray(children.centreId, accessibleCentreIds),
                isNull(children.centreId),
            ),
            isNull(children.deletedAt),
            isNull(parents.deletedAt),
        ))
        .orderBy(desc(children.createdAt));
}

