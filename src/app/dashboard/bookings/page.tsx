import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, bookings, centres, bookingAttendees, parents, children } from '@/db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, desc, and, gte, lte, inArray, or, ilike, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Download, Calendar, Filter, Search } from 'lucide-react';
import { Suspense } from 'react';
import BookingsTable from '@/components/bookings/BookingsTable';
import BookingsFilters from '@/components/bookings/BookingsFilters';
import Pagination from '@/components/ui/Pagination';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { startOfDay, endOfDay, format } from 'date-fns';

const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

export default async function BookingsPage(props: {
    searchParams: Promise<{
        view?: string;
        status?: string;
        centre?: string;
        search?: string;
        from?: string;
        to?: string;
        today?: string;
        page?: string;
    }>
}) {
    const rawSearchParams = await props.searchParams;
    const session = await auth();

    const searchParams = {
        view:   Array.isArray(rawSearchParams.view)   ? rawSearchParams.view[0]   : rawSearchParams.view,
        status: Array.isArray(rawSearchParams.status) ? rawSearchParams.status[0] : rawSearchParams.status,
        centre: Array.isArray(rawSearchParams.centre) ? rawSearchParams.centre[0] : rawSearchParams.centre,
        search: Array.isArray(rawSearchParams.search) ? rawSearchParams.search[0] : rawSearchParams.search,
        from:   Array.isArray(rawSearchParams.from)   ? rawSearchParams.from[0]   : rawSearchParams.from,
        to:     Array.isArray(rawSearchParams.to)     ? rawSearchParams.to[0]     : rawSearchParams.to,
        today:  Array.isArray(rawSearchParams.today)  ? rawSearchParams.today[0]  : rawSearchParams.today,
        page:   Array.isArray(rawSearchParams.page)   ? rawSearchParams.page[0]   : rawSearchParams.page,
    };

    if (!session?.user?.organisationId) redirect('/onboarding');

    const orgId = session.user.organisationId;

    const [org] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
    if (!org) redirect('/onboarding');

    const orgCentres = await getUserAccessibleCentres(session.user.id);
    const centreIds = orgCentres.map(c => c.id);

    if (centreIds.length === 0) {
        return (
            <div className="space-y-8 animate-in fade-in duration-700">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Bookings</h1>
                    <p className="text-slate-400 text-sm font-medium mt-1">Manage upcoming and past appointments</p>
                </div>
                <div className="glassmorphic-card rounded-[32px] p-12 text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-[#FFFFFF] mb-2">No centres found</h3>
                    <p className="text-slate-500 mb-6">Please set up a centre first before creating bookings</p>
                    <Link href="/dashboard/centres/add" className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all">
                        <Plus className="w-4 h-4" /> Add Centre
                    </Link>
                </div>
            </div>
        );
    }

    const activeCentreId = await resolveActiveCentreId(searchParams.centre, centreIds);

    // Handle "today" quick filter
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isToday = searchParams.today === 'true';
    const effectiveFrom = isToday ? todayStr : searchParams.from;
    const effectiveTo   = isToday ? todayStr : searchParams.to;

    let bookingsData: any[] = [];
    let searchActiveAndNoResults = false;
    let matchingIds: string[] = [];

    // Pagination configuration
    const PAGE_SIZE = 50;
    const currentPage = parseInt(searchParams.page || '1', 10);
    const offset = (currentPage - 1) * PAGE_SIZE;

    if (searchParams.search) {
        const searchPattern = `%${searchParams.search}%`;
        const attendeeChildren = alias(children, 'attendee_children');
        try {
            const matchingBookings = await db
                .select({ id: bookings.id })
                .from(bookings)
                .leftJoin(parents, eq(bookings.parentId, parents.id))
                .leftJoin(children, eq(bookings.childId, children.id))
                .leftJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
                .leftJoin(attendeeChildren, eq(bookingAttendees.childId, attendeeChildren.id))
                .where(
                    and(
                        activeCentreId !== 'all'
                            ? eq(bookings.centreId, activeCentreId)
                            : inArray(bookings.centreId, centreIds),
                        or(
                            ilike(parents.firstName, searchPattern),
                            ilike(parents.lastName, searchPattern),
                            ilike(parents.email, searchPattern),
                            ilike(parents.phone, searchPattern),
                            ilike(children.firstName, searchPattern),
                            ilike(children.lastName, searchPattern),
                            ilike(attendeeChildren.firstName, searchPattern),
                            ilike(attendeeChildren.lastName, searchPattern)
                        )
                    )
                );
            matchingIds = matchingBookings.map(mb => mb.id);
            if (matchingIds.length === 0) searchActiveAndNoResults = true;
        } catch (error) {
            console.error('Failed to search bookings:', error);
            searchActiveAndNoResults = true;
        }
    }

    // Build exactly the same conditions for `.findMany()` and `.select({ count })`
    const conds = [];
    if (activeCentreId !== 'all') {
        conds.push(eq(bookings.centreId, activeCentreId));
    } else {
        conds.push(inArray(bookings.centreId, centreIds));
    }

    if (searchParams.status && searchParams.status !== 'all') {
        const val = searchParams.status as string;
        if (VALID_BOOKING_STATUSES.includes(val as any)) {
            conds.push(eq(bookings.status, val as any));
        }
    }

    if (effectiveFrom) {
        const fromDate = new Date(effectiveFrom);
        if (!isNaN(fromDate.getTime())) conds.push(gte(bookings.startAt, startOfDay(fromDate)));
    }
    if (effectiveTo) {
        const toDate = new Date(effectiveTo);
        if (!isNaN(toDate.getTime())) conds.push(lte(bookings.startAt, endOfDay(toDate)));
    }

    if (searchParams.search) conds.push(inArray(bookings.id, matchingIds));

    const finalWhere = conds.length === 1 ? conds[0] : and(...conds);

    let totalRecords = 0;
    let statusCountsAgg: any[] = [];

    if (!searchActiveAndNoResults) {
        try {
            // Retrieve aggregations for accurate top-level bubbles
            statusCountsAgg = await db.select({
                status: bookings.status,
                count: sql<number>`count(*)::int`
            })
            .from(bookings)
            .where(finalWhere)
            .groupBy(bookings.status);

            totalRecords = statusCountsAgg.reduce((sum, item) => sum + item.count, 0);

            bookingsData = await db.query.bookings.findMany({
                where: finalWhere,
                orderBy: [desc(bookings.startAt)],
                limit: PAGE_SIZE,
                offset: offset,
                with: {
                    centre: true,
                    parent: true,
                    attendees: {
                        columns: {
                            id: true,
                            bookingId: true,
                            childId: true,
                            feedbackNotes: true,
                            feedbackScore: true,
                            feedbackAttachmentBase64: true,
                            feedbackAttachmentMime: true,
                            feedbackStatus: true,
                            feedbackSentAt: true,
                            updatedAt: true
                        },
                        with: { child: { with: { notes: true } } }
                    },
                    tutor: true,
                    child: { with: { notes: true } }
                }
            });
        } catch (error) {
            console.error('Failed to fetch bookings data:', error);
            bookingsData = [];
        }
    }

    const isFiltered = !!(
        searchParams.search ||
        (searchParams.status && searchParams.status !== 'all') ||
        effectiveFrom ||
        effectiveTo ||
        activeCentreId !== 'all'
    );

    // Status counts for colour-coded summary
    const statusCounts = {
        confirmed:   statusCountsAgg.find(s => s.status === 'confirmed')?.count || 0,
        pending:     statusCountsAgg.find(s => s.status === 'pending')?.count || 0,
        completed:   statusCountsAgg.find(s => s.status === 'completed')?.count || 0,
        cancelled:   statusCountsAgg.find(s => s.status === 'cancelled')?.count || 0,
        rescheduled: statusCountsAgg.find(s => s.status === 'rescheduled')?.count || 0,
    };

    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Bookings</h1>
                    <p className="text-sm text-[#8c909f] mt-1">Manage upcoming and past appointments</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Today quick filter */}
                    <Link
                        href={isToday ? '/dashboard/bookings' : '/dashboard/bookings?today=true'}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all ${
                            isToday
                                ? 'bg-primary/20 border-primary/40 text-primary shadow-[0_0_12px_rgba(142,171,255,0.15)]'
                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Today</span>
                    </Link>
                    <Link
                        href={`/api/bookings/export?centre=${activeCentreId}&status=${searchParams.status || 'all'}`}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-semibold text-white transition-all"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                    </Link>
                    <Link href="/dashboard/bookings/new" className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn">
                        <Plus className="w-4 h-4" /> New Booking
                    </Link>
                </div>
            </div>

            {/* Colour-coded status summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'Confirmed', count: statusCounts.confirmed,   colour: 'text-blue-400   bg-blue-500/10   border-blue-500/20'   },
                    { label: 'Pending',   count: statusCounts.pending,     colour: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
                    { label: 'Attended',  count: statusCounts.completed,   colour: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                    { label: 'Cancelled', count: statusCounts.cancelled,   colour: 'text-slate-400  bg-slate-500/10  border-slate-500/20'  },
                    { label: 'Rescheduled', count: statusCounts.rescheduled, colour: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                ].map(s => (
                    <div key={s.label} className={`flex items-center justify-between p-3 rounded-2xl border ${s.colour}`}>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-80">{s.label}</p>
                        <p className="text-xl font-black">{s.count}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="glassmorphic-card rounded-3xl p-6 shadow-xl">
                <Suspense fallback={<div className="h-20 animate-pulse bg-slate-800/50 rounded-2xl w-full"></div>}>
                    <BookingsFilters centres={orgCentres} resultsCount={totalRecords} />
                </Suspense>
            </div>

            {/* Bookings Table */}
            <BookingsTable bookings={bookingsData as any} centres={orgCentres} isFiltered={isFiltered} />

            {/* Server-Side Pagination Controls */}
            {totalPages > 1 && (
                <Pagination totalPages={totalPages} currentPage={currentPage} />
            )}
        </div>
    );
}
