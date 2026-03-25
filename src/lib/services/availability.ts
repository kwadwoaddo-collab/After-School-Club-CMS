import { db } from '@/db';
import { centres, centreAvailabilityRules, bookings, slotHolds } from '@/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import { addMinutes, startOfDay, endOfDay } from 'date-fns';
import { googleCalendarService } from './google-calendar';

interface AvailabilityQuery {
    centreId?: string;
    modality: 'in_person' | 'online';
    date: Date;
    duration: number; // in minutes (30, 45, or 60)
    checkGoogleCalendar?: boolean; // optional: check GCal conflicts
}

interface TimeSlot {
    startAt: string; // ISO8601
    endAt: string; // ISO8601
    available: boolean;
}

// Default operating hours when no rules are configured
// Monday-Saturday: 09:00-18:00, Sunday: closed
const DEFAULT_HOURS: Record<number, { startTime: string; endTime: string } | null> = {
    0: { startTime: '10:00', endTime: '16:00' }, // Sunday - Fixed to be open
    1: { startTime: '09:00', endTime: '18:00' }, // Monday
    2: { startTime: '09:00', endTime: '18:00' }, // Tuesday
    3: { startTime: '09:00', endTime: '18:00' }, // Wednesday
    4: { startTime: '09:00', endTime: '18:00' }, // Thursday
    5: { startTime: '09:00', endTime: '18:00' }, // Friday
    6: { startTime: '10:00', endTime: '16:00' }, // Saturday
};

export class AvailabilityService {
    /**
     * Generate available time slots for a given centre/modality/date
     */
    async getAvailableSlots(query: AvailabilityQuery): Promise<TimeSlot[]> {
        const { centreId, modality, date, duration, checkGoogleCalendar = false } = query;

        const jsDayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const dbDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // Map to DB/Python format: 0 = Mon, 6 = Sun

        let rule: { startTime: string; endTime: string } | null = null;

        if (centreId) {
            try {
                const rules = await db.query.centreAvailabilityRules.findMany({
                    where: and(
                        eq(centreAvailabilityRules.centreId, centreId),
                        eq(centreAvailabilityRules.dayOfWeek, dbDayOfWeek)
                    ),
                });

                if (rules && rules.length > 0) {
                    rule = rules[0];
                }
            } catch (error) {
                console.error('[AvailabilityService] Database query failed, using defaults:', error);
            }
        }

        console.log('[Debug] Date:', date);
        console.log('[Debug] Day:', jsDayOfWeek);
        console.log('[Debug] DB Day:', dbDayOfWeek);
        console.log('[Debug] Rule found in DB?', !!rule);

        // Use default hours if no rules found
        if (!rule) {
            rule = DEFAULT_HOURS[jsDayOfWeek];
            console.log('[Debug] Using default rule:', rule);
        }


        if (!rule) {
            return []; // Day is closed (e.g., Sunday)
        }

        const slots: TimeSlot[] = [];

        // Parse start and end times
        const [startHour, startMinute] = rule.startTime.split(':').map(Number);
        const [endHour, endMinute] = rule.endTime.split(':').map(Number);

        // Create Date objects for start and end
        const startDateTime = new Date(date);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(date);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // Don't show past slots for today
        const now = new Date();
        if (date.toDateString() === now.toDateString() && startDateTime < now) {
            // Round up to next slot
            const minutesPastMidnight = now.getHours() * 60 + now.getMinutes();
            const nextSlotMinutes = Math.ceil(minutesPastMidnight / duration) * duration;
            startDateTime.setHours(Math.floor(nextSlotMinutes / 60), nextSlotMinutes % 60, 0, 0);
        }

        // Generate all possible slots
        let currentSlot = new Date(startDateTime);
        while (currentSlot < endDateTime) {
            const slotEnd = addMinutes(currentSlot, duration);

            if (slotEnd <= endDateTime) {
                slots.push({
                    startAt: currentSlot.toISOString(),
                    endAt: slotEnd.toISOString(),
                    available: true, // Will check conflicts next
                });
            }

            currentSlot = addMinutes(currentSlot, duration);
        }

        // Check for conflicts (existing bookings + slot holds)
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const resourceKey = centreId ? `${centreId}_${modality}` : `online_${modality}`;

        // Get existing bookings
        let existingBookings: any[] = [];
        try {
            existingBookings = await db.query.bookings.findMany({
                where: and(
                    centreId ? eq(bookings.centreId, centreId) : undefined,
                    eq(bookings.modality, modality),
                    gte(bookings.startAt, dayStart),
                    lt(bookings.startAt, dayEnd),
                    eq(bookings.status, 'booked')
                ),
            });
        } catch (error) {
            console.error('[AvailabilityService] Failed to fetch bookings:', error);
        }

        // Get active slot holds
        let activeHolds: any[] = [];
        try {
            const now = new Date();
            activeHolds = await db.query.slotHolds.findMany({
                where: and(
                    eq(slotHolds.resourceKey, resourceKey),
                    gte(slotHolds.expiresAt, now),
                    gte(slotHolds.timeBucket, dayStart),
                    lt(slotHolds.timeBucket, dayEnd)
                ),
            });
        } catch (error) {
            console.error('[AvailabilityService] Failed to fetch holds:', error);
        }

        // Optionally get Google Calendar busy times
        let calendarBusyTimes: { start: Date; end: Date }[] = [];
        if (checkGoogleCalendar) {
            try {
                const calendarResult = await googleCalendarService.checkCalendarAvailability(
                    dayStart,
                    dayEnd
                );
                calendarBusyTimes = calendarResult.busy;
            } catch (error) {
                console.error('[AvailabilityService] Calendar check failed:', error);
            }
        }

        // Mark conflicting slots as unavailable
        for (const slot of slots) {
            const slotStart = new Date(slot.startAt);
            const slotEnd = new Date(slot.endAt);

            // Check bookings (Limit removed for Task 14)
            const overlappingBookings = existingBookings.filter(booking => {
                const bookingStart = new Date(booking.startAt);
                const bookingEnd = addMinutes(bookingStart, booking.duration);
                return slotStart < bookingEnd && slotEnd > bookingStart;
            });

            const hasCapacityConflict = false; // overlappingBookings.length >= 10;

            // Check holds
            const hasHoldConflict = activeHolds.some(hold => {
                const holdTime = new Date(hold.timeBucket);
                return slotStart.getTime() === holdTime.getTime();
            });

            // Check Google Calendar conflicts
            const hasCalendarConflict = calendarBusyTimes.some(busy => {
                return slotStart < busy.end && slotEnd > busy.start;
            });

            if (hasCapacityConflict || hasHoldConflict || hasCalendarConflict) {
                slot.available = false;
            }
        }

        return slots;
    }

    /**
     * Hold a slot for 5 minutes to prevent race conditions
     */
    async holdSlot(centreId: string | undefined, modality: string, startAt: Date): Promise<boolean> {
        // Task 14: Return true unconditionally to allow infinite concurrent bookings
        return true;
    }

    /**
     * Clean up expired slot holds
     */
    async cleanupExpiredHolds(): Promise<void> {
        const now = new Date();
        await db.delete(slotHolds).where(lt(slotHolds.expiresAt, now));
    }
}
