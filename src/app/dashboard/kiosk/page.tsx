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
        where: and(centreChildrenCondition, eq(children.isRegistered, true), isNull(children.deletedAt)),
        with: { parent: true, centre: true },
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

    const sortedSlots = compileDailyRegisterSlots({
        targetDate: now,
        allChildrenAtCentre,
        dayBookings: todayBookings,
    });

    const activeCentreName = activeCentreId !== 'all'
        ? orgCentres.find(c => c.id === activeCentreId)?.name ?? 'All Centres'
        : 'All Centres';

    return (
        <KioskRegister
            slots={sortedSlots as any}
            date={format(now, 'EEEE, d MMMM yyyy')}
            dateStr={format(now, 'yyyy-MM-dd')}
            centreName={activeCentreName}
            centres={orgCentres}
            activeCentreId={activeCentreId}
        />
    );
}
