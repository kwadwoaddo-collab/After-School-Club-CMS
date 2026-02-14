import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres, parents, children, bookings, bookingAttendees } from '@/db/schema';
import { eq, desc, asc, sql, count } from 'drizzle-orm';
import Link from 'next/link';
import RecentStudentsTable from '@/components/dashboard/RecentStudentsTable';
import StatCard from '@/components/dashboard/StatCard';
import { Users, CalendarCheck, CreditCard, Clock, Plus, ArrowRight } from 'lucide-react';
import BookingLinkCard from '@/components/dashboard/BookingLinkCard';
import Pagination from '@/components/ui/Pagination';
import ExportReportButton from '@/components/dashboard/ExportReportButton';

export default async function DashboardPage(props: { searchParams: Promise<{ page?: string }> }) {
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    const bookingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/book/${org.slug}`;

    // --- FETCH DATA ---
    const page = searchParams.page ? parseInt(searchParams.page) : 1;
    const limit = 5;
    const offset = Math.max(0, (page - 1) * limit);

    // 1. Stats (Split into separate queries for better reliability)
    const [studentsCount] = await db
        .select({ count: sql<number>`count(distinct ${children.id})` })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(eq(parents.organisationId, org.id));

    const [bookingsCount] = await db
        .select({ count: sql<number>`count(distinct ${bookings.id})` })
        .from(bookings)
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(centres.organisationId, org.id));

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
                    <p className="text-slate-500 font-medium mt-1">Welcome back, {session.user.name?.split(' ')[0] || 'User'}! Here's what's happening today.</p>
                </div>
                <div className="flex gap-3">
                    <ExportReportButton />
                    <Link
                        href="/dashboard/bookings/new"
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" /> New Assessment
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                    title="Total Students"
                    value={studentsCount?.count || 0}
                    icon={Users}
                    trend="12%"
                    trendType="up"
                    color="violet"
                />
                <StatCard
                    title="Assessment Bookings"
                    value={bookingsCount?.count || 0}
                    icon={CalendarCheck}
                    trend="5%"
                    trendType="up"
                    color="cyan"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Table */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="glass-card rounded-[32px] overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Recent Assessments</h3>
                                <p className="text-sm text-slate-500 font-medium">Manage your latest student arrivals</p>
                            </div>
                            <Link href="/dashboard/bookings" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
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

                    {/* Simple Bottom Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <BookingLinkCard bookingLink={bookingLink} />

                        <div className="glass-card p-8 rounded-[32px] relative overflow-hidden group">
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Need Help?</h3>
                                <p className="text-slate-500 text-sm font-medium mb-6">Our support team is available 24/7 to help you with any issues.</p>
                                <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors">
                                    Open Support Ticket
                                </button>
                            </div>
                            {/* Decorative background element */}
                            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
                        </div>
                    </div>
                </div>

                {/* Sidebar/Right Column: Quick Actions */}
                <div className="space-y-8">
                    <div className="glass-card p-8 rounded-[32px] bg-primary group hover:bg-blue-700 transition-all cursor-pointer">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white tracking-widest uppercase">Quick Add</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">New Centre?</h3>
                        <p className="text-white/70 text-sm font-medium">Easily scale your business by adding more locations.</p>
                        <div className="mt-6 flex items-center gap-2 text-white font-bold text-sm">
                            GET STARTED <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
