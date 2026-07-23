import { logger } from '@/lib/logger';
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
    const orgId = session?.user?.organisationId;
    if (!orgId) {
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
                eq(centres.organisationId, orgId)
            ),
            columns: { id: true },
        });

        if (!centre) {
            return NextResponse.json(
                { error: 'Invalid centre: does not belong to your organisation' },
                { status: 400 }
            );
        }

        const newChildId = await db.transaction(async (tx) => {
            let pId: string;
            const existingParent = await tx.query.parents.findFirst({
                where: and(
                    eq(parents.email, data.parentEmail),
                    eq(parents.organisationId, orgId)
                ),
            });

            if (existingParent) {
                pId = existingParent.id;
            } else {
                const [newParent] = await tx.insert(parents).values({
                    firstName: data.parentFirstName,
                    lastName: data.parentLastName,
                    email: data.parentEmail,
                    phone: data.parentPhone,
                    organisationId: orgId,
                    preferredContact: 'email',
                }).returning();
                pId = newParent.id;
            }

            // Create Child — with direct organisationId and centreId
            const [newChild] = await tx.insert(children).values({
                parentId: pId,
                organisationId: orgId,
                centreId: data.centreId,
                firstName: data.firstName,
                lastName: data.lastName,
                dateOfBirth: new Date(data.dateOfBirth),
                schoolYear: data.schoolYear,
            }).returning({ id: children.id });

            return newChild.id;
        });

        return NextResponse.json({ success: true, id: newChildId });
    } catch (error) {
        logger.error('Add Student error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Validation failed',
                details: error.issues
            }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to add student' }, { status: 500 });
    }
}
