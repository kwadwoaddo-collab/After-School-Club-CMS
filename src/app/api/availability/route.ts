/**
 * Availability API
 * 
 * GET: Fetch available time slots for a centre on a given date
 */

import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/lib/services/availability';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const centreId = searchParams.get('centreId');
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '45', 10);
    const modality = searchParams.get('modality') as 'in_person' | 'online' || 'in_person';

    if (!centreId || !date) {
      return NextResponse.json(
        { error: 'centreId and date are required' },
        { status: 400 }
      );
    }

    const availabilityService = new AvailabilityService();
    const slots = await availabilityService.getAvailableSlots({
      centreId,
      date: new Date(date),
      duration,
      modality,
    });

    // Transform slots for frontend
    const formattedSlots = slots.map(slot => ({
      startAt: slot.startAt,
      endAt: slot.endAt,
      available: slot.available,
    }));

    return NextResponse.json({ slots: formattedSlots });
  } catch (error) {
    console.error('[Availability API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
