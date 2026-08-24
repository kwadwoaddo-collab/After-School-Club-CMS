import { db } from '@/db';
import { bookings, bookingAttendees, children, centres } from '@/db/schema';
import { eq, sql, and, gte, lt, asc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Calendar, ChevronRight } from 'lucide-react';
import { startOfDay, endOfDay, format } from 'date-fns';
import { cn } from '@/components/ui/utils';
import { Card } from '@/components/ui/Card';

// Only the fields this component actually reads — not the full organisation row.
export default async function DashboardSchedule({
    org,
    accessibleCentreIds,
    hasCentres,
}: {
    org: { id: string };
    accessibleCentreIds: string[];
    hasCentres: boolean;
}) {
    const now = new Date();

    // D2 (Milestone 3M): Scope Today's Schedule to the user's accessible centres.
    // Previously used centres.organisationId = org.id which included all org
    // centres regardless of the user's centre restriction.
    const centreScopeCondition = hasCentres
        ? inArray(bookings.centreId, accessibleCentreIds)
        : eq(centres.organisationId, org.id); // fallback for zero-centre orgs (owner context)

    const todayBookings = await db.select({
        id: bookings.id,
        startAt: bookings.startAt,
        status: bookings.status,
        childName: sql<string>`concat(${children.firstName}, ' ', ${children.lastName})`,
        centreName: centres.name,
    })
    .from(bookings)
    .leftJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
    .leftJoin(children, eq(children.id, bookingAttendees.childId))
    .innerJoin(centres, eq(centres.id, bookings.centreId))
    .where(and(
        centreScopeCondition,
        gte(bookings.startAt, startOfDay(now)),
        lt(bookings.startAt, endOfDay(now))
    ))
    .orderBy(asc(bookings.startAt))
    .limit(10);

    return (
        <Card className="overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-text-muted" aria-hidden="true" />
                    <h3 className="font-semibold text-sm text-text">Today's Schedule</h3>
                    <span className="text-text-muted">·</span>
                    <span className="text-xs text-text-muted">{format(now, 'MMM d, yyyy')}</span>
                </div>
                <Link
                    href="/dashboard/bookings"
                    className="text-xs text-accent hover:text-accent/80 font-medium transition-colors flex items-center gap-1"
                >
                    View all
                    <ChevronRight className="size-3" />
                </Link>
            </div>
            {todayBookings.length === 0 ? (
                <div className="px-5 py-12 flex flex-col items-center gap-2 text-center flex-1 justify-center">
                    <Calendar className="size-8 text-text-muted/30" aria-hidden="true" />
                    <p className="text-sm font-medium text-text-muted">No sessions scheduled for today</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-border-subtle">
                    {todayBookings.map((booking) => (
                    <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-page transition-colors">
                        <span className="text-xs font-mono text-text-muted w-10 flex-shrink-0">
                        {format(new Date(booking.startAt), 'HH:mm')}
                        </span>
                        <span className="flex-1 text-sm font-medium text-text truncate">
                        {booking.childName ?? 'Unknown'}
                        </span>
                        <span className="text-xs text-text-muted truncate hidden sm:block">{booking.centreName}</span>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-sm border',
                            booking.status === 'confirmed' ? 'bg-success-soft text-success border-success/20' :
                            booking.status === 'pending' ? 'bg-warning-soft text-warning border-warning/20' :
                            booking.status === 'cancelled' ? 'bg-danger-soft text-danger border-danger/20' :
                            'bg-page text-text-muted border-border'
                        )}>{booking.status}</span>
                        <ChevronRight className="size-4 text-text-muted flex-shrink-0" />
                    </Link>
                    ))}
                </div>
            )}
        </Card>
    );
}
