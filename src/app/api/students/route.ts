import { auth } from '@/lib/auth';
import { db } from '@/db';
import { parents, children } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const data = schema.parse(body);

        // Check if parent exists by email
        let parentId;
        const existingParent = await db.query.parents.findFirst({
            where: eq(parents.email, data.parentEmail)
        });

        if (existingParent) {
            parentId = existingParent.id;
        } else {
            const [newParent] = await db.insert(parents).values({
                firstName: data.parentFirstName,
                lastName: data.parentLastName,
                email: data.parentEmail,
                phone: data.parentPhone,
                organisationId: session.user.organisationId, // Link to Org
                preferredContact: 'email',
            }).returning();
            parentId = newParent.id;
        }

        // Create Child
        await db.insert(children).values({
            parentId: parentId,
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: new Date(data.dateOfBirth),
            schoolYear: data.schoolYear,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add Student error:', error);
        return NextResponse.json({ error: 'Failed to add student' }, { status: 500 });
    }
}
