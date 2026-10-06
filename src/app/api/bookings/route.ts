import { logger } from '@/lib/logger';
import { NextRequest, NextResponse, after } from 'next/server';
import { bookingSchema } from '@/lib/validations/booking';
import { BookingService } from '@/lib/services/booking';
import { AvailabilityService } from '@/lib/services/availability';
import { ZodError } from 'zod';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { parseInTimezone, DEFAULT_TIMEZONE } from '@/lib/datetime';
import { captureEntryBudget, registerFastPathAfterCommit } from '@/lib/services/email-outbox';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const budget = captureEntryBudget('route');
  try {
    // Rate limit: protect against public booking endpoint spam
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimit(apiRateLimit, `booking:${ip}`);
    if (!rateLimitResult.success) {
      if (rateLimitResult.status === 'unavailable') {
        return NextResponse.json(
          { error: 'Booking service temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }
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
      columns: { id: true, organisationId: true, timezone: true },
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

    // Normalise startAt: interpret in centre operational timezone (Europe/London)
    const centreTimezone = centre.timezone || DEFAULT_TIMEZONE;
    let parsedStartDate: Date;

    if (validated.appointment.date && !validated.appointment.startAt.includes('T') && !validated.appointment.startAt.includes('Z')) {
      parsedStartDate = parseInTimezone(validated.appointment.date, validated.appointment.startAt, centreTimezone);
      validated.appointment.startAt = parsedStartDate.toISOString();
    } else {
      parsedStartDate = new Date(validated.appointment.startAt);
      if (isNaN(parsedStartDate.getTime()) && validated.appointment.date) {
        parsedStartDate = parseInTimezone(validated.appointment.date, validated.appointment.startAt, centreTimezone);
        validated.appointment.startAt = parsedStartDate.toISOString();
      }
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

    // Register after() fast path for outbox dispatch
    if (result.outboxId) {
      registerFastPathAfterCommit(after, {
        origin: 'route',
        outboxId: result.outboxId,
        budget,
      });
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/attendance');
    revalidatePath(`/dashboard/centres/${centreId}`);

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
    logger.error('[API /bookings] Booking creation failed:', errorMessage);
    logger.error('[API /bookings] Stack:', errorStack);
    const responseBody: Record<string, unknown> = { error: 'Failed to create booking' };
    if (process.env.NODE_ENV === 'development') {
      responseBody.debug = errorMessage;
      responseBody.stack = errorStack;
    }
    return NextResponse.json(responseBody, { status: 500 });

  }
}
