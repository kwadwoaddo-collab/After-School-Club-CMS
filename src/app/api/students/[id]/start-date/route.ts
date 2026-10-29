import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, children, orgMemberships, centreMemberships } from '@/db/schema';
import { requireApiAuth } from '@/lib/require-auth';
import { confirmedEnrolmentChildSql } from '@/lib/enrolment/finance-eligibility';
import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
import { isValidEnrolmentStartDate } from '@/lib/enrolment/start-date';
import { readEnrolmentStart } from '@/features/students/enrolment-start-query';

const input = z.object({ startDate: z.string().refine(isValidEnrolmentStartDate), reason: z.string().trim().min(5).max(1000), expectedVersion: z.uuid().nullable(), correctionId: z.uuid() }).strict();
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER'] });
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id } = await params;
    const parsed = input.safeParse(await req.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: 'Enter a valid start date and a reason of at least five characters.' }, { status: 400 });
    const data = parsed.data;
    if (data.startDate < '1900-01-01' || data.startDate > enrolmentBusinessDate()) return NextResponse.json({ error: 'The actual start date must be between 1 January 1900 and today.' }, { status: 400 });
    try {
        const result = await db.transaction(async tx => {
            await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
            await tx.execute(sql`SET LOCAL statement_timeout = '15s'`);
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'enrolment:' + id}))`);
            const [membership] = await tx.select({ role: orgMemberships.role }).from(orgMemberships).where(and(eq(orgMemberships.userId, auth.user.id), eq(orgMemberships.organisationId, auth.organisationId))).for('share');
            if (!membership || !['ORG_OWNER', 'MANAGER'].includes(membership.role)) return { error: 'Only an Owner or authorised Manager can correct enrolment dates.', status: 403 };
            const [child] = await tx.select().from(children).where(and(eq(children.id, id), eq(children.organisationId, auth.organisationId), isNull(children.deletedAt))).for('update');
            if (!child) return { error: 'Student not found', status: 404 };
            if (membership.role !== 'ORG_OWNER') {
                if (!child.centreId) return { error: 'Assign a centre before a Manager can correct this date.', status: 403 };
                const [centre] = await tx.select({ id: centreMemberships.id }).from(centreMemberships).where(and(eq(centreMemberships.userId, auth.user.id), eq(centreMemberships.centreId, child.centreId))).for('share');
                if (!centre) return { error: 'You do not have access to this centre.', status: 403 };
            }
            const [confirmed] = await tx.select({ id: children.id }).from(children).where(and(eq(children.id, id), eq(children.organisationId, auth.organisationId), confirmedEnrolmentChildSql()));
            if (!confirmed) return { error: 'Confirm existing enrolment or signed-up registration before recording its start date.', status: 409 };
            const [prior] = await tx.select().from(auditEvents).where(and(eq(auditEvents.organisationId, auth.organisationId), eq(auditEvents.eventType, 'student_enrolment_start_date_corrected'), sql`${auditEvents.eventData}::jsonb->>'correctionId' = ${data.correctionId}`));
            if (prior) {
                const event = JSON.parse(prior.eventData ?? '{}');
                if (event.childId !== id || prior.userId !== auth.user.id || event.startDate !== data.startDate || event.reason !== data.reason || event.previousVersion !== data.expectedVersion) return { error: 'This correction request has changed. Reload the profile.', status: 409 };
                return { parentId: child.parentId };
            }
            const current = await readEnrolmentStart(auth.organisationId, id, tx);
            if (current.version !== data.expectedVersion) return { error: 'The start date changed while you were editing. Reload the profile and review it.', status: 409 };
            if (current.date === data.startDate) return { error: 'Choose a different start date before saving a correction.', status: 400 };
            await tx.insert(auditEvents).values({ organisationId: auth.organisationId, userId: auth.user.id, eventType: 'student_enrolment_start_date_corrected', eventData: JSON.stringify({ childId: id, correctionId: data.correctionId, startDate: data.startDate, previousStartDate: current.date, previousVersion: current.version, reason: data.reason, actorId: auth.user.id }) });
            return { parentId: child.parentId };
        });
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
        revalidatePath(`/dashboard/students/${id}`); revalidatePath(`/dashboard/parents/${result.parentId}`); revalidatePath('/dashboard/students');
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'The correction was not confirmed. Reload the profile and review the start date before trying again.' }, { status: 500 });
    }
}
