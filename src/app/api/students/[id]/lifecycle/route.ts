import { NextResponse } from 'next/server';
import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditEvents, children, studentEnrolmentEvents, studentFollowUpContacts } from '@/db/schema';
import { requireApiAuth } from '@/lib/require-auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { confirmedEnrolmentChildSql } from '@/lib/enrolment/finance-eligibility';
import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
import { lifecycleInput } from '@/features/students/lifecycle-validation';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    const parsed = lifecycleInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid lifecycle details' }, { status: 400 });
    const data = parsed.data;
    if (data.action === 'status' && !['ORG_OWNER', 'MANAGER'].includes(auth.user.role)) return NextResponse.json({ error: 'Only an Owner or Manager can change enrolment status' }, { status: 403 });
    const accessibleIds = auth.user.role === 'ORG_OWNER' ? null : await getUserAccessibleCentreIds(auth.user.id);
    try {
        const result = await db.transaction(async tx => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`enrolment:${id}`}))`);
            const child = await tx.query.children.findFirst({ where: and(eq(children.id, id), eq(children.organisationId, auth.organisationId), isNull(children.deletedAt)) });
            if (!child) return { error: 'Student not found', status: 404 };
            if (accessibleIds && (!child.centreId || !accessibleIds.includes(child.centreId))) return { error: 'Forbidden: No access to this centre', status: 403 };
            if (data.action === 'status') {
                const [confirmed] = await tx.select({ id: children.id }).from(children).where(and(eq(children.id, id), eq(children.organisationId, auth.organisationId), confirmedEnrolmentChildSql())).limit(1);
                const previous = data.status === 'active'
                    ? await tx.query.studentEnrolmentEvents.findFirst({ where: and(eq(studentEnrolmentEvents.childId, id), eq(studentEnrolmentEvents.organisationId, auth.organisationId), lte(studentEnrolmentEvents.effectiveDate, data.effectiveDate)), orderBy: [desc(studentEnrolmentEvents.effectiveDate), desc(studentEnrolmentEvents.createdAt), desc(studentEnrolmentEvents.id)] })
                    : null;
                const isReactivatingStopped = data.status === 'active' && previous?.status === 'stopped';
                if (!confirmed && data.status !== 'stopped' && !isReactivatingStopped) {
                    return { error: 'Confirm signed up on the registration or confirm existing enrolment first', status: 409 };
                }
                if (data.status === 'active') {
                    if (!previous || previous.status === 'active') return { error: 'This student is already active for that date', status: 409 };
                }
                const feeReviewConfirmed = isReactivatingStopped ? Boolean(data.feeReviewConfirmed ?? true) : false;
                await tx.insert(studentEnrolmentEvents).values({
                    childId: id,
                    organisationId: auth.organisationId,
                    status: data.status,
                    effectiveDate: data.effectiveDate,
                    reason: data.reason,
                    expectedRestartDate: data.expectedRestartDate ?? null,
                    nextContactDate: data.nextContactDate ?? null,
                    feeReviewConfirmed,
                    ...(feeReviewConfirmed ? { billingReviewedFrom: data.effectiveDate } : {}),
                    createdBy: auth.user.id,
                });
                await tx.insert(auditEvents).values({ organisationId: auth.organisationId, userId: auth.user.id, eventType: 'student_enrolment_status_changed', eventData: JSON.stringify({ childId: id, ...data, feeReviewConfirmed }) });
                if (data.status === 'stopped' && child.parentId && typeof (tx as { update?: unknown }).update === 'function') {
                    const { applyStoppedBillingSideEffects } = await import('@/features/students/actions');
                    await applyStoppedBillingSideEffects(tx, {
                        childId: id,
                        parentId: child.parentId,
                        organisationId: auth.organisationId,
                        effectiveDate: data.effectiveDate,
                        today: enrolmentBusinessDate(),
                    });
                } else if (isReactivatingStopped && feeReviewConfirmed && typeof (tx as { update?: unknown }).update === 'function') {
                    const { applyReactivatedBillingSideEffects } = await import('@/features/students/actions');
                    await applyReactivatedBillingSideEffects(tx, {
                        childId: id,
                        organisationId: auth.organisationId,
                    });
                }
            } else {
                const contactedAt = new Date();
                await tx.insert(studentFollowUpContacts).values({ childId: id, organisationId: auth.organisationId, contactedAt, notes: data.notes, nextContactDate: data.nextContactDate ?? null, createdBy: auth.user.id });
                await tx.insert(auditEvents).values({ organisationId: auth.organisationId, userId: auth.user.id, eventType: 'student_follow_up_contact_logged', eventData: JSON.stringify({ childId: id, contactedAt: contactedAt.toISOString(), nextContactDate: data.nextContactDate ?? null }) });
            }
            return { success: true };
        });
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
        revalidatePath(`/dashboard/students/${id}`); revalidatePath('/dashboard/students'); revalidatePath('/dashboard/finance'); revalidatePath('/dashboard/registrations');
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: 'The change could not be saved. No partial update was committed; please try again.' }, { status: 500 });
    }
}
