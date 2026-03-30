import { NextRequest, NextResponse } from 'next/server';
import { bookingSchema } from '@/lib/validations/booking';
import { BookingService } from '@/lib/services/booking';
import { AvailabilityService } from '@/lib/services/availability';
import { ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { canUserAccessCentre } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validated = bookingSchema.parse(body);

    // Ensure centreId is present
    if (!validated.appointment.centreId) {
      return NextResponse.json(
        { error: 'Centre ID is required' },
        { status: 400 }
      );
    }

    const bookingService = new BookingService();
    const availabilityService = new AvailabilityService();

    // Check if startAt is a time string and we have a date
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

    // Hold the slot to prevent double-booking
    const slotHeld = await availabilityService.holdSlot(
      validated.appointment.centreId,
      validated.appointment.modality,
      parsedStartDate
    );

    if (!slotHeld) {
      return NextResponse.json(
        { error: 'This time slot is no longer available' },
        { status: 409 }
      );
    }

    // Create the booking
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

