import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, bookings, centres } from '@/db/schema';
import { eq, desc, and, gte, lte, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Download, Calendar, List, Filter, Search, ChevronLeft } from 'lucide-react';
import BookingsTable from '@/components/bookings/BookingsTable';
import BookingsFilters from '@/components/bookings/BookingsFilters';
import { getUserAccessibleCentres } from '@/lib/permissions';

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
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/login');
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
                    <Link
                        href="/dashboard"
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-[#FFFFFF] tracking-tight">Bookings</h1>
                        <p className="text-slate-400 font-medium mt-1">
                            Manage upcoming and past appointments
                        </p>
                    </div>
                </div>

                <div className="bg-[#1a1d23] border border-[#2a2a2a] shadow-xl rounded-[32px] p-12 text-center">
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

    // Build query conditions
    const conditions = [inArray(bookings.centreId, centreIds)];

    // Filter by specific centre if provided
    if (searchParams.centre && searchParams.centre !== 'all') {
        // Ensure they can only filter by centres they have access to
        if (centreIds.includes(searchParams.centre)) {
            conditions.push(eq(bookings.centreId, searchParams.centre));
        } else {
            // Unlikely to happen via UI, but safe fallback: match none if trying to access unauthorized centre
            conditions.push(eq(bookings.centreId, 'unauthorized_centre_id'));
        }
    }

    // Filter by status if provided
    if (searchParams.status && searchParams.status !== 'all') {
        conditions.push(eq(bookings.status, searchParams.status));
    }

    // Filter by search string (optional, depends on how you want to handle it, leaving it simple for now)

    // Fetch bookings with filters
    const bookingsData = await db.query.bookings.findMany({
        where: (bookings, { inArray }) => and(...conditions),
        orderBy: [desc(bookings.startAt)],
        with: {
            centre: true,
            parent: true,
            attendees: {
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

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                    </Link>
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
            <div className="bg-[#1a1d23] border border-[#2a2a2a] shadow-xl rounded-3xl p-6">
                <BookingsFilters centres={orgCentres} />
            </div>

            {/* Bookings Table */}
            <BookingsTable bookings={bookingsData as any} />

            {/* Stats Footer */}
            <div className="bg-[#1a1d23] border border-[#2a2a2a] shadow-xl rounded-3xl p-6">
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
