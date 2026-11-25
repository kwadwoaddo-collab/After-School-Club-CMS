import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { auditEvents, bookings, parents } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

async function hasAccessibleBookingForParent(
    parentId: string,
    accessibleCentreIds: string[]
): Promise<boolean> {
    if (accessibleCentreIds.length === 0) return false;
    const bookingsQuery = (db.query as { bookings?: { findFirst?: (args: unknown) => Promise<unknown> } })?.bookings;
    if (typeof bookingsQuery?.findFirst !== 'function') return false;
    const found = await bookingsQuery.findFirst({
        where: and(
            eq(bookings.parentId, parentId),
            inArray(bookings.centreId, accessibleCentreIds)
        ),
        columns: { id: true },
    });
    return Boolean(found);
}

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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
        }

        const userRole = (session.user as any).role;
        if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE_HEADERS });
        }

        const { id } = await props.params;
        const orgId = session.user.organisationId;

        // Verify parent belongs to this org and is not soft-deleted
        const [existing] = await db
            .select({ id: parents.id, email: parents.email })
            .from(parents)
            .where(and(eq(parents.id, id), eq(parents.organisationId, orgId), isNull(parents.deletedAt)))
            .limit(1);

        if (!existing) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 404, headers: NO_STORE_HEADERS });
        }

        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!Array.isArray(accessibleCentreIds)) {
                throw new Error('Failed to resolve accessible centres for parent PATCH');
            }
            if (accessibleCentreIds.length === 0) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE_HEADERS });
            }
            const parentChildren = await db.query.children.findMany({
                where: (c, { and: a, eq: e, isNull: isN }) => a(e(c.parentId, id), isN(c.deletedAt)),
            });
            const hasAccessibleChild =
                Array.isArray(parentChildren) &&
                parentChildren.some(
                    (c) => Boolean(c.centreId) && accessibleCentreIds.includes(c.centreId as string)
                );
            if (!hasAccessibleChild) {
                const hasBooking = await hasAccessibleBookingForParent(id, accessibleCentreIds);
                if (!hasBooking) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE_HEADERS });
                }
            }
        }

        const rawJson = await req.json().catch(() => null);
        if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE_HEADERS });
        }

        const body = patchSchema.safeParse(rawJson);
        if (!body.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: body.error.flatten() },
                { status: 400, headers: NO_STORE_HEADERS }
            );
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
            .where(and(eq(parents.id, id), eq(parents.organisationId, orgId)))
            .returning();

        const nextEmail = data.email !== undefined ? (data.email ?? null) : (existing.email ?? null);
        if (
            data.email !== undefined &&
            (existing.email ?? null) !== nextEmail &&
            typeof (db as any).insert === 'function'
        ) {
            const insertBuilder = (db as any).insert(auditEvents);
            if (insertBuilder && typeof insertBuilder.values === 'function') {
                await insertBuilder.values({
                    organisationId: orgId,
                    userId: session.user.id,
                    eventType: 'parent_email_updated',
                    eventData: JSON.stringify({
                        parentId: id,
                        emailChanged: true,
                        updatedAt: new Date().toISOString(),
                    }),
                });
            }
        }

        revalidatePath('/dashboard/parents');
        revalidatePath(`/dashboard/parents/${id}`);
        revalidatePath('/dashboard/students');

        return NextResponse.json({ success: true, parent: updated }, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
        logger.error('Failed to update parent details:', e);
        return NextResponse.json({ error: 'Failed to update details' }, { status: 500, headers: NO_STORE_HEADERS });
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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
        }

        const userRole = (session.user as any).role;
        if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE_HEADERS });
        }

        const { id } = await props.params;
        const orgId = session.user.organisationId;

        // Fetch parent details and their active children in a single relational query
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, id),
                eq(parents.organisationId, orgId),
                isNull(parents.deletedAt)
            ),
            with: {
                children: {
                    where: (c, { isNull: isN }) => isN(c.deletedAt),
                },
            }
        });

        if (!parent || (parent as any).deletedAt) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 404, headers: NO_STORE_HEADERS });
        }

        const activeChildren = (parent.children ?? []).filter(c => !c.deletedAt);

        let visibleChildren = activeChildren;
        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!Array.isArray(accessibleCentreIds)) {
                throw new Error('Failed to resolve accessible centres for parent GET');
            }
            if (accessibleCentreIds.length === 0) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE_HEADERS });
            }
            const hasAccessibleChild = activeChildren.some(
                (c) => Boolean(c.centreId) && accessibleCentreIds.includes(c.centreId as string)
            );
            if (!hasAccessibleChild) {
                const hasBooking = await hasAccessibleBookingForParent(id, accessibleCentreIds);
                if (!hasBooking) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE_HEADERS });
                }
            }
            visibleChildren = activeChildren.filter(
                (c) => Boolean(c.centreId) && accessibleCentreIds.includes(c.centreId as string)
            );
        }

        const { children: _ignored, ...parentData } = parent;
        void _ignored;

        return NextResponse.json(
            {
                parent: parentData,
                children: visibleChildren,
            },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        logger.error('Failed to fetch parent details:', error);
        return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500, headers: NO_STORE_HEADERS });
    }
}
