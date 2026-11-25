import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { canUserAccessCentre, getUserAccessibleCentreIds } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';

const reassignSchema = z.object({
    centreId: z.string().uuid(),
});

interface RouteContext {
    params: Promise<{ bookingId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const userRole = (session.user as any).role as string | undefined;
        if (!userRole || !['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { bookingId } = await params;

        if (!isValidUuid(bookingId)) {
            return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = reassignSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid centre ID', details: parsed.error.flatten() }, { status: 400 });
        }
        const { centreId: newCentreId } = parsed.data;

        const hasAccess = await canUserAccessCentre(session.user.id, newCentreId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'You do not have permission to assign to this centre' }, { status: 403 });
        }

        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId),
            with: { centre: true },
        });

        if (!booking || !booking.centre) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        if (booking.centre.organisationId !== session.user.organisationId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Centre membership check on the booking's CURRENT centre for
        // non-ORG_OWNER users — matches the check already applied by the
        // sibling cancel/reschedule/status endpoints. Without this, a user
        // could reassign a booking away from a centre they have no
        // membership in, as long as they had access to the target centre
        // (already checked above via canUserAccessCentre).
        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const newCentre = await db.query.centres.findFirst({
            where: eq(centres.id, newCentreId),
        });

        if (!newCentre || newCentre.organisationId !== session.user.organisationId) {
            return NextResponse.json({ error: 'Invalid target centre' }, { status: 400 });
        }

        await db.update(bookings)
            .set({ centreId: newCentreId, updatedAt: new Date() })
            .where(eq(bookings.id, bookingId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[PATCH /api/bookings/[bookingId]/centre]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
