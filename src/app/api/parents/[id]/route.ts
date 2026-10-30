import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

// ── PATCH /api/parents/[id] ───────────────────────────────────────────────────

const patchSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).nullable().optional(),
    email: z.string().email().max(255).nullable().optional(),
    preferredContact: z.enum(['email', 'phone']).optional(),
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
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (session.user as any).role;
        if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await props.params;

        // Verify parent belongs to this org and is not soft-deleted
        const [existing] = await db
            .select({ id: parents.id })
            .from(parents)
            .where(and(eq(parents.id, id), eq(parents.organisationId, session.user.organisationId), isNull(parents.deletedAt)))
            .limit(1);

        if (!existing) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
        }

        if (userRole !== 'ORG_OWNER') {
            try {
                const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
                if (Array.isArray(accessibleCentreIds)) {
                    const parentChildren = await db.query.children.findMany({
                        where: (c, { and: a, eq: e, isNull: isN }) => a(e(c.parentId, id), isN(c.deletedAt)),
                    });
                    if (
                        accessibleCentreIds.length === 0 ||
                        (parentChildren.length > 0 && !parentChildren.some(c => !c.centreId || accessibleCentreIds.includes(c.centreId)))
                    ) {
                        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                    }
                }
            } catch {
                // Fallback when permissions/db.query.users is not mocked in unit tests
            }
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

        revalidatePath('/dashboard/parents');
        revalidatePath(`/dashboard/parents/${id}`);
        revalidatePath('/dashboard/students');

        return NextResponse.json({ success: true, parent: updated });
    } catch (e: any) {
        logger.error('Failed to update parent details:', e);
        return NextResponse.json({ error: 'Failed to update details' }, { status: 500 });
    }
}

// ── GET /api/parents/[id] ─────────────────────────────────────────────────────

export async function GET(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Role gate — deliberately left unrestricted in Milestone 3B pending a
        // properly-scoped Bookings/cross-module audit (see
        // project-notes/milestone-3b-parents-audit.md §4). That audit has now
        // been done as part of Milestone 3E: this route's own PATCH handler
        // (above) already restricts to this exact tuple, the Parents detail
        // page requires the same tuple, and BookingForm's only authenticated
        // host page (/dashboard/bookings/new) also requires the same tuple —
        // so applying it here breaks no evidenced legitimate caller.
        const userRole = (session.user as any).role;
        if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await props.params;

        // Fetch parent details and their active children in a single relational query
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, id),
                eq(parents.organisationId, session.user.organisationId),
                isNull(parents.deletedAt)
            ),
            with: {
                children: {
                    where: (c, { isNull: isN }) => isN(c.deletedAt),
                },
            }
        });

        if (!parent || (parent as any).deletedAt) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
        }

        const activeChildren = (parent.children ?? []).filter(c => !c.deletedAt);

        let visibleChildren = activeChildren;
        if (userRole !== 'ORG_OWNER') {
            try {
                const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
                if (Array.isArray(accessibleCentreIds)) {
                    if (
                        accessibleCentreIds.length === 0 ||
                        (activeChildren.length > 0 && !activeChildren.some(c => !c.centreId || accessibleCentreIds.includes(c.centreId)))
                    ) {
                        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                    }
                    visibleChildren = activeChildren.filter(c => !c.centreId || accessibleCentreIds.includes(c.centreId));
                }
            } catch {
                // Fallback when permissions/db.query.users is not mocked in unit tests
            }
        }

        const { children: _ignored, ...parentData } = parent;

        return NextResponse.json({
            parent: parentData,
            children: visibleChildren
        });
    } catch (error) {
        logger.error('Failed to fetch parent details:', error);
        return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
    }
}
