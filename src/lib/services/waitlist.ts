import { db } from '@/db';
import { waitlistEntries, bookings, children, parents } from '@/db/schema';
import { eq, and, lt, asc } from 'drizzle-orm';
import { checkSessionCapacity } from './capacity';
// Assuming we have an email/notification service
// import { sendNotification } from './notifications'; 

/**
 * Adds a child to the waitlist for a specific session-date
 */
export async function addToWaitlist(
  organisationId: string,
  clubSessionId: string,
  sessionDate: Date | null,
  childId: string,
  termId?: string
) {
  // Find the highest position
  const existingEntries = await db.query.waitlistEntries.findMany({
    where: and(
      eq(waitlistEntries.clubSessionId, clubSessionId),
      sessionDate ? eq(waitlistEntries.sessionDate, sessionDate) : undefined,
      termId ? eq(waitlistEntries.termId, termId) : undefined
    ),
    orderBy: [asc(waitlistEntries.position)],
  });

  const nextPosition = existingEntries.length > 0 
    ? existingEntries[existingEntries.length - 1].position + 1 
    : 1;

  const [entry] = await db.insert(waitlistEntries).values({
    organisationId,
    clubSessionId,
    sessionDate,
    termId,
    childId,
    position: nextPosition,
    status: 'waiting'
  }).returning();

  return entry;
}

/**
 * Triggers waitlist offers if capacity has freed up
 * This should be called whenever a booking is cancelled or rescheduled.
 */
export async function cascadeWaitlist(
  clubSessionId: string,
  sessionDate: Date
) {
  const capacity = await checkSessionCapacity(clubSessionId, sessionDate);
  
  if (capacity.remainingCapacity <= 0) {
    return; // No capacity freed up
  }

  // Fetch waiting entries in order
  const waitingEntries = await db.query.waitlistEntries.findMany({
    where: and(
      eq(waitlistEntries.clubSessionId, clubSessionId),
      eq(waitlistEntries.sessionDate, sessionDate),
      eq(waitlistEntries.status, 'waiting')
    ),
    orderBy: [asc(waitlistEntries.position)],
    limit: capacity.remainingCapacity
  });

  for (const entry of waitingEntries) {
    // 1. Update status to offered
    await db.update(waitlistEntries)
      .set({ status: 'offered', updatedAt: new Date() })
      .where(eq(waitlistEntries.id, entry.id));

    // 2. Fetch parent details
    const child = await db.query.children.findFirst({
      where: eq(children.id, entry.childId),
      with: { parent: true }
    });

    if (child && child.parent) {
      // 3. Send offer email (Mocked here, but would integrate with magic-link infra)
      // await sendNotification({
      //   userId: child.parent.id,
      //   type: 'system',
      //   title: 'Waitlist Offer',
      //   message: `A spot has opened up for ${child.firstName}! You have 24 hours to claim it.`
      // });
      console.log(`[Waitlist Cascade] Offer sent to ${child.parent.email} for ${child.firstName}`);
    }
  }
}
