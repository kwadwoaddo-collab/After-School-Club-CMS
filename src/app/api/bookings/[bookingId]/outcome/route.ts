/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { recordBookingEnrolmentOutcome } from '@/lib/services/booking-outcome-sync';
import { isValidUuid } from '@/lib/uuid';

const outcomeSchema = z.object({
    enrolmentOutcome: z.enum(['signed_up', 'did_not_sign_up', 'awaiting_outcome']),
    reason: z.string().trim().max(1000).optional().nullable(),
});

interface RouteContext {
    params: Promise<{ bookingId: string }>;
}

async function handleOutcomeUpdate(request: Request, { params }: RouteContext) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId || !session.user.id) {
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
        const parsed = outcomeSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid enrolment outcome payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { enrolmentOutcome, reason } = parsed.data;

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

        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const updated = await recordBookingEnrolmentOutcome(db, {
            bookingId,
            organisationId: session.user.organisationId,
            enrolmentOutcome,
            reason: reason ?? null,
            actorUserId: session.user.id,
        });

        revalidatePath('/dashboard/bookings');
        revalidatePath(`/dashboard/bookings/${bookingId}`);
        revalidatePath('/dashboard/students');
        revalidatePath('/dashboard/registrations');
        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard');
        if (booking.centreId) {
            revalidatePath(`/dashboard/centres/${booking.centreId}`);
        }

        return NextResponse.json({ success: true, booking: updated });
    } catch (error) {
        logger.error('[PATCH /api/bookings/[bookingId]/outcome]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    return handleOutcomeUpdate(request, context);
}

export async function POST(request: Request, context: RouteContext) {
    return handleOutcomeUpdate(request, context);
}
