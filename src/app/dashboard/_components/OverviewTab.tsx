import { db } from '@/db';
import {
    organisations, centres, parents, children,
    bookings, bookingAttendees, registrations
} from '@/db/schema';
import { eq, sql, and, gte, lt, inArray, or, asc } from 'drizzle-orm';
import Link from 'next/link';
import { TodaysSnapshot } from '@/components/dashboard/TodaysSnapshot';
import { RevenueWidget } from '@/components/dashboard/RevenueWidget';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { Calendar, ChevronRight } from 'lucide-react';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, format, subWeeks, subMonths, eachWeekOfInterval, isSameDay } from 'date-fns';
import { normalizeString, normalizeDate } from '@/lib/search-params';
import { cn } from '@/components/ui/utils';

interface OverviewTabProps {
    searchParams: { [key: string]: string | string[] | undefined };
    org: any;
    activeCentreId: string;
    accessibleCentreIds: string[];
    hasCentres: boolean;
}

export default async function OverviewTab({ searchParams, org, activeCentreId, accessibleCentreIds, hasCentres }: OverviewTabProps) {
    const childrenCentreCondition = activeCentreId !== 'all'
        ? eq(children.centreId, activeCentreId)
        : (hasCentres
            ? or(
                inArray(children.centreId, accessibleCentreIds),
                sql`${children.centreId} IS NULL`
              )
            : sql`false`);

    const bookingsCentreCondition = activeCentreId !== 'all'
        ? eq(bookings.centreId, activeCentreId)
        : (hasCentres ? inArray(bookings.centreId, accessibleCentreIds) : sql`false`);

    const registrationsCentreCondition = activeCentreId !== 'all'
        ? eq(registrations.centreId, activeCentreId)
        : (hasCentres ? inArray(registrations.centreId, accessibleCentreIds) : sql`false`);

    const now = new Date();
    const targetDateStr = normalizeDate(searchParams.date);
    const targetDate = targetDateStr ? parseISO(targetDateStr) : now;
    const currentView = normalizeString(searchParams.view) === 'monthly' ? 'monthly' : 'weekly';

    const activeStartDate = currentView === 'weekly'
        ? startOfWeek(targetDate, { weekStartsOn: 1 })
        : startOfMonth(targetDate);
    const activeEndDate = currentView === 'weekly'
        ? endOfWeek(targetDate, { weekStartsOn: 1 })
        : endOfMonth(targetDate);

    const prevTargetDate = currentView === 'weekly' ? subWeeks(targetDate, 1) : subMonths(targetDate, 1);
    const prevStartDate = currentView === 'weekly'
        ? startOfWeek(prevTargetDate, { weekStartsOn: 1 })
        : startOfMonth(prevTargetDate);
    const prevEndDate = currentView === 'weekly'
        ? endOfWeek(prevTargetDate, { weekStartsOn: 1 })
        : endOfMonth(prevTargetDate);

    const targetMonthStart = startOfMonth(targetDate);
    const targetMonthEnd = endOfMonth(targetDate);
    const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const targetWeekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

    const dateLabel = currentView === 'weekly'
        ? `${format(activeStartDate, 'MMM d')} - ${format(activeEndDate, 'MMM d, yyyy')}`
        : format(activeStartDate, 'MMMM yyyy');

    const [
        [studentKpis],
        [bookingKpis],
        [registrationKpis],
        weeklyRegistrations,
        todayBookings,
    ] = await Promise.all([
        db.select({
            total: sql<number>`count(distinct ${children.id})::int`,
            activePeriod: sql<number>`count(distinct ${children.id}) filter (where ${children.createdAt} >= ${activeStartDate.toISOString()} and ${children.createdAt} <= ${activeEndDate.toISOString()})::int`,
            prevPeriod: sql<number>`count(distinct ${children.id}) filter (where ${children.createdAt} >= ${prevStartDate.toISOString()} and ${children.createdAt} <= ${prevEndDate.toISOString()})::int`
        })
            .from(children)
            .innerJoin(parents, eq(children.parentId, parents.id))
            .where(and(eq(parents.organisationId, org.id), childrenCentreCondition)),

        hasCentres
            ? db.select({
                totalAll: sql<number>`count(*)::int`,
                thisMonth: sql<number>`count(*) filter (where ${bookings.startAt} >= ${targetMonthStart.toISOString()} and ${bookings.startAt} <= ${targetMonthEnd.toISOString()})::int`,
                thisWeek: sql<number>`count(*) filter (where ${bookings.startAt} >= ${targetWeekStart.toISOString()} and ${bookings.startAt} <= ${targetWeekEnd.toISOString()})::int`,
                activePeriod: sql<number>`count(*) filter (where ${bookings.startAt} >= ${activeStartDate.toISOString()} and ${bookings.startAt} <= ${activeEndDate.toISOString()})::int`,
                prevPeriod: sql<number>`count(*) filter (where ${bookings.startAt} >= ${prevStartDate.toISOString()} and ${bookings.startAt} <= ${prevEndDate.toISOString()})::int`
            }).from(bookings).where(bookingsCentreCondition)
            : Promise.resolve([{ totalAll: 0, thisMonth: 0, thisWeek: 0, activePeriod: 0, prevPeriod: 0 }]),

        db.select({
            total: sql<number>`count(*)::int`,
            pending: sql<number>`count(*) filter (where ${registrations.status} = 'awaiting_confirmation')::int`,
            thisMonth: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${targetMonthStart.toISOString()} and ${registrations.createdAt} <= ${targetMonthEnd.toISOString()})::int`,
            thisWeek: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${targetWeekStart.toISOString()} and ${registrations.createdAt} <= ${targetWeekEnd.toISOString()})::int`,
            activePeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${activeStartDate.toISOString()} and ${registrations.createdAt} <= ${activeEndDate.toISOString()})::int`,
            prevPeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${prevStartDate.toISOString()} and ${registrations.createdAt} <= ${prevEndDate.toISOString()})::int`
        }).from(registrations).where(and(eq(registrations.organisationId, org.id), registrationsCentreCondition)),

        db.select({
            weekStart: sql<string>`date_trunc('week', ${registrations.createdAt})`,
            count: sql<number>`count(*)::int`
        }).from(registrations)
        .where(and(eq(registrations.organisationId, org.id), registrationsCentreCondition, gte(registrations.createdAt, subDays(now, 56))))
        .groupBy(sql`date_trunc('week', ${registrations.createdAt})`).orderBy(asc(sql`date_trunc('week', ${registrations.createdAt})`)),

        db.select({
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
        .where(and(eq(centres.organisationId, org.id), gte(bookings.startAt, startOfDay(now)), lt(bookings.startAt, endOfDay(now))))
        .orderBy(asc(bookings.startAt))
        .limit(10),
    ]);

    const calculateTrend = (current: number, previous: number) => {
        if (current === 0 && previous === 0) return { diff: 0, text: "0%", type: 'neutral' as const };
        if (previous === 0) return { diff: current, text: `+${current}`, type: 'positive' as const };
        const perc = ((current - previous) / previous) * 100;
        const typeStr = perc > 0 ? 'positive' : perc < 0 ? 'negative' : 'neutral';
        return {
            diff: current - previous,
            text: perc > 0 ? `+${perc.toFixed(0)}%` : `${perc.toFixed(0)}%`,
            type: typeStr as "positive" | "negative" | "neutral"
        };
    };

    const studentsTrend = calculateTrend(Number(studentKpis.activePeriod), Number(studentKpis.prevPeriod));
    const bookingsTrend = calculateTrend(Number(bookingKpis.activePeriod), Number(bookingKpis.prevPeriod));
    const registrationsTrend = calculateTrend(Number(registrationKpis.activePeriod), Number(registrationKpis.prevPeriod));

    const weeks = eachWeekOfInterval({ start: subDays(now, 49), end: now }, { weekStartsOn: 1 });
    const growthStats = weeks.map(w => {
        const match = weeklyRegistrations.find((d: any) => isSameDay(new Date(d.weekStart), w));
        return Number(match?.count || 0);
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
            <TodaysSnapshot activeCentreId={activeCentreId} accessibleCentreIds={accessibleCentreIds} />

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-foreground">Today's Schedule</h3>
                <span className="text-xs text-muted-foreground">{format(now, 'EEEE, d MMM')}</span>
                </div>
                {todayBookings.length === 0 ? (
                <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
                    <Calendar className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No sessions scheduled for today</p>
                </div>
                ) : (
                <div className="divide-y divide-border">
                    {todayBookings.map((booking: any) => (
                    <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/40 transition-colors">
                        <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">
                        {format(new Date(booking.startAt), 'HH:mm')}
                        </span>
                        <span className="flex-1 text-sm font-medium text-foreground truncate">
                        {booking.childName ?? 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate hidden sm:block">{booking.centreName}</span>
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', 
                            booking.status === 'confirmed' ? 'bg-primary/10 text-primary border-primary/20' :
                            booking.status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' :
                            booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            'bg-secondary text-muted-foreground border-border'
                        )}>{booking.status}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </Link>
                    ))}
                </div>
                )}
            </div>

            <RevenueWidget organisationId={org.id} />

            <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                    Period Summary — {dateLabel}
                </p>
                <KpiGrid
                    studentsActive={Number(studentKpis.activePeriod)}
                    studentsTotal={Number(studentKpis.total)}
                    bookingsActive={Number(bookingKpis.activePeriod)}
                    bookingsTotal={Number(bookingKpis.totalAll)}
                    registrationsActive={Number(registrationKpis.activePeriod)}
                    registrationsTotal={Number(registrationKpis.total)}
                    pendingRegistrations={Number(registrationKpis.pending)}
                    studentsTrend={studentsTrend}
                    bookingsTrend={bookingsTrend}
                    registrationsTrend={registrationsTrend}
                    growthStats={growthStats}
                />
            </div>
        </div>
    );
}
