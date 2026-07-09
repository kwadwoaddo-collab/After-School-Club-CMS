import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, children } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { startOfDay, endOfDay, format } from 'date-fns';
import KioskRegister from './KioskRegister';

export default async function KioskPage(props: {
    searchParams: Promise<{ centre?: string }>;
}) {
    const rawParams = await props.searchParams;
    const session = await auth();
    if (!session?.user?.organisationId) redirect('/login');

    const orgCentres = await getUserAccessibleCentres(session.user.id);
    const centreIds = orgCentres.map(c => c.id);
    const activeCentreId = await resolveActiveCentreId(rawParams.centre, centreIds);

    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const centreFilter = activeCentreId !== 'all'
        ? eq(bookings.centreId, activeCentreId)
        : centreIds.length > 0
            ? inArray(bookings.centreId, centreIds)
            : eq(bookings.centreId, 'no-centre');

    const targetDayName = format(now, 'EEEE'); // e.g. "Monday"

    const centreChildrenCondition = activeCentreId !== 'all'
        ? eq(children.centreId, activeCentreId)
        : centreIds.length > 0
            ? inArray(children.centreId, centreIds)
            : eq(children.centreId, 'no-centre');

    const allChildrenAtCentre = await db.query.children.findMany({
        where: and(centreChildrenCondition, eq(children.active, true)),
        with: { parent: true, centre: true },
    });

    const regularAttendees = allChildrenAtCentre.filter(child => {
        if (!child.registeredSessions || child.registeredSessions.length === 0) return false;
        return child.registeredSessions.some(session => session.startsWith(targetDayName));
    });

    const todayBookings = await db.query.bookings.findMany({
        where: and(centreFilter, gte(bookings.startAt, dayStart), lte(bookings.startAt, dayEnd)),
        with: {
            centre: true,
            attendees: {
                with: {
                    child: true
                }
            }
        },
    });

    // Helper to clean and normalize a time string like "3.45pm" to "HH:mm"
    function normalizeTimeToHHMM(timeStr: string): string {
        const clean = timeStr.toLowerCase().replace(/\s/g, '');
        const isPm = clean.includes('pm');
        const digits = clean.replace('am', '').replace('pm', '');
        const [hStr, mStr] = digits.split('.');
        let hours = parseInt(hStr, 10);
        const minutes = mStr ? parseInt(mStr, 10) : 0;
        if (isPm && hours < 12) hours += 12;
        if (!isPm && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Initialize standard slots
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const standardTimes = isWeekend
        ? ['11:00', '12:15', '13:30', '14:45']
        : ['15:45', '17:00'];

    interface CompiledAttendee {
        id: string;
        childId: string;
        firstName: string;
        lastName: string;
        schoolYear: string;
        notes: string | null;
        parentFirstName: string;
        parentLastName: string;
        parentPhone: string | null;
        parentEmail: string | null;
        attendanceStatus: string | null;
        attendanceNote: string | null;
        lateMinutes: number | null;
        isCatchUp: boolean;
        bookingId: string | null;
    }

    interface CompiledSlot {
        time: string;
        timeLabel: string;
        regulars: CompiledAttendee[];
        catchups: CompiledAttendee[];
    }

    const slotsMap: Record<string, CompiledSlot> = {};
    for (const time of standardTimes) {
        const [h, m] = time.split(':');
        const dateObj = new Date(now);
        dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
        slotsMap[time] = {
            time,
            timeLabel: format(dateObj, 'h:mm a'),
            regulars: [],
            catchups: [],
        };
    }

    // Step A: Map regulars to their slots
    for (const child of regularAttendees) {
        const matchingSchedules = child.registeredSessions!.filter(s => s.startsWith(targetDayName));
        for (const sched of matchingSchedules) {
            const timePart = sched.substring(targetDayName.length).trim();
            const parsedTime = normalizeTimeToHHMM(timePart);

            if (!slotsMap[parsedTime]) {
                const [h, m] = parsedTime.split(':');
                const dateObj = new Date(now);
                dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
                slotsMap[parsedTime] = {
                    time: parsedTime,
                    timeLabel: format(dateObj, 'h:mm a'),
                    regulars: [],
                    catchups: [],
                };
            }

            // Check if there is an actual booking for today at this time containing this child
            const bookingMatch = todayBookings.find(b => {
                const bTime = format(new Date(b.startAt), 'HH:mm');
                const hasChild = b.attendees.some(a => a.childId === child.id);
                return hasChild && bTime === parsedTime;
            });

            if (bookingMatch) {
                const att = bookingMatch.attendees.find(a => a.childId === child.id)!;
                slotsMap[parsedTime].regulars.push({
                    id: att.id,
                    childId: child.id,
                    firstName: child.firstName,
                    lastName: child.lastName,
                    schoolYear: child.schoolYear,
                    notes: child.notes,
                    parentFirstName: child.parent.firstName,
                    parentLastName: child.parent.lastName,
                    parentPhone: child.parent.phone,
                    parentEmail: child.parent.email,
                    attendanceStatus: att.attendanceStatus,
                    attendanceNote: att.attendanceNote,
                    lateMinutes: att.lateMinutes,
                    isCatchUp: false,
                    bookingId: bookingMatch.id,
                });
            } else {
                slotsMap[parsedTime].regulars.push({
                    id: `temp-${child.id}-${parsedTime}`,
                    childId: child.id,
                    firstName: child.firstName,
                    lastName: child.lastName,
                    schoolYear: child.schoolYear,
                    notes: child.notes,
                    parentFirstName: child.parent.firstName,
                    parentLastName: child.parent.lastName,
                    parentPhone: child.parent.phone,
                    parentEmail: child.parent.email,
                    attendanceStatus: null,
                    attendanceNote: null,
                    lateMinutes: null,
                    isCatchUp: false,
                    bookingId: null,
                });
            }
        }
    }

    // Step B: Map catchups from actual bookings
    for (const booking of todayBookings) {
        const bookingTime = format(new Date(booking.startAt), 'HH:mm');
        
        if (!slotsMap[bookingTime]) {
            slotsMap[bookingTime] = {
                time: bookingTime,
                timeLabel: format(new Date(booking.startAt), 'h:mm a'),
                regulars: [],
                catchups: [],
            };
        }

        for (const att of booking.attendees) {
            const isRegular = att.child.registeredSessions?.some(s => {
                if (!s.startsWith(targetDayName)) return false;
                const timePart = s.substring(targetDayName.length).trim();
                const parsedTime = normalizeTimeToHHMM(timePart);
                return parsedTime === bookingTime;
            });

            if (!isRegular) {
                const childParent = allChildrenAtCentre.find(c => c.id === att.childId)?.parent;
                slotsMap[bookingTime].catchups.push({
                    id: att.id,
                    childId: att.child.id,
                    firstName: att.child.firstName,
                    lastName: att.child.lastName,
                    schoolYear: att.child.schoolYear,
                    notes: att.child.notes,
                    parentFirstName: childParent?.firstName || '',
                    parentLastName: childParent?.lastName || '',
                    parentPhone: childParent?.phone || null,
                    parentEmail: childParent?.email || null,
                    attendanceStatus: att.attendanceStatus,
                    attendanceNote: att.attendanceNote,
                    lateMinutes: att.lateMinutes,
                    isCatchUp: true,
                    bookingId: booking.id,
                });
            }
        }
    }

    // Sort slots by time ascending
    const sortedSlots = Object.values(slotsMap).sort((a, b) => a.time.localeCompare(b.time));

    const activeCentreName = activeCentreId !== 'all'
        ? orgCentres.find(c => c.id === activeCentreId)?.name ?? 'All Centres'
        : 'All Centres';

    return (
        <KioskRegister
            slots={sortedSlots as any}
            date={format(now, 'EEEE, d MMMM yyyy')}
            centreName={activeCentreName}
            centres={orgCentres}
            activeCentreId={activeCentreId}
        />
    );
}
