import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
    organisations, centres, parents, children,
    bookings, bookingAttendees, registrations,
} from '@/db/schema';
import { eq, desc, asc, sql, count, and, gte, lt, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import {
    Users, CalendarCheck, ClipboardList, UserCircle2,
    ArrowRight, Plus, Share2, ChevronRight,
} from 'lucide-react';
import ShareBookingLinkButton from '@/components/dashboard/ShareBookingLinkButton';
import ExportReportButton from '@/components/dashboard/ExportReportButton';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    let org: any;
    try {
        [org] = await db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);
    } catch {
        throw new Error('Failed to load organisation data. Please try refreshing.');
    }
    if (!org) return redirect('/onboarding');

    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    const userRole = (session.user as any).role as string;
    const hasCentres = accessibleCentreIds.length > 0;
    const firstName = session.user.name?.split(' ')[0] || 'there';

    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ── Run all DB queries in parallel ────────────────────────────────────
    const [
        [{ count: totalStudents }],
        [{ count: totalBookingsAll }],
        [{ count: bookingsThisMonth }],
        recentBookings,
        [{ count: totalRegistrations }],
        [{ count: pendingRegistrations }],
        [{ count: registrationsThisMonth }],
    ] = await Promise.all([
        // Students
        db.select({ count: sql<number>`count(distinct ${children.id})` })
            .from(children)
            .innerJoin(parents, eq(children.parentId, parents.id))
            .where(eq(parents.organisationId, org.id)),

        // Total bookings
        hasCentres
            ? db.select({ count: sql<number>`count(*)` }).from(bookings).where(inArray(bookings.centreId, accessibleCentreIds))
            : Promise.resolve([{ count: 0 }]),

        // Bookings this month
        hasCentres
            ? db.select({ count: sql<number>`count(*)` }).from(bookings).where(and(inArray(bookings.centreId, accessibleCentreIds), gte(bookings.createdAt, firstDayThisMonth)))
            : Promise.resolve([{ count: 0 }]),

        // Recent bookings preview
        hasCentres
            ? db.select({
                id: bookings.id,
                startAt: bookings.startAt,
                status: bookings.status,
                centreName: centres.name,
                childFirst: children.firstName,
                childLast: children.lastName,
            })
                .from(bookings)
                .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
                .innerJoin(children, eq(bookingAttendees.childId, children.id))
                .innerJoin(centres, eq(bookings.centreId, centres.id))
                .where(inArray(bookings.centreId, accessibleCentreIds))
                .orderBy(asc(bookings.startAt))
                .limit(3)
            : Promise.resolve([]),

        // Total registrations
        db.select({ count: sql<number>`count(*)` }).from(registrations).where(eq(registrations.organisationId, org.id)),

        // Pending registrations
        db.select({ count: sql<number>`count(*)` }).from(registrations).where(and(eq(registrations.organisationId, org.id), eq(registrations.status, 'awaiting_confirmation'))),

        // Registrations this month
        db.select({ count: sql<number>`count(*)` }).from(registrations).where(and(eq(registrations.organisationId, org.id), gte(registrations.submittedAt, firstDayThisMonth))),
    ]);

    const registrationLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''}/register/${org.slug}`;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                        Overview
                    </h1>
                    <p className="text-slate-600 font-medium mt-1">
                        Welcome back, {firstName}! Here's what's happening today.
                    </p>
                </div>
                {userRole !== 'TUTOR' && (
                    <div className="flex flex-wrap gap-3">
                        <ShareBookingLinkButton bookingUrl={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/book/${org.slug}`} />
                        <ExportReportButton />
                        <Link
                            href="/dashboard/bookings/new"
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30"
                        >
                            <Plus className="w-4 h-4" /> New Assessment
                        </Link>
                    </div>
                )}
            </div>

            {/* ── Top-level stats row ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Students', value: totalStudents, icon: Users, color: 'bg-violet-100 text-violet-600' },
                    { label: 'All-time Bookings', value: totalBookingsAll, icon: CalendarCheck, color: 'bg-cyan-100 text-cyan-600' },
                    { label: 'Registrations', value: totalRegistrations, icon: ClipboardList, color: 'bg-emerald-100 text-emerald-600' },
                    { label: 'Pending Approval', value: pendingRegistrations, icon: ClipboardList, color: 'bg-amber-100 text-amber-600' },
                ].map(stat => (
                    <div key={stat.label} className="glass-card rounded-2xl p-5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{stat.value ?? 0}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Feature Module Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Assessments & Bookings */}
                <div className="glass-card rounded-3xl p-6 flex flex-col gap-5 border border-slate-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center">
                                <CalendarCheck className="w-6 h-6 text-cyan-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900 text-lg leading-tight">Assessments</h2>
                                <p className="text-xs text-slate-500">Booking & attendance</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-cyan-50 text-cyan-700 rounded-full border border-cyan-200">
                            LIVE
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xl font-bold text-slate-900">{totalBookingsAll}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Total bookings</p>
                        </div>
                        <div className="p-3 bg-cyan-50 rounded-xl">
                            <p className="text-xl font-bold text-cyan-700">{bookingsThisMonth}</p>
                            <p className="text-xs text-slate-500 mt-0.5">This month</p>
                        </div>
                    </div>

                    {/* Recent preview */}
                    {recentBookings.length > 0 ? (
                        <div className="space-y-2">
                            {recentBookings.map(b => (
                                <Link
                                    key={b.id}
                                    href={`/dashboard/bookings/${b.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{b.childFirst} {b.childLast}</p>
                                        <p className="text-xs text-slate-500">{b.centreName} · {b.startAt ? new Date(b.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic text-center py-2">No recent bookings</p>
                    )}

                    <Link
                        href="/dashboard/bookings"
                        className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700 text-sm font-bold hover:bg-cyan-100 transition-colors"
                    >
                        View All Assessments <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Registrations */}
                <div className="glass-card rounded-3xl p-6 flex flex-col gap-5 border border-slate-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                <ClipboardList className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900 text-lg leading-tight">Registrations</h2>
                                <p className="text-xs text-slate-500">Student sign-ups</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                            LIVE
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xl font-bold text-slate-900">{totalRegistrations}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Total submitted</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <p className="text-xl font-bold text-amber-600">{pendingRegistrations}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Awaiting review</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Registration Link</p>
                        <p className="text-xs text-slate-600 break-all font-mono">{registrationLink}</p>
                        <p className="text-xs text-slate-500">{registrationsThisMonth} new form{registrationsThisMonth !== 1 ? 's' : ''} submitted this month</p>
                    </div>

                    <div className="flex gap-2 mt-auto">
                        <Link
                            href="/dashboard/registrations"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors"
                        >
                            View All <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Staff — Coming Soon */}
                <div className="glass-card rounded-3xl p-6 flex flex-col gap-5 border border-dashed border-slate-300 opacity-80">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <UserCircle2 className="w-6 h-6 text-slate-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-700 text-lg leading-tight">Staff</h2>
                                <p className="text-xs text-slate-400">Scheduling & payroll</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                            COMING SOON
                        </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                            <UserCircle2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-slate-500">Manage your team</p>
                            <p className="text-xs text-slate-400 mt-1">Rota scheduling, pay rates, and attendance tracking — coming next.</p>
                        </div>
                    </div>

                    <button disabled className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 text-sm font-bold cursor-not-allowed">
                        Coming Soon
                    </button>
                </div>
            </div>

            {/* ── Students summary row ─────────────────────────────────── */}
            <div className="glass-card rounded-3xl p-6 flex items-center justify-between gap-4 border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900">Students</h2>
                        <p className="text-sm text-slate-500">{totalStudents} student{totalStudents !== 1 ? 's' : ''} registered across all centres</p>
                    </div>
                </div>
                <Link
                    href="/dashboard/students"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 transition-colors whitespace-nowrap"
                >
                    View Students <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
