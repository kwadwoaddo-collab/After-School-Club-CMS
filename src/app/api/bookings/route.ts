import { NextRequest, NextResponse } from 'next/server';
import { bookingSchema } from '@/lib/validations/booking';
import { BookingService } from '@/lib/services/booking';
import { AvailabilityService } from '@/lib/services/availability';
import { ZodError } from 'zod';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: protect against public booking endpoint spam
    const ip = getClientIP(request);
    const { success: allowed } = await checkRateLimit(apiRateLimit, `booking:${ip}`);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many booking attempts. Please try again later.' },
        { status: 429 }
      );
    }

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

    // ── Centre & Organisation validation ────────────────────────────────────
    // This is a public (unauthenticated) endpoint. We fetch the centre and
    // its associated organisation in a single relational query to ensure
    // validity and prevent cross-org injection.
    const centre = await db.query.centres.findFirst({
      where: eq(centres.id, centreId),
      columns: { id: true, organisationId: true },
      with: {
        organisation: {
          columns: { id: true }
        }
      }
    });

    if (!centre || !centre.organisation) {
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

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[API /bookings] Booking creation failed:', errorMessage);
    console.error('[API /bookings] Stack:', errorStack);
    const responseBody: Record<string, unknown> = { error: 'Failed to create booking' };
    if (process.env.NODE_ENV === 'development') {
      responseBody.debug = errorMessage;
      responseBody.stack = errorStack;
    }
    return NextResponse.json(responseBody, { status: 500 });

  }
}
