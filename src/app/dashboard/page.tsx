import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres, parents, children, bookings, bookingAttendees } from '@/db/schema';
import { eq, desc, asc, sql, count, and, gte, lt } from 'drizzle-orm';
import Link from 'next/link';
import RecentStudentsTable from '@/components/dashboard/RecentStudentsTable';
import StatCard from '@/components/dashboard/StatCard';
import { Users, CalendarCheck, CreditCard, Clock, Plus, ArrowRight } from 'lucide-react';
import BookingLinkCard from '@/components/dashboard/BookingLinkCard';
import Pagination from '@/components/ui/Pagination';
import ExportReportButton from '@/components/dashboard/ExportReportButton';
import ShareBookingLinkButton from '@/components/dashboard/ShareBookingLinkButton';

export default async function DashboardPage(props: { searchParams: Promise<{ page?: string }> }) {
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    let org;
    try {
        [org] = await db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);
    } catch (error) {
        console.error('Database error fetching organisation:', error);
        throw new Error('Failed to load organisation data. Please try refreshing the page.');
    }

    if (!org) return redirect('/onboarding');

    const bookingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/book/${org.slug}`;

    // --- FETCH DATA ---
    const page = searchParams.page ? parseInt(searchParams.page) : 1;
    const limit = 5;
    const offset = Math.max(0, (page - 1) * limit);

    // Calculate date ranges for trend analysis
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // 1. Total Students (unique children with bookings) - Global count
    const [totalStudentsCount] = await db
        .select({ count: sql<number>`count(distinct ${children.id})` })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(eq(parents.organisationId, org.id));

    // Students trend: Compare current month vs last month
    const [currentMonthStudents] = await db
        .select({ count: sql<number>`count(distinct ${bookingAttendees.childId})` })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(
            and(
                eq(centres.organisationId, org.id),
                gte(bookings.createdAt, firstDayOfCurrentMonth)
            )
        );

    const [lastMonthStudents] = await db
        .select({ count: sql<number>`count(distinct ${bookingAttendees.childId})` })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(
            and(
                eq(centres.organisationId, org.id),
                gte(bookings.createdAt, firstDayOfLastMonth),
                lt(bookings.createdAt, firstDayOfCurrentMonth)
            )
        );

    // Calculate student trend percentage
    const currentStudents = currentMonthStudents?.count || 0;
    const previousStudents = lastMonthStudents?.count || 0;
    const studentTrend = previousStudents > 0
        ? Math.round(((currentStudents - previousStudents) / previousStudents) * 100)
        : currentStudents > 0 ? 100 : 0;
    const studentTrendType = studentTrend >= 0 ? 'up' : 'down';

    // 2. Assessment Bookings - Current month's bookings
    const [currentMonthBookings] = await db
        .select({ count: sql<number>`count(distinct ${bookings.id})` })
        .from(bookings)
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(
            and(
                eq(centres.organisationId, org.id),
                gte(bookings.createdAt, firstDayOfCurrentMonth)
            )
        );

    const [lastMonthBookingsCount] = await db
        .select({ count: sql<number>`count(distinct ${bookings.id})` })
        .from(bookings)
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(
            and(
                eq(centres.organisationId, org.id),
                gte(bookings.createdAt, firstDayOfLastMonth),
                lt(bookings.createdAt, firstDayOfCurrentMonth)
            )
        );

    // Calculate bookings trend percentage
    const currentBookings = currentMonthBookings?.count || 0;
    const previousBookings = lastMonthBookingsCount?.count || 0;
    const bookingsTrend = previousBookings > 0
        ? Math.round(((currentBookings - previousBookings) / previousBookings) * 100)
        : currentBookings > 0 ? 100 : 0;
    const bookingsTrendType = bookingsTrend >= 0 ? 'up' : 'down';


    // 2. Recent Bookings for the table (Closest first)
    const recentBookingsData = await db
        .select({
            bookingId: bookings.id,
            startAt: bookings.startAt,
            childId: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            grade: children.schoolYear,
            dob: children.dateOfBirth,
            parentFirstName: parents.firstName,
            parentLastName: parents.lastName,
            parentPhone: parents.phone,
            parentEmail: parents.email,
            centreName: centres.name,
            status: bookings.status,
        })
        .from(bookings)
        .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
        .innerJoin(children, eq(bookingAttendees.childId, children.id))
        .innerJoin(parents, eq(children.parentId, parents.id))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(centres.organisationId, org.id))
        .orderBy(asc(bookings.startAt)) // Closest date on top
        .limit(limit)
        .offset(offset);

    const [totalBookings] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(centres.organisationId, org.id));

    const totalPages = Math.ceil((totalBookings?.count || 0) / limit);

    const recentStudents = recentBookingsData.map((row) => ({
        id: row.childId,
        uniqueKey: `${row.bookingId}-${row.childId}`, // Composite key for React
        firstName: row.firstName,
        lastName: row.lastName,
        grade: row.grade,
        dob: row.dob,
        parentFirstName: row.parentFirstName,
        parentLastName: row.parentLastName,
        parentPhone: row.parentPhone,
        parentEmail: row.parentEmail,
        nextAppointment: row.startAt,
        centreName: row.centreName,
        bookingId: row.bookingId,
        status: row.status,
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Overview</h1>
                    <p className="text-slate-600 font-medium mt-1">Welcome back, {session.user.name?.split(' ')[0] || 'User'}! Here's what's happening today.</p>
                </div>
                <div className="flex gap-3">
                    <ShareBookingLinkButton bookingUrl={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/book/${org.slug}`} />
                    <ExportReportButton />
                    <Link
                        href="/dashboard/bookings/new"
                        className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                    >
                        <Plus className="w-4 h-4" /> New Assessment
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                    title="Total Students"
                    value={totalStudentsCount?.count || 0}
                    icon={Users}
                    trend={`${Math.abs(studentTrend)}%`}
                    trendType={studentTrendType}
                    color="violet"
                />
                <StatCard
                    title="Assessment Bookings"
                    value={currentBookings}
                    icon={CalendarCheck}
                    trend={`${Math.abs(bookingsTrend)}%`}
                    trendType={bookingsTrendType}
                    color="cyan"
                />
            </div>


            {/* Main Content */}
            <div className="space-y-8">
                <div className="glass-card rounded-[32px] overflow-hidden border border-slate-200">
                    <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Recent Assessments</h3>
                            <p className="text-sm text-slate-600 font-medium">Manage your latest student arrivals</p>
                        </div>
                        <Link href="/dashboard/bookings" className="text-sm font-bold text-primary hover:text-blue-700 flex items-center gap-1 transition-colors">
                            View All <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="p-2">
                        <RecentStudentsTable students={recentStudents} />
                        <div className="px-6 pb-6">
                            <Pagination totalPages={totalPages} currentPage={page} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
