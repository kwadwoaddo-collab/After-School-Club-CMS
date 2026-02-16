import { NextRequest, NextResponse } from 'next/server';
import { bookingSchema } from '@/lib/validations/booking';
import { BookingService } from '@/lib/services/booking';
import { AvailabilityService } from '@/lib/services/availability';
import { ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { canUserAccessCentre } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    // Check if user has access to this centre
    const hasAccess = await canUserAccessCentre(
      session.user.id,
      validated.appointment.centreId
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to create bookings for this centre' },
        { status: 403 }
      );
    }

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

