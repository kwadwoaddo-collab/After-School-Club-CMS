import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, bookings, centres, bookingAttendees, parents, children } from '@/db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, desc, and, gte, lte, inArray, or, ilike } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Download, Calendar, List, Filter, Search, ChevronLeft } from 'lucide-react';
import { Suspense } from 'react';
import BookingsTable from '@/components/bookings/BookingsTable';
import BookingsFilters from '@/components/bookings/BookingsFilters';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { normalizeEnum } from '@/lib/search-params';
import { resolveActiveCentreId } from '@/lib/centre-filter';

const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

export default async function BookingsPage(props: {
    searchParams: Promise<{
        view?: string;
        status?: string;
        centre?: string;
        search?: string;
        from?: string;
        to?: string;
    }>
}) {
    const rawSearchParams = await props.searchParams;
    const session = await auth();

    // Normalize searchParams to ensure they are strings (Next.js can return arrays if multiple same-name params exist)
    const searchParams = {
        view: Array.isArray(rawSearchParams.view) ? rawSearchParams.view[0] : rawSearchParams.view,
        status: Array.isArray(rawSearchParams.status) ? rawSearchParams.status[0] : rawSearchParams.status,
        centre: Array.isArray(rawSearchParams.centre) ? rawSearchParams.centre[0] : rawSearchParams.centre,
        search: Array.isArray(rawSearchParams.search) ? rawSearchParams.search[0] : rawSearchParams.search,
        from: Array.isArray(rawSearchParams.from) ? rawSearchParams.from[0] : rawSearchParams.from,
        to: Array.isArray(rawSearchParams.to) ? rawSearchParams.to[0] : rawSearchParams.to,
    };

    if (!session?.user?.organisationId) {
        redirect('/onboarding');
    }

    const orgId = session.user.organisationId;

    // Get organisation
    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

    if (!org) redirect('/onboarding');

    // Get centres accessible to this user (ORG_OWNER sees all, others see assigned centres)
    const orgCentres = await getUserAccessibleCentres(session.user.id);

    const centreIds = orgCentres.map(c => c.id);

    if (centreIds.length === 0) {
        return (
            <div className="space-y-8 animate-in fade-in duration-700">
                <div className="flex items-center gap-4">

                    <div>
                        <h1 className="text-3xl font-bold text-[#FFFFFF] tracking-tight">Bookings</h1>
                        <p className="text-slate-400 font-medium mt-1">
                            Manage upcoming and past appointments
                        </p>
                    </div>
                </div>

                <div className="bg-surface-container-high border border-outline-variant/10 shadow-xl rounded-[32px] p-12 text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-[#FFFFFF] mb-2">No centres found</h3>
                    <p className="text-slate-500 mb-6">
                        Please set up a centre first before creating bookings
                    </p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Add Centre
                    </Link>
                </div>
            </div>
        );
    }

    const activeCentreId = await resolveActiveCentreId(searchParams.centre, centreIds);

    // Fetch bookings with filters
    let bookingsData: any[] = [];
    let searchActiveAndNoResults = false;
    let matchingIds: string[] = [];

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
            if (matchingIds.length === 0) {
                searchActiveAndNoResults = true;
            }
        } catch (error) {
            console.error('Failed to search bookings:', error);
            searchActiveAndNoResults = true;
        }
    }

    if (!searchActiveAndNoResults) {
        try {
            bookingsData = await db.query.bookings.findMany({
                where: (b, op) => {
                    const conds = [];

                    if (activeCentreId !== 'all') {
                        conds.push(op.eq(b.centreId, activeCentreId));
                    } else {
                        conds.push(op.inArray(b.centreId, centreIds));
                    }

                    // Filter by status if provided — validated against allowlist.
                    if (searchParams.status && searchParams.status !== 'all') {
                        const val = searchParams.status as string;
                        if (VALID_BOOKING_STATUSES.includes(val as any)) {
                            conds.push(op.eq(b.status, val as any));
                        }
                    }

                    // Filter by date range if provided
                    if (searchParams.from) {
                        const fromDate = new Date(searchParams.from);
                        if (!isNaN(fromDate.getTime())) {
                            conds.push(op.gte(b.startAt, fromDate));
                        }
                    }
                    if (searchParams.to) {
                        const toDate = new Date(searchParams.to);
                        if (!isNaN(toDate.getTime())) {
                            const toDateEnd = new Date(searchParams.to);
                            toDateEnd.setHours(23, 59, 59, 999);
                            conds.push(op.lte(b.startAt, toDateEnd));
                        }
                    }

                    // Filter by search matching IDs if search was performed
                    if (searchParams.search) {
                        conds.push(op.inArray(b.id, matchingIds));
                    }

                    return conds.length === 1 ? conds[0] : op.and(...conds);
                },
                orderBy: [desc(bookings.startAt)],
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
                        with: {
                            child: {
                                with: {
                                    notes: true
                                }
                            }
                        }
                    },
                    tutor: true,
                    child: {
                        with: {
                            notes: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to fetch bookings data:', error);
            // Fallback to empty array to prevent 500 crashes
            bookingsData = [];
        }
    }

    const isFiltered = !!(
        searchParams.search ||
        (searchParams.status && searchParams.status !== 'all') ||
        searchParams.from ||
        searchParams.to ||
        activeCentreId !== 'all'
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">

                    <div>
                        <h1 className="text-3xl font-bold text-[#FFFFFF] tracking-tight">Bookings</h1>
                        <p className="text-slate-400 font-medium mt-1">
                            Manage upcoming and past appointments
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2d35] hover:bg-[#343843] border border-[#3a3f4b] rounded-2xl text-sm font-semibold text-[#FFFFFF] transition-all">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                    <Link
                        href="/dashboard/bookings/new"
                        className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                    >
                        <Plus className="w-4 h-4" /> New Assessment
                    </Link>
                </div>
            </div>

            {/* Filters and View Toggle */}
            <div className="bg-surface-container-high border border-outline-variant/10 shadow-xl rounded-3xl p-6">
                <Suspense fallback={<div className="h-20 animate-pulse bg-slate-800/50 rounded-2xl w-full"></div>}>
                    <BookingsFilters centres={orgCentres} resultsCount={bookingsData.length} />
                </Suspense>
            </div>

            {/* Bookings Table */}
            <BookingsTable bookings={bookingsData as any} centres={orgCentres} isFiltered={isFiltered} />

            {/* Stats Footer */}
            <div className="bg-surface-container-high border border-outline-variant/10 shadow-xl rounded-3xl p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-[#FFFFFF]">{bookingsData.length}</p>
                        <p className="text-sm text-slate-400 font-medium">Total Bookings</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-blue-500">
                            {bookingsData.filter(b => b.status === 'confirmed').length}
                        </p>
                        <p className="text-sm text-slate-400 font-medium">Booked</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-accent-violet">
                            {bookingsData.filter(b => b.status === 'completed').length}
                        </p>
                        <p className="text-sm text-slate-400 font-medium">Attended</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
