/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, children } from '@/db/schema';
import { eq, and, gte, lte, inArray, isNull } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { startOfDay, endOfDay, format } from 'date-fns';
import KioskRegister from './KioskRegister';
import { compileDailyRegisterSlots } from '@/lib/attendance';
import { logger } from '@/lib/logger';

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

    const targetDayName = format(now, 'EEEE'); // e.g. "Monday"

    // A user with zero accessible centres (e.g. a TUTOR with no centre
    // memberships) resolves activeCentreId to 'all' with an empty centreIds
    // list. Previously this fell through to `eq(bookings.centreId, 'no-centre')`
    // — comparing a uuid column against a non-uuid literal — which Postgres
    // rejects with a type error and crashed the page (Milestone 3F, K7).
    // Skip both queries entirely in that case and render the same "no
    // sessions" empty state Kiosk already shows for a quiet day.
    let allChildrenAtCentre: any[] = [];
    let todayBookings: any[] = [];
    const hasQueryableScope = activeCentreId !== 'all' || centreIds.length > 0;

    if (hasQueryableScope) {
        const centreFilter = activeCentreId !== 'all'
            ? eq(bookings.centreId, activeCentreId)
            : inArray(bookings.centreId, centreIds);

        const centreChildrenCondition = activeCentreId !== 'all'
            ? eq(children.centreId, activeCentreId)
            : inArray(children.centreId, centreIds);

        try {
            allChildrenAtCentre = await db.query.children.findMany({
                where: and(centreChildrenCondition, eq(children.isRegistered, true), isNull(children.deletedAt)),
                with: { parent: true, centre: true },
            });

            todayBookings = await db.query.bookings.findMany({
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
        } catch (e) {
            logger.error("Error fetching kiosk register", e);
            allChildrenAtCentre = [];
            todayBookings = [];
        }
    }

    const sortedSlots = compileDailyRegisterSlots({
        targetDate: now,
        allChildrenAtCentre,
        dayBookings: todayBookings,
    });

    const activeCentreName = activeCentreId !== 'all'
        ? orgCentres.find(c => c.id === activeCentreId)?.name ?? 'All Centres'
        : 'All Centres';

    // Privacy scrub for Kiosk
    const scrubbedSlots = sortedSlots.map(slot => ({
        ...slot,
        regulars: slot.regulars.map((att: any) => ({
            ...att,
            lastName: att.lastName ? att.lastName.charAt(0) + '.' : '',
            parentLastName: att.parentLastName ? att.parentLastName.charAt(0) + '.' : '',
            parentPhone: null,
            parentEmail: null,
            notes: null
        })),
        catchups: slot.catchups.map((att: any) => ({
            ...att,
            lastName: att.lastName ? att.lastName.charAt(0) + '.' : '',
            parentLastName: att.parentLastName ? att.parentLastName.charAt(0) + '.' : '',
            parentPhone: null,
            parentEmail: null,
            notes: null
        }))
    }));

    return (
        <KioskRegister
            slots={scrubbedSlots as any}
            date={format(now, 'EEEE, d MMMM yyyy')}
            dateStr={format(now, 'yyyy-MM-dd')}
            centreName={activeCentreName}
            centres={orgCentres}
            activeCentreId={activeCentreId}
        />
    );
}
