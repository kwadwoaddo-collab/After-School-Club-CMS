import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, bookings, centres, bookingAttendees, parents, children } from '@/db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, desc, and, gte, lte, inArray, or, ilike, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Download, Calendar, AlertTriangle } from 'lucide-react';
import { Suspense } from 'react';
import BookingsTable from '@/features/bookings/components/BookingsTable';
import BookingsFilters from '@/features/bookings/components/BookingsFilters';
import Pagination from '@/components/ui/Pagination';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
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
    const session = await requireTenantSession();

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

    let org;
    let orgCentres: { id: string; name: string }[] = [];
    let centreIds: string[] = [];

    try {
        const [fetchedOrg] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
        org = fetchedOrg;

        if (org) {
            const fetchedCentres = await getUserAccessibleCentres(session.user.id);
            orgCentres = fetchedCentres.map((c) => ({ id: c.id, name: c.name }));
            centreIds = fetchedCentres.map((c) => c.id);
        }
    } catch (e) {
        logger.error('Failed to validate org:', e);
        redirect('/dashboard');
    }

    if (!org) redirect('/onboarding');

    if (centreIds.length === 0) {
        return (
            <div className="space-y-6">
                <HeaderPortal targetId="header-left">
                    <h1 className="text-page-title text-text">Bookings</h1>
                </HeaderPortal>
                <EmptyState
                    icon={<Calendar className="w-8 h-8" />}
                    title="No centres found"
                    description="Please set up a centre first before creating bookings."
                    action={
                        <Button asChild>
                            <Link href="/dashboard/centres/add">
                                <Plus className="w-3.5 h-3.5" />
                                Add Centre
                            </Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    const activeCentreId = await resolveActiveCentreId(searchParams.centre, centreIds);

    // Handle "today" quick filter
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isToday = searchParams.today === 'true';
    const effectiveFrom = isToday ? todayStr : searchParams.from;
    const effectiveTo   = isToday ? todayStr : searchParams.to;

    let bookingsData: unknown[] = [];
    let searchActiveAndNoResults = false;
    let matchingIds: string[] = [];
    let hasFetchError = false;

    // Pagination configuration
    const PAGE_SIZE = 50;
    const currentPage = parseInt(searchParams.page || '1', 10);
    const offset = (currentPage - 1) * PAGE_SIZE;

    if (searchParams.search) {
        const searchPattern = `%${searchParams.search}%`;
        const attendeeChildren = alias(children, 'attendee_children');
        try {
            // Stage B finding: this query referenced the bare `children`
            // table in its WHERE clause (children.firstName/lastName)
            // without ever joining it — bookings has no direct child
            // reference, only bookingAttendees -> children, which is what
            // `attendeeChildren` (the aliased join actually present below)
            // already covers. Postgres rejected every search with
            // "invalid reference to FROM-clause entry for table
            // \"children\"", which the catch block below silently turned
            // into "Unable to load bookings" + an always-empty result —
            // i.e. booking search was completely non-functional. Narrow,
            // evidenced fix: drop the two unjoined, duplicate conditions;
            // attendeeChildren.firstName/lastName already provide the
            // identical child-name search.
            const matchingBookings = await db
                .select({ id: bookings.id })
                .from(bookings)
                .leftJoin(parents, eq(bookings.parentId, parents.id))
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
                            ilike(attendeeChildren.firstName, searchPattern),
                            ilike(attendeeChildren.lastName, searchPattern)
                        )
                    )
                );
            matchingIds = matchingBookings.map(mb => mb.id);
            if (matchingIds.length === 0) searchActiveAndNoResults = true;
        } catch (error) {
            logger.error('Failed to search bookings:', error);
            searchActiveAndNoResults = true;
            hasFetchError = true;
        }
    }

    // Build conditions for Bookings list query and aggregation query
    const conds = [];
    const aggConds = [];

    if (activeCentreId !== 'all') {
        conds.push(eq(bookings.centreId, activeCentreId));
        aggConds.push(eq(bookings.centreId, activeCentreId));
    } else {
        conds.push(inArray(bookings.centreId, centreIds));
        aggConds.push(inArray(bookings.centreId, centreIds));
    }

    if (searchParams.status && searchParams.status !== 'all') {
        const val = searchParams.status as string;
        if (VALID_BOOKING_STATUSES.includes(val as any)) {
            conds.push(eq(bookings.status, val as any));
        }
    }

    if (effectiveFrom) {
        const fromDate = new Date(effectiveFrom);
        if (!isNaN(fromDate.getTime())) {
            conds.push(gte(bookings.startAt, startOfDay(fromDate)));
            aggConds.push(gte(bookings.startAt, startOfDay(fromDate)));
        }
    }
    if (effectiveTo) {
        const toDate = new Date(effectiveTo);
        if (!isNaN(toDate.getTime())) {
            conds.push(lte(bookings.startAt, endOfDay(toDate)));
            aggConds.push(lte(bookings.startAt, endOfDay(toDate)));
        }
    }

    if (searchParams.search) {
        conds.push(inArray(bookings.id, matchingIds));
        aggConds.push(inArray(bookings.id, matchingIds));
    }

    const finalWhere = conds.length === 1 ? conds[0] : and(...conds);
    const aggWhere = aggConds.length === 1 ? aggConds[0] : (aggConds.length > 0 ? and(...aggConds) : undefined);

    let totalRecords = 0;
    let statusCountsAgg: { status: string; count: number }[] = [];

    if (!searchActiveAndNoResults) {
        try {
            // Retrieve aggregations for accurate top-level bubbles (excludes status filter)
            statusCountsAgg = await db.select({
                status: bookings.status,
                count: sql<number>`count(*)::int`
            })
            .from(bookings)
            .where(aggWhere)
            .groupBy(bookings.status);

            // Set total records for the active filters (includes status filter)
            const [totalRes] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(bookings)
                .where(finalWhere);
            totalRecords = totalRes?.count || 0;

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
                    staff: true
                }
            });
        } catch (error) {
            logger.error('Failed to fetch bookings data:', error);
            bookingsData = [];
            hasFetchError = true;
        }
    }

    const isFiltered = !!(
        searchParams.search ||
        (searchParams.status && searchParams.status !== 'all') ||
        effectiveFrom ||
        effectiveTo ||
        activeCentreId !== 'all'
    );

    // Status counts for Segmented Status Tabs
    //
    // Stage B finding: this map previously omitted 'signed_up' — one of the
    // six VALID_BOOKING_STATUSES defined above and one of the six variants
    // BookingsTable/Booking Detail already render a status badge for — so a
    // booking in that status was invisible to every status tab and silently
    // missing from totalAggCount, producing a visibly wrong "X of Y" header
    // count (X could exceed Y) whenever any booking held that status. Narrow,
    // evidenced fix: complete the map to match VALID_BOOKING_STATUSES, no new
    // status or business rule introduced.
    const statusCounts = {
        confirmed:   statusCountsAgg.find(s => s.status === 'confirmed')?.count || 0,
        signed_up:   statusCountsAgg.find(s => s.status === 'signed_up')?.count || 0,
        pending:     statusCountsAgg.find(s => s.status === 'pending')?.count || 0,
        completed:   statusCountsAgg.find(s => s.status === 'completed')?.count || 0,
        cancelled:   statusCountsAgg.find(s => s.status === 'cancelled')?.count || 0,
        rescheduled: statusCountsAgg.find(s => s.status === 'rescheduled')?.count || 0,
    };

    const totalAggCount = statusCounts.confirmed + statusCounts.signed_up + statusCounts.pending + statusCounts.completed + statusCounts.cancelled + statusCounts.rescheduled;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* Header Portals — Fuses page header into the global header bar */}
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-page-title text-text">Bookings</h1>
                    <span className="px-2 py-0.5 rounded-sm bg-page border border-border-subtle text-text-muted text-xs font-medium">
                        {isFiltered ? `${totalRecords} of ${totalAggCount}` : totalAggCount}
                    </span>
                </div>
            </HeaderPortal>

            <HeaderPortal targetId="header-middle">{null}</HeaderPortal>

            <HeaderPortal targetId="header-right-actions">
                <Button variant="outline" asChild>
                    <Link href={`/api/bookings/export?centre=${activeCentreId}&status=${searchParams.status || 'all'}`}>
                        <Download className="w-3.5 h-3.5" />
                        Export
                    </Link>
                </Button>
                <Button asChild>
                    <Link href="/dashboard/bookings/new">
                        <Plus className="w-3.5 h-3.5" />
                        New Booking
                    </Link>
                </Button>
            </HeaderPortal>

            {/* Toolbar — sticky */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-page/90 backdrop-blur-sm border-b border-border-subtle">
                <Suspense fallback={<div className="h-10 animate-pulse bg-page rounded-sm w-full" />}>
                    <BookingsFilters
                        centres={orgCentres}
                        resultsCount={totalRecords}
                        statusCounts={statusCounts}
                        totalAggCount={totalAggCount}
                    />
                </Suspense>
            </div>

            {hasFetchError && (
                <div className="rounded-md bg-danger-soft border border-danger/20 text-small-body text-danger font-medium px-4 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p>Unable to load bookings — please refresh.</p>
                </div>
            )}

            {/* Bookings Table */}
            <div>
                <BookingsTable bookings={bookingsData as any} centres={orgCentres} isFiltered={isFiltered} />

                {totalPages > 1 && (
                    <div className="mt-4">
                        <Pagination currentPage={currentPage} totalPages={totalPages} />
                    </div>
                )}
            </div>
        </div>
    );
}
