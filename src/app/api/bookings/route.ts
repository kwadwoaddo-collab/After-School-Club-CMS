import { NextRequest, NextResponse } from 'next/server';
import { bookingSchema } from '@/lib/validations/booking';
import { BookingService } from '@/lib/services/booking';
import { AvailabilityService } from '@/lib/services/availability';
import { ZodError } from 'zod';
import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input shape via Zod
    const validated = bookingSchema.parse(body);

    // Ensure centreId is present in the payload
    if (!validated.appointment.centreId) {
      return NextResponse.json(
        { error: 'Centre ID is required' },
        { status: 400 }
      );
    }

    const centreId = validated.appointment.centreId;

    // ── Centre validation ───────────────────────────────────────────────────
    // This is a public (unauthenticated) endpoint, but we must not blindly
    // trust the centreId from the client body:
    //
    //   1. A non-existent UUID would cause a FK violation later in BookingService.
    //   2. A valid centreId from a *different* org would cause BookingService to
    //      create a booking under that org's namespace (cross-org injection).
    //
    // We resolve the centre and confirm its owning org exists. BookingService
    // internally derives organisationId from centre.organisationId, so this
    // check is the correct point of enforcement.
    const centre = await db.query.centres.findFirst({
      where: eq(centres.id, centreId),
      columns: { id: true, organisationId: true },
    });

    if (!centre) {
      return NextResponse.json(
        { error: 'Invalid centre ID' },
        { status: 400 }
      );
    }

    // Guard against orphan centres (should never occur with FK constraints, but
    // a defence-in-depth check keeps this boundary explicit).
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.id, centre.organisationId),
      columns: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Invalid centre ID' },
        { status: 400 }
      );
    }

    // ── Build booking service instances ─────────────────────────────────────
    const bookingService = new BookingService();
    const availabilityService = new AvailabilityService();

    // Normalise startAt: handle time-string + separate date field
    let parsedStartDate = new Date(validated.appointment.startAt);
    if (isNaN(parsedStartDate.getTime()) && validated.appointment.date) {
       parsedStartDate = new Date(`${validated.appointment.date}T${validated.appointment.startAt}:00`);
       validated.appointment.startAt = parsedStartDate.toISOString();
    }

    if (isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start time provided' },
        { status: 400 }
      );
    }

    // Hold the slot to prevent double-booking races
    const slotHeld = await availabilityService.holdSlot(
      centreId,
      validated.appointment.modality,
      parsedStartDate
    );

    if (!slotHeld) {
      return NextResponse.json(
        { error: 'This time slot is no longer available' },
        { status: 409 }
      );
    }

    // Create the booking — BookingService resolves org from centre internally
    const result = await bookingService.createBooking(validated);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Booking API error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
