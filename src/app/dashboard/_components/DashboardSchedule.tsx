import { db } from '@/db';
import { bookings, bookingAttendees, children, centres } from '@/db/schema';
import { eq, sql, and, gte, lt, asc } from 'drizzle-orm';
import Link from 'next/link';
import { Calendar, ChevronRight } from 'lucide-react';
import { startOfDay, endOfDay, format } from 'date-fns';
import { cn } from '@/components/ui/utils';

export default async function DashboardSchedule({ org }: { org: any }) {
    const now = new Date();
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
    .leftJoin(centres, eq(centres.id, bookings.centreId))
    .where(and(
        eq(centres.organisationId, org.id), 
        gte(bookings.startAt, startOfDay(now)), 
        lt(bookings.startAt, endOfDay(now))
    ))
    .orderBy(asc(bookings.startAt))
    .limit(10);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground">Today's Schedule</h3>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-slate-500 italic">{format(now, 'MMM d, yyyy')}</span>
                </div>
            </div>
            {todayBookings.length === 0 ? (
                <div className="px-5 py-12 flex flex-col items-center gap-2 text-center flex-1 justify-center">
                    <Calendar className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No sessions scheduled for today</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {todayBookings.map((booking: any) => (
                    <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">
                        {format(new Date(booking.startAt), 'HH:mm')}
                        </span>
                        <span className="flex-1 text-sm font-medium text-foreground truncate">
                        {booking.childName ?? 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate hidden sm:block">{booking.centreName}</span>
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', 
                            booking.status === 'confirmed' ? 'bg-primary/10 text-primary border-primary/20' :
                            booking.status === 'pending' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
                            booking.status === 'cancelled' ? 'bg-red-500/10 text-red-700 border-red-500/20' :
                            'bg-secondary text-muted-foreground border-border'
                        )}>{booking.status}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
