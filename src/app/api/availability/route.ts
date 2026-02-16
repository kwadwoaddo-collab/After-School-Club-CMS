/**
 * Availability API
 * 
 * GET: Fetch available time slots for a centre on a given date
 */

import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/lib/services/availability';
import { auth } from '@/lib/auth';
import { canUserAccessCentre } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    // Check if user has access to this centre
    const hasAccess = await canUserAccessCentre(session.user.id, centreId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to view availability for this centre' },
        { status: 403 }
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
