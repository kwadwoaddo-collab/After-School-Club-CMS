import { db } from '@/db';
import { bookings, clubSessions, slotHolds } from '@/db/schema';
import { eq, and, gt, gte, lt, inArray, sql } from 'drizzle-orm';
import { addMinutes } from 'date-fns';

export interface CapacityCheckResult {
  isAvailable: boolean;
  totalCapacity: number;
  bookedCount: number;
  heldCount: number;
  remainingCapacity: number;
}

/**
 * Checks if a specific club session on a specific date has available capacity.
 */
export async function checkSessionCapacity(
  clubSessionId: string,
  sessionDate: Date
): Promise<CapacityCheckResult> {
  const session = await db.query.clubSessions.findFirst({
    where: eq(clubSessions.id, clubSessionId),
    columns: { capacity: true },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const totalCapacity = session.capacity;

  const dayStart = new Date(sessionDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(sessionDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Count confirmed/pending bookings
  // We assume startAt is within the sessionDate for that session
  const [bookedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.sessionId, clubSessionId),
        gte(bookings.startAt, dayStart),
        lt(bookings.startAt, dayEnd),
        inArray(bookings.status, ['confirmed', 'pending', 'signed_up'])
      )
    );

  const bookedCount = bookedResult?.count || 0;

  // Clean up expired holds occasionally or just ignore them
  const now = new Date();
  const [heldResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(slotHolds)
    .where(
      and(
        eq(slotHolds.resourceKey, clubSessionId),
        gte(slotHolds.timeBucket, dayStart),
        lt(slotHolds.timeBucket, dayEnd),
        gt(slotHolds.expiresAt, now)
      )
    );

  const heldCount = heldResult?.count || 0;
  const remainingCapacity = totalCapacity - bookedCount - heldCount;

  return {
    isAvailable: remainingCapacity > 0,
    totalCapacity,
    bookedCount,
    heldCount,
    remainingCapacity,
  };
}

/**
 * Holds a slot for a user during checkout (e.g. 15 minutes)
 */
export async function holdSessionSlot(
  clubSessionId: string,
  sessionDate: Date,
  durationMinutes = 15
): Promise<string> {
  const capacity = await checkSessionCapacity(clubSessionId, sessionDate);
  if (!capacity.isAvailable) {
    throw new Error('Session is at full capacity');
  }

  // timeBucket is the exact date, usually normalized to midnight or the exact start time
  const dayStart = new Date(sessionDate);
  dayStart.setHours(0, 0, 0, 0);

  const expiresAt = addMinutes(new Date(), durationMinutes);

  const [hold] = await db.insert(slotHolds).values({
    resourceKey: clubSessionId,
    timeBucket: dayStart,
    expiresAt,
  }).returning({ id: slotHolds.id });

  return hold.id;
}

/**
 * Releases a hold once checkout is completed or cancelled
 */
export async function releaseSlotHold(holdId: string): Promise<void> {
  await db.delete(slotHolds).where(eq(slotHolds.id, holdId));
}
