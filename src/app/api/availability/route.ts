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
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { AvailabilityService } from '@/lib/services/availability';
import { apiRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { isValidUuid } from '@/lib/uuid';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const rl = await checkRateLimit(apiRateLimit, `avail:${ip}`, {
      localLimit: 60,
      localWindowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        { status: 429 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const centreId = searchParams.get('centreId');
    const dateStr = searchParams.get('date'); // Expected: YYYY-MM-DD
    const rawDuration = searchParams.get('duration');
    const rawModality = searchParams.get('modality');

    if (!centreId || !dateStr) {
      return NextResponse.json(
        { error: 'centreId and date are required' },
        { status: 400 }
      );
    }

    if (!isValidUuid(centreId)) {
      return NextResponse.json(
        { error: 'Invalid centreId' },
        { status: 400 }
      );
    }

    if (!DATE_RE.test(dateStr)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const utcCheck = new Date(0);
    utcCheck.setUTCFullYear(year, month - 1, day);
    utcCheck.setUTCHours(0, 0, 0, 0);
    const roundTrip = `${String(utcCheck.getUTCFullYear()).padStart(4, '0')}-${String(utcCheck.getUTCMonth() + 1).padStart(2, '0')}-${String(utcCheck.getUTCDate()).padStart(2, '0')}`;
    if (isNaN(utcCheck.getTime()) || roundTrip !== dateStr) {
      return NextResponse.json(
        { error: 'Invalid date parameter' },
        { status: 400 }
      );
    }

    const duration =
      rawDuration === null || rawDuration === '' ? 60 : Number(rawDuration);
    if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
      return NextResponse.json(
        { error: 'duration must be an integer between 15 and 240 minutes' },
        { status: 400 }
      );
    }

    if (
      rawModality !== null &&
      rawModality !== '' &&
      rawModality !== 'in_person' &&
      rawModality !== 'online'
    ) {
      return NextResponse.json(
        { error: 'Invalid modality parameter' },
        { status: 400 }
      );
    }
    const modality: 'in_person' | 'online' =
      rawModality === 'online' ? 'online' : 'in_person';

    // Construct local Date using setFullYear so years 0001..0099 do not map to 1901..1999
    const localDate = new Date(0);
    localDate.setFullYear(year, month - 1, day);
    localDate.setHours(0, 0, 0, 0);
    if (isNaN(localDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date parameter' },
        { status: 400 }
      );
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const maxDateStart = new Date(todayStart);
    maxDateStart.setDate(maxDateStart.getDate() + 365);

    if (localDate < yesterdayStart) {
      return NextResponse.json({ slots: [] });
    }
    if (localDate > maxDateStart) {
      return NextResponse.json(
        { error: 'Date cannot be more than 365 days in the future' },
        { status: 400 }
      );
    }

    if (db.query?.centres?.findFirst) {
      const centre = await db.query.centres.findFirst({
        where: eq(centres.id, centreId),
        columns: { id: true, organisationId: true },
        with: {
          organisation: {
            columns: { approvalStatus: true },
          },
        },
      });
      if (!centre || (centre.organisation && centre.organisation.approvalStatus !== 'ACTIVE')) {
        return NextResponse.json(
          { error: 'Centre not found' },
          { status: 404 }
        );
      }
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
