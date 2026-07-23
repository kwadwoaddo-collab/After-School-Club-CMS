/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { children, parents, centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { z } from 'zod';

// ── Shared helper: verify student belongs to session org ──────────────────────
async function verifyStudentAccess(
    id: string,
    orgId: string,
    role: string,
    userId: string
): Promise<{ student: any; error?: NextResponse }> {
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
        return { student: null, error: NextResponse.json({ error: 'Student not found' }, { status: 404 }) };
    }

    let studentOrgId = student.organisationId;
    if (!studentOrgId) {
        const [parent] = await db
            .select({ organisationId: parents.organisationId })
            .from(parents)
            .where(eq(parents.id, student.parentId))
            .limit(1);
        studentOrgId = parent?.organisationId ?? null;
    }

    if (studentOrgId !== orgId) {
        return { student: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    if (role !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(userId);
        if (!student.centreId || !accessibleCentreIds.includes(student.centreId)) {
            return { student: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
        }
    }

    return { student };
}

// ── PATCH /api/students/[id] ──────────────────────────────────────────────────

const patchSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    dateOfBirth: z.string().nullable().optional(), // ISO date string or null
    schoolYear: z.string().max(10).optional(),
    notes: z.string().nullable().optional(),
    centreId: z.string().uuid().nullable().optional(),
    flagHomework: z.boolean().optional(),
    flagBehaviour: z.boolean().optional(),
    flagNote: z.string().nullable().optional(),
});

export async function PATCH(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    const role = (session.user as any).role as string;
    const orgId = session.user.organisationId;

    const { student, error } = await verifyStudentAccess(id, orgId, role, session.user.id!);
    if (error) return error;

    const body = patchSchema.safeParse(await req.json());
    if (!body.success) {
        return NextResponse.json({ error: 'Invalid request body', details: body.error.flatten() }, { status: 400 });
    }

    const data = body.data;

    // If centreId is being changed, verify the new centre belongs to the same org
    if (data.centreId !== undefined && data.centreId !== null) {
        const [centre] = await db
            .select({ organisationId: centres.organisationId })
            .from(centres)
            .where(eq(centres.id, data.centreId))
            .limit(1);
        if (!centre || centre.organisationId !== orgId) {
            return NextResponse.json({ error: 'Invalid centre' }, { status: 400 });
        }
    }

    const updates: Record<string, any> = {
        updatedAt: new Date(),
    };
    if (data.firstName !== undefined) updates.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updates.lastName = data.lastName.trim();
    if (data.dateOfBirth !== undefined) updates.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.schoolYear !== undefined) updates.schoolYear = data.schoolYear;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.centreId !== undefined) updates.centreId = data.centreId;
    if (data.flagHomework !== undefined) updates.flagHomework = data.flagHomework;
    if (data.flagBehaviour !== undefined) updates.flagBehaviour = data.flagBehaviour;
    if (data.flagNote !== undefined) updates.flagNote = data.flagNote;

    const [updated] = await db
        .update(children)
        .set(updates)
        .where(eq(children.id, id))
        .returning();

    return NextResponse.json({ success: true, student: updated });
}

// ── DELETE /api/students/[id] ─────────────────────────────────────────────────

export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    const role = (session.user as any).role as string;
    const orgId = session.user.organisationId;

    const { student, error } = await verifyStudentAccess(id, orgId, role, session.user.id!);
    if (error) return error;

    // Delete the student (cascade handles notes, attendees, registration links)
    await db.delete(children).where(eq(children.id, id));

    return NextResponse.json({ success: true });
}
