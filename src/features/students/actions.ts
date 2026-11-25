'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '@/db';
import {
    auditEvents,
    children,
    parents,
    studentEnrolmentEvents,
} from '@/db/schema';
import { eq, and, or, inArray, isNull, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireTenantSession } from '@/lib/session';
import { assertOrgActive } from '@/lib/org-approval-guard';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
import { confirmedEnrolmentChildSql } from '@/lib/enrolment/finance-eligibility';
import { defaultLifecycleReason, lifecycleInput } from './lifecycle-validation';
import {
    applyReactivatedBillingSideEffects,
    applyStoppedBillingSideEffects,
} from './lifecycle-billing';

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

export interface ChangeStudentLifecycleInput {
    childId: string;
    status: 'active' | 'paused' | 'stopped';
    effectiveDate?: string;
    reason?: string;
    expectedRestartDate?: string | null;
    nextContactDate?: string | null;
    feeReviewConfirmed?: boolean;
}

export async function changeStudentLifecycle(input: ChangeStudentLifecycleInput) {
    const session = await requireTenantSession();
    const organisationId = session?.user?.organisationId;
    const userId = session?.user?.id;
    if (!organisationId || !userId) throw new Error('Unauthorized');

    await assertOrgActive(organisationId);

    const role = (session.user as any)?.role as string | undefined;
    if (!role || !['ORG_OWNER', 'MANAGER'].includes(role)) {
        throw new Error('Only an Owner or Manager can change enrolment status');
    }

    const today = enrolmentBusinessDate();
    const effectiveDate = input.effectiveDate || today;
    const reason = defaultLifecycleReason(input.status, input.reason);

    const parsed = lifecycleInput.safeParse({
        action: 'status',
        status: input.status,
        effectiveDate,
        reason,
        expectedRestartDate: input.expectedRestartDate ?? null,
        nextContactDate: input.nextContactDate ?? null,
        feeReviewConfirmed: input.feeReviewConfirmed,
    });
    if (!parsed.success || parsed.data.action !== 'status') {
        throw new Error(parsed.success ? 'Invalid lifecycle action' : (parsed.error.issues[0]?.message || 'Invalid lifecycle details'));
    }
    const data = parsed.data;

    const accessibleIds = role !== 'ORG_OWNER'
        ? await getUserAccessibleCentreIds(userId)
        : null;

    await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`enrolment:${input.childId}`}))`);
        const child = await tx.query.children.findFirst({
            where: and(
                eq(children.id, input.childId),
                eq(children.organisationId, organisationId),
                isNull(children.deletedAt),
            ),
        });
        if (!child) throw new Error('Student not found');
        if (accessibleIds && (!child.centreId || !accessibleIds.includes(child.centreId))) {
            throw new Error('Forbidden: No access to this centre');
        }

        const [confirmed] = await tx
            .select({ id: children.id })
            .from(children)
            .where(and(
                eq(children.id, input.childId),
                eq(children.organisationId, organisationId),
                confirmedEnrolmentChildSql(),
            ))
            .limit(1);

        if (data.status === 'paused' && !confirmed) {
            throw new Error('Confirm signed up on the registration or confirm existing enrolment first');
        }

        if (data.status === 'active' && !confirmed) {
            await tx
                .update(children)
                .set({ isRegistered: true, updatedAt: new Date() })
                .where(and(eq(children.id, input.childId), eq(children.organisationId, organisationId)));
            await tx.insert(auditEvents).values({
                organisationId,
                userId,
                eventType: 'manual_student_enrolment_confirmed',
                eventData: JSON.stringify({ childId: input.childId, confirmedBy: userId }),
            });
        }

        const feeReviewConfirmed = data.status === 'active' ? (input.feeReviewConfirmed ?? true) : false;

        await tx.insert(studentEnrolmentEvents).values({
            childId: input.childId,
            organisationId,
            status: data.status,
            effectiveDate: data.effectiveDate,
            reason: data.reason,
            expectedRestartDate: data.expectedRestartDate ?? null,
            nextContactDate: data.nextContactDate ?? null,
            feeReviewConfirmed,
            billingReviewedFrom: feeReviewConfirmed ? data.effectiveDate : null,
            createdBy: userId,
        });

        await tx.insert(auditEvents).values({
            organisationId,
            userId,
            eventType: 'student_enrolment_status_changed',
            eventData: JSON.stringify({
                childId: input.childId,
                ...data,
                feeReviewConfirmed,
            }),
        });

        if (data.status === 'stopped') {
            await applyStoppedBillingSideEffects(tx, {
                childId: input.childId,
                parentId: child.parentId,
                organisationId,
                effectiveDate: data.effectiveDate,
                today,
            });
        } else if (data.status === 'active' && feeReviewConfirmed) {
            await applyReactivatedBillingSideEffects(tx, {
                childId: input.childId,
                organisationId,
            });
        }
    });

    revalidatePath(`/dashboard/students/${input.childId}`);
    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/registrations');
    revalidatePath('/dashboard/attendance');

    return { success: true };
}
