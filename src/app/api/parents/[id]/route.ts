import { auth } from '@/lib/auth';
import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ── PATCH /api/parents/[id] ───────────────────────────────────────────────────

const patchSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).nullable().optional(),
    email: z.string().email().max(255).nullable().optional(),
    preferredContact: z.enum(['email', 'phone', 'sms']).optional(),
    relationship: z.enum(['mother', 'father', 'guardian', 'other']).nullable().optional(),
    addressLine1: z.string().max(255).nullable().optional(),
    addressLine2: z.string().max(255).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    postcode: z.string().max(10).nullable().optional(),
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

    // Verify parent belongs to this org
    const [existing] = await db
        .select({ id: parents.id })
        .from(parents)
        .where(and(eq(parents.id, id), eq(parents.organisationId, session.user.organisationId)))
        .limit(1);

    if (!existing) {
        return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    const body = patchSchema.safeParse(await req.json());
    if (!body.success) {
        return NextResponse.json({ error: 'Invalid request body', details: body.error.flatten() }, { status: 400 });
    }

    const data = body.data;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (data.firstName !== undefined) updates.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updates.lastName = data.lastName.trim();
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.email !== undefined) updates.email = data.email;
    if (data.preferredContact !== undefined) updates.preferredContact = data.preferredContact;
    if (data.relationship !== undefined) updates.relationship = data.relationship;
    if (data.addressLine1 !== undefined) updates.addressLine1 = data.addressLine1;
    if (data.addressLine2 !== undefined) updates.addressLine2 = data.addressLine2;
    if (data.city !== undefined) updates.city = data.city;
    if (data.postcode !== undefined) updates.postcode = data.postcode;

    const [updated] = await db
        .update(parents)
        .set(updates)
        .where(eq(parents.id, id))
        .returning();

    return NextResponse.json({ success: true, parent: updated });
}

// ── GET /api/parents/[id] ─────────────────────────────────────────────────────

export async function GET(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await props.params;

        // Fetch parent details and their children in a single relational query
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, id),
                eq(parents.organisationId, session.user.organisationId)
            ),
            with: {
                children: true,
            }
        });

        if (!parent) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
        }

        const { children: parentChildren, ...parentData } = parent;

        return NextResponse.json({
            parent: parentData,
            children: parentChildren
        });
    } catch (error) {
        console.error('Failed to fetch parent details:', error);
        return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
    }
}
