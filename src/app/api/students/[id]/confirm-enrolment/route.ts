import { isValidEnrolmentStartDate } from '@/lib/enrolment/start-date';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { children, registrationChildren, auditEvents } from '@/db/schema';
import { requireApiAuth } from '@/lib/require-auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const input = z.object({ reason: z.string().trim().min(5).max(1000), startDate: z.string().refine(isValidEnrolmentStartDate, 'Invalid start date') });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER'] });
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    const parsed = input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'A reason and valid agreed start date are required' }, { status: 400 });
    const child = await db.query.children.findFirst({ where: and(eq(children.id, id), eq(children.organisationId, auth.organisationId), isNull(children.deletedAt)) });
    if (!child) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (auth.user.role !== 'ORG_OWNER') {
        const ids = await getUserAccessibleCentreIds(auth.user.id);
        if (!child.centreId || !ids.includes(child.centreId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const linked = await db.query.registrationChildren.findFirst({ where: eq(registrationChildren.childId, id) });
    if (linked) return NextResponse.json({ error: 'This student has a registration. Confirm signed up on that registration instead.' }, { status: 409 });
    await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`enrolment:${id}`}))`);
        await tx.update(children).set({ isRegistered: true, registeredAt: new Date(), updatedAt: new Date() }).where(and(eq(children.id, id), eq(children.organisationId, auth.organisationId)));
        const currentLink = await tx.query.registrationChildren.findFirst({ where: eq(registrationChildren.childId, id) });
        if (currentLink) throw new Error('A registration was linked during confirmation. Confirm signed up on that registration instead.');
        await tx.insert(auditEvents).values({ organisationId: auth.organisationId, userId: auth.user.id, eventType: 'manual_student_enrolment_confirmed', eventData: JSON.stringify({ childId: id, ...parsed.data, confirmedAt: new Date().toISOString() }) });
    });
    revalidatePath(`/dashboard/students/${id}`);
    revalidatePath('/dashboard/finance');
    return NextResponse.json({ success: true });
}
