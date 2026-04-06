import { auth } from '@/lib/auth';
import { db } from '@/db';
import { children, parents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;

    // Verify the student belongs to the organisation before deleting
    const [student] = await db
        .select({ parentId: children.parentId })
        .from(children)
        .where(eq(children.id, id))
        .limit(1);

    if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const [parent] = await db
        .select({ organisationId: parents.organisationId })
        .from(parents)
        .where(eq(parents.id, student.parentId))
        .limit(1);

    if (!parent || parent.organisationId !== session.user.organisationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the student (cascade handles notes, attendees, registration links)
    await db.delete(children).where(eq(children.id, id));

    return NextResponse.json({ success: true });
}
