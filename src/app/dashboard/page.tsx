import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
    organisations, centres, parents, children,
    bookings, bookingAttendees, registrations, registrationChildren,
} from '@/db/schema';
import { eq, desc, asc, sql, count, and, gte, lt, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import {
    Users, CalendarCheck, ClipboardList, UserCircle2,
    ArrowRight, ChevronRight, AlertTriangle, Shield
} from 'lucide-react';
import { studentNotes } from '@/db/schema';

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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
        recentRegistrations,
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
                childId: children.id,
            })
                .from(bookings)
                .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
                .innerJoin(children, eq(bookingAttendees.childId, children.id))
                .innerJoin(centres, eq(bookings.centreId, centres.id))
                .where(
                    and(
                        inArray(bookings.centreId, accessibleCentreIds),
                        gte(bookings.startAt, today)
                    )
                )
                .orderBy(asc(bookings.startAt))
                .limit(5)
            : Promise.resolve([]),

        // Total registrations
        db.select({ count: sql<number>`count(*)` }).from(registrations).where(eq(registrations.organisationId, org.id)),

        // Pending registrations
        db.select({ count: sql<number>`count(*)` }).from(registrations).where(and(eq(registrations.organisationId, org.id), eq(registrations.status, 'awaiting_confirmation'))),

        // Registrations this month
        db.select({ count: sql<number>`count(*)` }).from(registrations).where(and(eq(registrations.organisationId, org.id), gte(registrations.submittedAt, firstDayThisMonth))),

        // Recent registrations preview
        db.select({
            childFirst: registrationChildren.submittedFirstName,
            childLast: registrationChildren.submittedLastName,
            submittedAt: registrations.submittedAt,
            status: registrations.status,
            registrationId: registrations.id,
        })
            .from(registrationChildren)
            .innerJoin(registrations, eq(registrations.id, registrationChildren.registrationId))
            .where(eq(registrations.organisationId, org.id))
            .orderBy(desc(registrations.submittedAt), asc(registrationChildren.submittedFirstName))
            .limit(5),
    ]);

    const recentBookingsChildIds = recentBookings.map(b => b.childId);
    
    // Fetch medical and safeguarding notes
    const safetyNotes = recentBookingsChildIds.length > 0 ? await db.query.studentNotes.findMany({
        where: and(
            inArray(studentNotes.childId, recentBookingsChildIds),
            inArray(studentNotes.category, ['Medical', 'Safeguarding'])
        )
    }) : [];

    // Map to bookings
    const recentBookingsWithNotes = recentBookings.map(b => {
        const studentSafetyNotes = safetyNotes.filter(n => n.childId === b.childId);
        const medNotes = studentSafetyNotes.filter(n => n.category === 'Medical');
        const safeguardNotes = studentSafetyNotes.filter(n => n.category === 'Safeguarding');
        return {
            ...b,
            hasMedicalNote: medNotes.length > 0,
            medicalNotesContent: medNotes.map(n => n.content).join('\n\n'),
            hasSafeguardingNote: safeguardNotes.length > 0,
            safeguardingNotesContent: safeguardNotes.map(n => n.content).join('\n\n')
        };
    });

    const registrationLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''}/register/${org.slug}`;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#e5e2e1] tracking-tight">
                        Overview
                    </h1>
                    <p className="text-[#8c909f] font-medium mt-1">
                        Welcome back, {firstName}! Here's what's happening today.
                    </p>
                </div>
                {userRole !== 'TUTOR' && (
                    <div className="hidden">
                        {/* Header actions (New Assessment, Export, Links) removed per design. Functions accessible via Sidebar or Card sections. */}
                    </div>
                )}
            </div>

            {/* ── Top-level stats row ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'TOTAL STUDENTS', value: totalStudents, icon: Users },
                    { label: 'ALL-TIME BOOKINGS', value: totalBookingsAll, icon: CalendarCheck },
                    { label: 'REGISTRATIONS', value: totalRegistrations, icon: ClipboardList },
                    { label: 'PENDING APPROVAL', value: pendingRegistrations, icon: ClipboardList },
                ].map(stat => (
                    <div key={stat.label} className="bg-[#1a1d23] rounded-2xl p-5 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[#2a2a2a] text-[#adc6ff]`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <p className="text-3xl font-bold text-[#e5e2e1] tracking-tight">{stat.value ?? 0}</p>
                        <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Feature Module Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column - Assessments */}
                <div className="flex flex-col gap-6">

                    {/* Assessments & Bookings */}
                    <div className="bg-[#1a1d23] rounded-[32px] p-8 flex flex-col gap-6 border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)] h-full">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#2a2a2a] rounded-2xl flex items-center justify-center">
                                    <CalendarCheck className="w-6 h-6 text-[#adc6ff]" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-[#e5e2e1] text-xl leading-tight">Assessments & Bookings</h2>
                                    <p className="text-sm text-[#8c909f] mt-1">Manage schedules and attendance</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-[#adc6ff]/10 text-[#adc6ff] rounded-full border border-[#adc6ff]/20">
                                LIVE
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[#2a2a2a] rounded-2xl border border-[#424754]/15">
                                <p className="text-2xl font-bold text-[#e5e2e1]">{totalBookingsAll}</p>
                                <p className="text-xs text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Total Bookings</p>
                            </div>
                            <div className="p-4 bg-[#adc6ff]/10 rounded-2xl border border-[#adc6ff]/20">
                                <p className="text-2xl font-bold text-[#adc6ff]">{bookingsThisMonth}</p>
                                <p className="text-xs text-[#adc6ff] opacity-80 font-bold mt-1 uppercase tracking-wider">This Month</p>
                            </div>
                        </div>

                        {/* Recent preview */}
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-[#e5e2e1] mb-4 uppercase tracking-wider">Recent Bookings</h3>
                            {recentBookingsWithNotes.length > 0 ? (
                                <div className="space-y-2">
                                    {recentBookingsWithNotes.map(b => (
                                        <Link
                                            key={b.id}
                                            href={`/dashboard/bookings/${b.id}`}
                                            className="flex items-center justify-between p-4 rounded-2xl bg-[#1c1b1b] hover:bg-[#353535] border border-[#424754]/15 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-[#adc6ff]/10 flex items-center justify-center text-[#adc6ff] font-bold">
                                                    {b.childFirst[0]}{b.childLast[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-[#e5e2e1]">{b.childFirst} {b.childLast}</p>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                            b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                            b.status === 'completed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                            b.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                        }`}>
                                                            {b.status === 'completed' ? 'Attended' : b.status}
                                                        </span>
                                                        {b.hasMedicalNote && (
                                                            <div className="relative group/tooltip flex items-center outline-none">
                                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/20 cursor-help shadow-sm">
                                                                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                                                                </div>
                                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-[#2a2a2a] border border-[#424754]/50 text-[#e5e2e1] text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                    <div className="font-bold text-rose-400 mb-1 border-b border-[#424754]/50 pb-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/>Medical Alert</div>
                                                                    {b.medicalNotesContent}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2a2a2a]"></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {b.hasSafeguardingNote && (
                                                            <div className="relative group/tooltip flex items-center outline-none">
                                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 cursor-help shadow-sm">
                                                                    <Shield className="w-3 h-3 text-blue-400" />
                                                                </div>
                                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-[#2a2a2a] border border-[#424754]/50 text-[#e5e2e1] text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                    <div className="font-bold text-blue-400 mb-1 border-b border-[#424754]/50 pb-1 flex items-center gap-1.5"><Shield className="w-3 h-3"/>Safeguarding Alert</div>
                                                                    {b.safeguardingNotesContent}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2a2a2a]"></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-[#8c909f] mt-0.5">{b.centreName} · {b.startAt ? new Date(b.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-[#424754] group-hover:text-[#adc6ff] transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-[#8c909f] italic text-center py-6">No recent bookings found.</p>
                            )}
                        </div>

                        <Link
                            href="/dashboard/bookings"
                            className="mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#2a2a2a] text-[#adc6ff] text-sm font-bold hover:bg-[#353535] transition-colors border border-[#424754]/15"
                        >
                            View All Assessments <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Middle Column - Registrations */}
                <div className="flex flex-col gap-6">
                    {/* Registrations */}
                    <div className="bg-[#1a1d23] rounded-[32px] p-6 flex flex-col gap-6 border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)] h-full">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#2a2a2a] rounded-2xl flex items-center justify-center">
                                    <ClipboardList className="w-6 h-6 text-[#d0bcff]" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-[#e5e2e1] text-xl leading-tight">Registrations</h2>
                                    <p className="text-sm text-[#8c909f] mt-1">Student sign-ups</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-[#d0bcff]/10 text-[#d0bcff] rounded-full border border-[#d0bcff]/20">
                                LIVE
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[#2a2a2a] rounded-2xl border border-[#424754]/15">
                                <p className="text-2xl font-bold text-[#e5e2e1]">{totalRegistrations}</p>
                                <p className="text-xs text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Total Submitted</p>
                            </div>
                            <div className="p-4 bg-[#ffb599]/10 rounded-2xl border border-[#ffb599]/20">
                                <p className="text-2xl font-bold text-[#ffb599]">{pendingRegistrations}</p>
                                <p className="text-xs text-[#ffb599] opacity-80 font-bold mt-1 uppercase tracking-wider">Awaiting Review</p>
                            </div>
                        </div>

                        {/* Recent preview */}
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-[#e5e2e1] mb-4 uppercase tracking-wider">Recent Registrations</h3>
                            {recentRegistrations.length > 0 ? (
                                <div className="space-y-2">
                                    {recentRegistrations.map((r, i) => (
                                        <Link
                                            key={`${r.registrationId}-${i}`}
                                            href={`/dashboard/registrations/${r.registrationId}`}
                                            className="flex items-center justify-between p-4 rounded-2xl bg-[#1c1b1b] hover:bg-[#353535] border border-[#424754]/15 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-[#d0bcff]/10 flex items-center justify-center text-[#d0bcff] font-bold">
                                                    {r.childFirst[0]}{r.childLast[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-[#e5e2e1]">{r.childFirst} {r.childLast}</p>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                            r.status === 'awaiting_confirmation' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                            r.status === 'signed_up' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                        }`}>
                                                            {r.status === 'awaiting_confirmation' ? 'Pending Review' : 
                                                             r.status === 'signed_up' ? 'Approved' : 'Pending'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-[#8c909f] mt-0.5">
                                                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-[#424754] group-hover:text-[#d0bcff] transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-[#8c909f] italic text-center py-6">No recent registrations found.</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-[#d0bcff] uppercase tracking-wider">Public Link</p>
                                <p className="text-[10px] text-[#8c909f]">{registrationsThisMonth} new this month</p>
                            </div>
                            <div className="p-3 rounded-xl bg-[#2a2a2a] border border-[#424754]/15">
                                <p className="text-xs text-[#e5e2e1] font-mono truncate">{registrationLink}</p>
                            </div>
                        </div>

                        <Link
                            href="/dashboard/registrations"
                            className="mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#2a2a2a] text-[#d0bcff] text-sm font-bold hover:bg-[#353535] transition-colors border border-[#424754]/15"
                        >
                            View All Registrations <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Right Column - Staff */}
                <div className="flex flex-col gap-6">
                    {/* Staff — Coming Soon */}
                    <div className="bg-[#1a1d23] rounded-[32px] p-6 flex flex-col gap-5 border border-dashed border-[#424754] shadow-[0_8px_32px_rgba(0,0,0,0.3)] h-full opacity-70">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#2a2a2a] rounded-2xl flex items-center justify-center">
                                    <UserCircle2 className="w-6 h-6 text-[#8c909f]" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-[#e5e2e1] text-xl leading-tight">Staff</h2>
                                    <p className="text-sm text-[#8c909f] mt-1">Scheduling & payroll</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-[#2a2a2a] text-[#8c909f] rounded-full border border-[#424754]/15">
                                COMING SOON
                            </span>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
                            <div className="w-16 h-16 bg-[#2a2a2a] rounded-2xl flex items-center justify-center">
                                <UserCircle2 className="w-8 h-8 text-[#8c909f] opacity-50" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-[#8c909f]">Manage your team</p>
                                <p className="text-xs text-[#8c909f] opacity-80 mt-1 max-w-[200px] mx-auto">Rota scheduling, pay rates, and attendance tracking — coming next.</p>
                            </div>
                        </div>

                        <button disabled className="mt-auto flex items-center justify-center gap-2 py-3 rounded-2xl border border-[#424754]/15 bg-[#2a2a2a] text-[#8c909f] text-sm font-bold cursor-not-allowed">
                            Coming Soon
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Student Ecosystem row ─────────────────────────────────── */}
            <div className="bg-[#1a1d23] rounded-[32px] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-[#2a2a2a] rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Users className="w-7 h-7 text-[#adc6ff]" />
                    </div>
                    <div>
                        <h2 className="font-bold text-[#e5e2e1] text-xl">Student Ecosystem</h2>
                        <p className="text-sm text-[#8c909f] mt-1">{totalStudents} student{totalStudents !== 1 ? 's' : ''} registered across all centres</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end mt-4 sm:mt-0">
                    {/* Overlapping Avatars */}
                    <div className="hidden sm:flex -space-x-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="w-10 h-10 rounded-full border-2 border-[#1a1d23] bg-[#2a2a2a] flex items-center justify-center text-[#8c909f] shadow-sm relative z-[1]">
                                <UserCircle2 className="w-5 h-5 opacity-60" />
                            </div>
                        ))}
                    </div>
                    <Link
                        href="/dashboard/students"
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-[#424754]/15 bg-[#2a2a2a] text-[#adc6ff] text-sm font-bold hover:bg-[#353535] transition-colors whitespace-nowrap"
                    >
                        View Students <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
