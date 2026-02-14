import { NextRequest, NextResponse } from 'next/server';
import { bookingSchema } from '@/lib/validations/booking';
import { BookingService } from '@/lib/services/booking';
import { AvailabilityService } from '@/lib/services/availability';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validated = bookingSchema.parse(body);

    const bookingService = new BookingService();
    const availabilityService = new AvailabilityService();

    // Hold the slot to prevent double-booking
    const slotHeld = await availabilityService.holdSlot(
      validated.appointment.centreId,
      validated.appointment.modality,
      new Date(validated.appointment.startAt)
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
