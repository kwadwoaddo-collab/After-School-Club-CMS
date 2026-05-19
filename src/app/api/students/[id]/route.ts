import { auth } from '@/lib/auth';
import { db } from '@/db';
import { children, parents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    const userRole = (session.user as any).role as string | undefined;

    // 1. Verify the student belongs to the organisation.
    //    Use children.organisationId (direct) with fallback to parent join for
    //    rows created before the migration.
    const [student] = await db
        .select({
            id: children.id,
            parentId: children.parentId,
            centreId: children.centreId,
            organisationId: children.organisationId,
        })
        .from(children)
        .where(eq(children.id, id))
        .limit(1);

    if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Org check: prefer children.organisationId (post-migration), fall back to parent
    let studentOrgId = student.organisationId;
    if (!studentOrgId) {
        const [parent] = await db
            .select({ organisationId: parents.organisationId })
            .from(parents)
            .where(eq(parents.id, student.parentId))
            .limit(1);
        studentOrgId = parent?.organisationId ?? null;
    }

    if (studentOrgId !== session.user.organisationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Centre-level check for non-ORG_OWNER users
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!student.centreId || !accessibleCentreIds.includes(student.centreId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    // 3. Delete the student (cascade handles notes, attendees, registration links)
    await db.delete(children).where(eq(children.id, id));

    return NextResponse.json({ success: true });
}
