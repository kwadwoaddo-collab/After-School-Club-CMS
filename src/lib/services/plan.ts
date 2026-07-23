import { db } from '@/db';
import { bookings, bookingPlans, terms, sessionExceptions, clubSessions } from '@/db/schema';
import { eq, and, between, isNull } from 'drizzle-orm';
import { addDays, getDay, isSameDay, isBefore, isAfter } from 'date-fns';
import { checkSessionCapacity } from './capacity';

/**
 * Materialises a booking plan into individual bookings for a term.
 */
export async function materialiseBookingPlan(planId: string) {
  const plan = await db.query.bookingPlans.findFirst({
    where: eq(bookingPlans.id, planId),
    with: {
      term: true,
      clubSession: true,
    }
  });

  if (!plan || plan.status !== 'active') {
    throw new Error('Invalid or inactive booking plan');
  }

  const { term, clubSession, childId, organisationId } = plan;
  
  if (!term) throw new Error('Plan is missing term');
  if (!clubSession) throw new Error('Plan is missing session');

  const exceptions = await db.query.sessionExceptions.findMany({
    where: eq(sessionExceptions.centreId, clubSession.centreId)
  });

  // Calculate occurrences
  const bookingsToCreate = [];
  let currentDate = new Date(term.startDate);
  const endDate = new Date(term.endDate);

  // Map weekday (0=Sun, 1=Mon) to the weekday stored in clubSessions
  // Assuming clubSession.weekday is 1-7 (1=Monday, 7=Sunday)
  // getDay() returns 0=Sunday, 1=Monday
  const targetWeekday = clubSession.weekday;

  while (!isAfter(currentDate, endDate)) {
    // getDay: 0 (Sun) - 6 (Sat)
    // mapping to 1 (Mon) - 7 (Sun)
    const currentJsDay = getDay(currentDate);
    const mappedDay = currentJsDay === 0 ? 7 : currentJsDay;

    if (mappedDay === targetWeekday) {
      // Check if it's an exception (inset day, etc)
      const isException = exceptions.some(ex => 
        ex.date && isSameDay(new Date(ex.date), currentDate)
      );

      if (!isException) {
        // Construct start and end dates with time
        // The session model has startTime and endTime like "15:30:00"
        const [startHours, startMinutes] = (clubSession.startTime || "00:00:00").split(':');
        const [endHours, endMinutes] = (clubSession.endTime || "00:00:00").split(':');
        
        const startAt = new Date(currentDate);
        startAt.setHours(parseInt(startHours), parseInt(startMinutes), 0, 0);

        const endAt = new Date(currentDate);
        endAt.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);

        bookingsToCreate.push({
          organisationId,
          childId,
          sessionId: clubSession.id,
          startAt,
          endAt,
          status: 'confirmed' as const,
          priceDetails: { basePrice: clubSession.price, finalPrice: clubSession.price },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  if (bookingsToCreate.length > 0) {
    await db.insert(bookings).values(bookingsToCreate);
  }

  return bookingsToCreate.length;
}
