import { auth } from '@/lib/auth';
import { db } from '@/db';
import { parents, children, centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    dateOfBirth: z.string(),
    schoolYear: z.string(),
    parentFirstName: z.string().min(2),
    parentLastName: z.string().min(2),
    parentEmail: z.string().email(),
    parentPhone: z.string().min(10),
    // centreId is now required for staff-added students.
    // It must belong to the session user's organisation.
    centreId: z.string().uuid(),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const data = schema.parse(body);

        // ── Validate centreId belongs to the session user's org ──────────
        // Prevents a staff member assigning a student to a centre from
        // another organisation by forging the POST body.
        const centre = await db.query.centres.findFirst({
            where: and(
                eq(centres.id, data.centreId),
                eq(centres.organisationId, session.user.organisationId)
            ),
            columns: { id: true },
        });

        if (!centre) {
            return NextResponse.json(
                { error: 'Invalid centre: does not belong to your organisation' },
                { status: 400 }
            );
        }

        // Check if parent exists by email within this org
        let parentId: string;
        const existingParent = await db.query.parents.findFirst({
            where: and(
                eq(parents.email, data.parentEmail),
                eq(parents.organisationId, session.user.organisationId)
            ),
        });

        if (existingParent) {
            parentId = existingParent.id;
        } else {
            const [newParent] = await db.insert(parents).values({
                firstName: data.parentFirstName,
                lastName: data.parentLastName,
                email: data.parentEmail,
                phone: data.parentPhone,
                organisationId: session.user.organisationId,
                preferredContact: 'email',
            }).returning();
            parentId = newParent.id;
        }

        // Create Child — with direct organisationId and centreId
        await db.insert(children).values({
            parentId,
            organisationId: session.user.organisationId,
            centreId: data.centreId,
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth),
            schoolYear: data.schoolYear,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add Student error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Validation failed',
                details: error.errors
            }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to add student' }, { status: 500 });
    }
}
