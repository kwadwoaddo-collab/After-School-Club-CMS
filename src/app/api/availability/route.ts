import { logger } from '@/lib/logger';
/**
 * Availability API
 *
 * GET: Fetch available time slots for a centre on a given date.
 *
 * This endpoint is intentionally PUBLIC (no auth required) because it is
 * called by the parent-facing booking form at /book/[slug], where users
 * have no active session. Centre availability data (open/close hours) is
 * non-sensitive — it is equivalent to a business listing its opening times.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/lib/services/availability';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const centreId = searchParams.get('centreId');
    const dateStr = searchParams.get('date'); // Expected: YYYY-MM-DD
    const duration = parseInt(searchParams.get('duration') || '60', 10);
    const modality = (searchParams.get('modality') as 'in_person' | 'online') || 'in_person';

    if (!centreId || !dateStr) {
      return NextResponse.json(
        { error: 'centreId and date are required' },
        { status: 400 }
      );
    }

    // FIX (Task 2 / Timezone bug):
    // new Date('2026-03-22') parses as UTC midnight, but .getDay() uses LOCAL time.
    // On a BST (UTC+1) server, Sunday 00:00 UTC = Saturday 23:00 local → wrong day fetched.
    // Constructing Date from explicit year/month/day avoids UTC interpretation entirely.
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'date must be in YYYY-MM-DD format' }, { status: 400 });
    }
    const [year, month, day] = parts.map(Number);
    const localDate = new Date(year, month - 1, day);
    if (isNaN(localDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date parameter' }, { status: 400 });
    }

    const availabilityService = new AvailabilityService();
    const slots = await availabilityService.getAvailableSlots({
      centreId,
      date: localDate,
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
    logger.error('[Availability API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}

