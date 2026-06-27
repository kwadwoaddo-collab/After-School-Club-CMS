import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings } from '@/db/schema';
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

    const todayBookings = await db.query.bookings.findMany({
        where: and(centreFilter, gte(bookings.startAt, dayStart), lte(bookings.startAt, dayEnd)),
        with: {
            centre: true,
            attendees: {
                with: {
                    child: {
                        with: { parent: true }
                    }
                }
            }
        },
        orderBy: (b, { asc }) => [asc(b.startAt)],
    });

    const activeCentreName = activeCentreId !== 'all'
        ? orgCentres.find(c => c.id === activeCentreId)?.name ?? 'All Centres'
        : 'All Centres';

    return (
        <KioskRegister
            bookings={todayBookings as any}
            date={format(now, 'EEEE, d MMMM yyyy')}
            centreName={activeCentreName}
            centres={orgCentres}
            activeCentreId={activeCentreId}
        />
    );
}
