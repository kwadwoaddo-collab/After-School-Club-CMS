import { auth } from '@/lib/auth';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
    organisations, centres, parents, children,
    bookings, bookingAttendees, registrations, registrationChildren,
} from '@/db/schema';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { eq, desc, asc, sql, and, gte, lt, lte, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { AttendanceRadial } from '@/components/ui/AttendanceRadial';
import { CapacityIndicator } from '@/components/ui/CapacityIndicator';
import { LoadForecast } from '@/components/dashboard/LoadForecast';
import { DashboardFilter } from '@/components/dashboard/DashboardFilter';
import { Suspense } from 'react';
import { startOfDay, endOfDay, addDays, isSameDay, subDays, eachWeekOfInterval } from 'date-fns';
import { RegistrationFunnel } from '@/components/dashboard/RegistrationFunnel';
import { GrowthSparkline } from '@/components/dashboard/GrowthSparkline';
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist';
import {
    Users, CalendarCheck, ClipboardList, UserCircle2,
    ArrowRight, ChevronRight, AlertTriangle, Shield,
    BarChart3, MapPin, ArrowUpRight, ArrowDownRight, Minus,
    AlertCircle
} from 'lucide-react';
import { studentNotes } from '@/db/schema';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isValid, format, subWeeks, subMonths } from 'date-fns';
import { resolveAttendanceStatus, getAttendanceColorClass } from '@/lib/attendance';
import type { AttendanceStatus } from '@/lib/attendance';
import { normalizeString, normalizeDate } from '@/lib/search-params';
import { cn } from '@/components/ui/utils';
import { TodaysSnapshot } from '@/components/dashboard/TodaysSnapshot';
import { RevenueWidget } from '@/components/dashboard/RevenueWidget';
import { AttendanceHeatmap } from '@/components/dashboard/AttendanceHeatmap';

export default async function DashboardPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const searchParams = await props.searchParams;
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    let org: any;
    try {
        const orgs = await db
            .select({
                id: organisations.id,
                slug: organisations.slug,
                contactEmail: organisations.contactEmail,
                contactPhone: organisations.contactPhone,
                registrationTerms: organisations.registrationTerms,
                brandColor: organisations.brandColor,
                logoUrl: organisations.logoUrl,
            })
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);
        org = orgs[0];
    } catch {
        throw new Error('Failed to load organisation data. Please try refreshing.');
    }
    if (!org) return redirect('/onboarding');

    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    const userRole = (session.user as any).role as string;
    const hasCentres = accessibleCentreIds.length > 0;
    const firstName = session.user.name?.split(' ')[0] || '';

    const activeCentreId = await resolveActiveCentreId(searchParams.centre, accessibleCentreIds);

    const childrenCentreCondition = activeCentreId !== 'all'
        ? eq(children.centreId, activeCentreId)
        : (hasCentres ? inArray(children.centreId, accessibleCentreIds) : sql`false`);

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

    // Month and Week relative to the target date for the 3-column stats
    const targetMonthStart = startOfMonth(targetDate);
    const targetMonthEnd = endOfMonth(targetDate);
    const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const targetWeekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

    const dateLabel = currentView === 'weekly'
        ? `${format(activeStartDate, 'MMM d')} - ${format(activeEndDate, 'MMM d, yyyy')}`
        : format(activeStartDate, 'MMMM yyyy');

    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Run all DB queries in parallel (CONSOLIDATED) ────────────────────────────────────
    let dashboardData: any = {};
    try {
        const [
            [studentKpis],
            [bookingKpis],
            recentBookings,
            [registrationKpis],
            recentRegistrations,
            centresList,
            centreOccupancyData,
            weeklyRegistrations,
            registrationPipelineData,
            peakDayData,
        ] = await Promise.all([
            // consolidated Students
            db.select({ 
                total: sql<number>`count(distinct ${children.id})::int`,
                activePeriod: sql<number>`count(distinct ${children.id}) filter (where ${children.createdAt} >= ${activeStartDate.toISOString()} and ${children.createdAt} <= ${activeEndDate.toISOString()})::int`,
                prevPeriod: sql<number>`count(distinct ${children.id}) filter (where ${children.createdAt} >= ${prevStartDate.toISOString()} and ${children.createdAt} <= ${prevEndDate.toISOString()})::int`
            })
                .from(children)
                .innerJoin(parents, eq(children.parentId, parents.id))
                .where(
                    and(
                        eq(parents.organisationId, org.id),
                        childrenCentreCondition
                    )
                ),

            // consolidated bookings
            hasCentres
                ? db.select({ 
                    totalAll: sql<number>`count(*)::int`,
                    thisMonth: sql<number>`count(*) filter (where ${bookings.startAt} >= ${targetMonthStart.toISOString()} and ${bookings.startAt} <= ${targetMonthEnd.toISOString()})::int`,
                    thisWeek: sql<number>`count(*) filter (where ${bookings.startAt} >= ${targetWeekStart.toISOString()} and ${bookings.startAt} <= ${targetWeekEnd.toISOString()})::int`,
                    activePeriod: sql<number>`count(*) filter (where ${bookings.startAt} >= ${activeStartDate.toISOString()} and ${bookings.startAt} <= ${activeEndDate.toISOString()})::int`,
                    prevPeriod: sql<number>`count(*) filter (where ${bookings.startAt} >= ${prevStartDate.toISOString()} and ${bookings.startAt} <= ${prevEndDate.toISOString()})::int`
                }).from(bookings).where(bookingsCentreCondition)
                : Promise.resolve([{ totalAll: 0, thisMonth: 0, thisWeek: 0, activePeriod: 0, prevPeriod: 0 }]),

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
                    attendanceStats: sql<string>`(
                        SELECT json_build_object(
                            'total', count(*)::int,
                            'completed', (count(*) filter (where b2.status = 'completed'))::int
                        )
                        FROM booking_attendees ba
                        JOIN bookings b2 ON ba.booking_id = b2.id
                        WHERE ba.child_id = ${children.id}
                    )`
                })
                    .from(bookings)
                    .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
                    .innerJoin(children, eq(bookingAttendees.childId, children.id))
                    .innerJoin(centres, eq(bookings.centreId, centres.id))
                    .where(
                        and(
                            bookingsCentreCondition,
                            gte(bookings.startAt, activeStartDate),
                            lte(bookings.startAt, activeEndDate)
                        )
                    )
                    .orderBy(asc(bookings.startAt))
                    .limit(10)
                : Promise.resolve([]),

            // consolidated Registrations
            db.select({ 
                total: sql<number>`count(*)::int`,
                pending: sql<number>`count(*) filter (where ${registrations.status} = 'awaiting_confirmation')::int`,
                thisMonth: sql<number>`count(*) filter (where ${registrations.startDate} >= ${targetMonthStart.toISOString()} and ${registrations.startDate} <= ${targetMonthEnd.toISOString()})::int`,
                thisWeek: sql<number>`count(*) filter (where ${registrations.startDate} >= ${targetWeekStart.toISOString()} and ${registrations.startDate} <= ${targetWeekEnd.toISOString()})::int`,
                activePeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${activeStartDate.toISOString()} and ${registrations.createdAt} <= ${activeEndDate.toISOString()})::int`,
                prevPeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${prevStartDate.toISOString()} and ${registrations.createdAt} <= ${prevEndDate.toISOString()})::int`
            }).from(registrations).where(
                and(
                    eq(registrations.organisationId, org.id),
                    registrationsCentreCondition
                )
            ),

            // Recent registrations preview
            db.select({
                childFirst: registrationChildren.submittedFirstName,
                childLast: registrationChildren.submittedLastName,
                submittedAt: registrations.submittedAt,
                startDate: registrations.startDate,
                status: registrations.status,
                registrationId: registrations.id,
            })
                .from(registrationChildren)
                .innerJoin(registrations, eq(registrations.id, registrationChildren.registrationId))
                .where(
                    and(
                        eq(registrations.organisationId, org.id),
                        registrationsCentreCondition,
                        gte(registrations.startDate, activeStartDate),
                        lte(registrations.startDate, activeEndDate)
                    )
                )
                .orderBy(asc(registrations.startDate), asc(registrationChildren.submittedFirstName))
                .limit(10),

            // All centres
            db.select().from(centres).where(eq(centres.organisationId, org.id)),

            // Capacity stats
            hasCentres
                ? db.select({
                    centreId: bookings.centreId,
                    centreName: centres.name,
                    day: sql<string>`date_trunc('day', ${bookings.startAt})`,
                    count: sql<number>`count(*)::int`
                })
                .from(bookings)
                .innerJoin(centres, eq(bookings.centreId, centres.id))
                .where(and(
                    bookingsCentreCondition,
                    gte(bookings.startAt, startOfDay(now)),
                    lt(bookings.startAt, endOfDay(addDays(now, 7))),
                    eq(bookings.status, 'confirmed')
                ))
                .groupBy(bookings.centreId, centres.name, sql`date_trunc('day', ${bookings.startAt})`)
                : Promise.resolve([]),

            // Growth
            db.select({
                weekStart: sql<string>`date_trunc('week', ${registrations.createdAt})`,
                count: sql<number>`count(*)::int`
            }).from(registrations)
            .where(
                and(
                    eq(registrations.organisationId, org.id),
                    registrationsCentreCondition,
                    gte(registrations.createdAt, subDays(now, 56))
                )
            )
            .groupBy(sql`date_trunc('week', ${registrations.createdAt})`).orderBy(asc(sql`date_trunc('week', ${registrations.createdAt})`)),

            // Status pipeline
            db.select({ status: registrations.status, count: sql<number>`count(*)::int` })
            .from(registrations).where(
                and(
                    eq(registrations.organisationId, org.id),
                    registrationsCentreCondition
                )
            ).groupBy(registrations.status),

            // Peak Day
            hasCentres
                ? db.select({
                    dow: sql<number>`EXTRACT(DOW FROM ${bookings.startAt})::int`,
                    count: sql<number>`count(*)::int`
                })
                .from(bookings)
                .where(
                    and(
                        bookingsCentreCondition,
                        gte(bookings.startAt, subDays(now, 30))
                    )
                )
                .groupBy(sql`EXTRACT(DOW FROM ${bookings.startAt})`).orderBy(desc(sql`count`)).limit(1)
                : Promise.resolve([])
        ]);

        dashboardData = {
            students: { total: Number(studentKpis.total), active: Number(studentKpis.activePeriod), prev: Number(studentKpis.prevPeriod) },
            bookings: { total: Number(bookingKpis.totalAll), month: Number(bookingKpis.thisMonth), week: Number(bookingKpis.thisWeek), active: Number(bookingKpis.activePeriod), prev: Number(bookingKpis.prevPeriod) },
            recentBookings,
            registrations: { total: Number(registrationKpis.total), pending: Number(registrationKpis.pending), month: Number(registrationKpis.thisMonth), week: Number(registrationKpis.thisWeek), active: Number(registrationKpis.activePeriod), prev: Number(registrationKpis.prevPeriod) },
            recentRegistrations,
            centresList,
            centreOccupancyData,
            weeklyRegistrations,
            registrationPipelineData,
            peakDayData
        };
    } catch (e) {
        console.error('CRITICAL: Dashboard Fetch Failure', e);
        // Fallback placeholder data to allow page to render partially
        dashboardData = {
            students: { total: 0, active: 0, prev: 0 },
            bookings: { total: 0, month: 0, week: 0, active: 0, prev: 0 },
            recentBookings: [],
            registrations: { total: 0, pending: 0, month: 0, week: 0, active: 0, prev: 0 },
            recentRegistrations: [],
            centresList: [],
            centreOccupancyData: [],
            weeklyRegistrations: [],
            registrationPipelineData: [],
            peakDayData: []
        };
    }

    // Assign variables back for the rest of the logic
    const { total: totalStudents, active: studentsActivePeriod, prev: studentsPrevPeriod } = dashboardData.students;
    const { total: totalBookingsAll, month: bookingsThisMonth, week: bookingsThisWeek, active: bookingsActivePeriod, prev: bookingsPrevPeriod } = dashboardData.bookings;
    const { recentBookings, recentRegistrations, centresList, centreOccupancyData, weeklyRegistrations, registrationPipelineData, peakDayData } = dashboardData;
    const { total: totalRegistrations, pending: pendingRegistrations, month: registrationsThisMonth, week: registrationsThisWeek, active: registrationsActivePeriod, prev: registrationsPrevPeriod } = dashboardData.registrations;

    // Deduplicate by booking ID — the query JOINs bookingAttendees so one booking
    // appears once per child attendee; we keep the first occurrence per booking.id
    const seenBookingIds = new Set<string>();
    const uniqueRecentBookings = (recentBookings as any[]).filter(b => {
        if (seenBookingIds.has(b.id)) return false;
        seenBookingIds.add(b.id);
        return true;
    });

    const recentBookingsChildIds = uniqueRecentBookings.map(b => b.childId);
    
    // Fetch medical and safeguarding notes with idiomatic Drizzle Relational API
    const safetyNotes = recentBookingsChildIds.length > 0 ? await db.query.studentNotes.findMany({
        where: (notes, { and, inArray }) => and(
            inArray(notes.childId, recentBookingsChildIds),
            inArray(notes.category, ['Medical', 'Safeguarding'])
        )
    }) : [];

    // Map to bookings
    const recentBookingsWithNotes = uniqueRecentBookings.map((b: any) => {
        const studentSafetyNotes = safetyNotes.filter(n => n.childId === b.childId);
        const medNotes = studentSafetyNotes.filter(n => n.category === 'Medical');
        const safeguardNotes = studentSafetyNotes.filter(n => n.category === 'Safeguarding');
        
        // Defensive handling of attendanceStats subquery result
        let stats = { total: 0, completed: 0 };
        try {
            if (b.attendanceStats) {
                const rawStats = typeof b.attendanceStats === 'string' ? JSON.parse(b.attendanceStats) : b.attendanceStats;
                stats = {
                    total: Number(rawStats?.total || 0),
                    completed: Number(rawStats?.completed || 0)
                };
            }
        } catch (e) {
            console.error('Failed to parse attendanceStats for booking:', b.id, e);
        }

        return {
            ...b,
            attendanceStats: stats, // Pre-processed stats
            hasMedicalNote: medNotes.length > 0,
            medicalNotesContent: medNotes.map(n => n.content).join('\n\n'),
            hasSafeguardingNote: safeguardNotes.length > 0,
            safeguardingNotesContent: safeguardNotes.map(n => n.content).join('\n\n')
        };
    });

    const registrationLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''}/r/${org.slug}`;

    const calculateTrend = (curr: any, prev: any) => {
        const current = Number(curr || 0);
        const previous = Number(prev || 0);
        if (current === 0 && previous === 0) return { diff: 0, text: "0%", type: 'neutral' as const };
        if (previous === 0) return { diff: current, text: `+${current}`, type: 'positive' as const };
        const perc = ((current - previous) / previous) * 100;
        const trendType: 'positive' | 'negative' | 'neutral' = perc > 0 ? 'positive' : perc < 0 ? 'negative' : 'neutral';
        return {
            diff: current - previous,
            text: perc > 0 ? `+${perc.toFixed(0)}%` : `${perc.toFixed(0)}%`,
            type: trendType
        };
    };

    const studentsTrend = calculateTrend(studentsActivePeriod, studentsPrevPeriod);
    const bookingsTrend = calculateTrend(bookingsActivePeriod, bookingsPrevPeriod);
    const registrationsTrend = calculateTrend(registrationsActivePeriod, registrationsPrevPeriod);

    const centresWithOccupancy = centresList
        .filter((c: any) => activeCentreId === 'all' || c.id === activeCentreId)
        .map((centre: any) => {
            const stats = centreOccupancyData.filter((d: any) => d.centreId === centre.id);
            const todayStats = stats.find((d: any) => isSameDay(new Date(d.day), now));
            return {
                ...centre,
                todayCount: Number(todayStats?.count || 0),
                forecast: stats.map((d: any) => ({ day: new Date(d.day), count: Number(d.count || 0) }))
            };
        });

    // Format Registration Pipeline
    const pipelineCounts = {
        new: Number(registrationPipelineData.find((d: any) => d.status === 'awaiting_confirmation')?.count || 0),
        review: 0, 
        approved: Number(registrationPipelineData.find((d: any) => d.status === 'signed_up')?.count || 0),
    };

    // Format Weekly Growth (last 8 weeks)
    const weeks = eachWeekOfInterval({
        start: subDays(now, 49),
        end: now
    }, { weekStartsOn: 1 });
    
    const growthStats = weeks.map(w => {
        const match = weeklyRegistrations.find((d: any) => isSameDay(new Date(d.weekStart), w));
        return Number(match?.count || 0);
    });

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const peakDayName = peakDayData[0] ? daysOfWeek[Math.round(Number(peakDayData[0].dow))] : null;

    // ── Onboarding checklist steps ────────────────────────────────────────────
    const onboardingSteps = [
        {
            id: 'org-info',
            label: 'Complete your organisation profile',
            description: 'Add your contact email, phone, and address in Settings.',
            href: '/dashboard/settings',
            done: !!(org.contactEmail && org.contactPhone),
        },
        {
            id: 'first-centre',
            label: 'Add your first centre',
            description: 'Set up a centre so you can receive registrations and bookings.',
            href: '/dashboard/centres/add',
            done: centresList.length > 0,
        },
        {
            id: 'registration-terms',
            label: 'Write your registration T&Cs',
            description: 'Parents will see these before signing the registration form.',
            href: '/dashboard/settings/registration',
            done: !!(org.registrationTerms),
        },
        {
            id: 'share-form',
            label: 'Share your registration link',
            description: 'Send the link to parents so they can register their children.',
            href: `/r/${org.slug}`,
            done: totalRegistrations > 0,
        },
        {
            id: 'first-booking',
            label: 'Create your first booking',
            description: 'Schedule an assessment or session for a student.',
            href: '/dashboard/bookings/new',
            done: totalBookingsAll > 0,
        },
    ];
    const onboardingAllDone = onboardingSteps.every(s => s.done);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight headline-lg">
                        Overview
                    </h1>
                    <p className="text-on-surface-variant body-md mt-2">
                        Welcome back{firstName ? `, ${firstName}` : ''}! 
                    </p>
                </div>
                <Suspense fallback={<div className="w-[180px] h-[44px] bg-surface-container-low rounded-xl animate-pulse" />}>
                    <DashboardFilter 
                        currentView={currentView}
                        currentDateIso={targetDate.toISOString()}
                        dateLabel={dateLabel}
                    />
                </Suspense>
            </div>

            {/* ── Onboarding checklist ─────────────────────────────────────── */}
            {!onboardingAllDone && (
                <OnboardingChecklist steps={onboardingSteps} />
            )}

            {/* ── Today's Snapshot ───────────────────────────────────── */}
            <TodaysSnapshot
                activeCentreId={activeCentreId}
                accessibleCentreIds={accessibleCentreIds}
            />

            {/* ── Top-level stats row ──────────────────────────────────── */}
            <KpiGrid
                studentsActive={studentsActivePeriod}
                studentsTotal={totalStudents}
                bookingsActive={bookingsActivePeriod}
                bookingsTotal={totalBookingsAll}
                registrationsActive={registrationsActivePeriod}
                registrationsTotal={totalRegistrations}
                pendingRegistrations={pendingRegistrations}
                studentsTrend={studentsTrend}
                bookingsTrend={bookingsTrend}
                registrationsTrend={registrationsTrend}
                growthStats={growthStats}
            />



            {/* ── Feature Module Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Registration Pipeline (NEW Placement) */}
                <div className="bg-surface-container-high p-8 rounded-[32px] border border-outline-variant/10 shadow-xl overflow-hidden relative group flex flex-col justify-between">
                    <div className="absolute -right-12 -top-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    <RegistrationFunnel data={pipelineCounts} />
                    <Link href="/dashboard/registrations" className="mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-low text-emerald-400 text-xs font-black hover:bg-surface-bright transition-colors border border-outline-variant/10 group/btn">
                        Manage Registration Pipeline <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                </div>

                {/* Left Column - Assessments */}
                {/* Assessments & Bookings */}
                <div className="bg-surface-container-high p-6 rounded-2xl border border-secondary/20 relative overflow-hidden group hover:border-secondary/40 transition-all flex flex-col gap-6">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-colors pointer-events-none"></div>
                    
                    <div className="flex items-start justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                                    <CalendarCheck className="w-6 h-6 text-secondary" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white text-lg leading-tight">Assessments & Bookings</h2>
                                    <p className="text-sm text-on-surface-variant font-medium mt-1">Manage schedules and attendance</p>
                                </div>
                            </div>
                            <span className="flex items-center gap-2 px-3 py-1 bg-secondary-container/20 text-secondary rounded-full border border-secondary/10 shadow-[0_0_12px_rgba(110,6,208,0.2)]">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-secondary animate-pulse"></span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:gap-4 relative z-10">
                            <div className="p-3 sm:p-4 bg-surface-container-low rounded-xl border border-outline-variant/10 flex flex-col justify-center hover:bg-surface-bright transition-all">
                                <p className="text-xl sm:text-2xl font-bold text-white">{totalBookingsAll}</p>
                                <p className="text-[10px] sm:text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider leading-tight">Total</p>
                            </div>
                            <div className="p-3 sm:p-4 bg-secondary/5 rounded-xl border border-secondary/10 flex flex-col justify-center hover:bg-secondary/10 transition-all">
                                <p className="text-xl sm:text-2xl font-bold text-secondary">{bookingsThisMonth}</p>
                                <p className="text-[10px] sm:text-xs text-secondary opacity-80 font-bold mt-1 uppercase tracking-wider leading-tight">Month</p>
                            </div>
                            <div className="p-3 sm:p-4 bg-secondary/10 rounded-xl border border-secondary/20 flex flex-col justify-center hover:bg-secondary/20 transition-all">
                                <p className="text-xl sm:text-2xl font-bold text-secondary">{bookingsThisWeek}</p>
                                <p className="text-[10px] sm:text-xs text-secondary opacity-80 font-bold mt-1 uppercase tracking-wider leading-tight">Week</p>
                            </div>
                        </div>

                        {/* Recent preview */}
                        <div className="flex flex-col flex-1 relative z-10">
                            <h3 className="text-xs font-bold text-on-surface-variant mb-4 uppercase tracking-wider">{currentView === 'weekly' ? 'Bookings This Week' : 'Bookings This Month'}</h3>
                            {recentBookingsWithNotes.length > 0 ? (
                                <div className="space-y-2">
                                    {recentBookingsWithNotes.map((b: any) => (
                                        <Link
                                            key={b.id}
                                            href={`/dashboard/bookings/${b.id}`}
                                            className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <AttendanceRadial 
                                                    percentage={b.attendanceStats.total > 0 ? (b.attendanceStats.completed / b.attendanceStats.total) * 100 : 0}
                                                    size="sm"
                                                >
                                                    <div className="w-full h-full bg-secondary/10 flex items-center justify-center text-secondary font-bold">
                                                        {b.childFirst[0]}{b.childLast[0]}
                                                    </div>
                                                </AttendanceRadial>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-white">{b.childFirst} {b.childLast}</p>
                                                        {(() => {
                                                            const resolved = resolveAttendanceStatus(
                                                                (b.attendanceStatus as AttendanceStatus | null) ?? null,
                                                                b.status
                                                            );
                                                            return (
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                                    getAttendanceColorClass(resolved.status),
                                                                    resolved.status === 'pending' ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'border-current/20'
                                                                )}>
                                                                    {resolved.label}
                                                                </span>
                                                            );
                                                        })()}
                                                        {b.hasMedicalNote && (
                                                            <div className="relative group/tooltip flex items-center outline-none">
                                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-error/10 border border-error/20 cursor-help shadow-[0_0_8px_rgba(255,113,108,0.2)]">
                                                                    <AlertTriangle className="w-3 h-3 text-error" />
                                                                </div>
                                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-surface-container-high border border-outline-variant/50 text-on-surface text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                    <div className="font-bold text-error mb-1 border-b border-outline-variant/50 pb-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/>Medical Alert</div>
                                                                    {b.medicalNotesContent}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-container-high"></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {b.hasSafeguardingNote && (
                                                            <div className="relative group/tooltip flex items-center outline-none">
                                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 border border-primary/20 cursor-help shadow-[0_0_8px_rgba(142,171,255,0.2)]">
                                                                    <Shield className="w-3 h-3 text-primary" />
                                                                </div>
                                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-surface-container-high border border-outline-variant/50 text-on-surface text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                    <div className="font-bold text-primary mb-1 border-b border-outline-variant/50 pb-1 flex items-center gap-1.5"><Shield className="w-3 h-3"/>Safeguarding Alert</div>
                                                                    {b.safeguardingNotesContent}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-container-high"></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-on-surface-variant font-medium mt-0.5">{b.centreName} · {b.startAt ? new Date(b.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-outline group-hover:text-secondary transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-on-surface-variant italic text-center py-6">No activity this {currentView === 'weekly' ? 'week' : 'month'}.</p>
                            )}
                        </div>

                        <Link
                            href="/dashboard/bookings"
                            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-low text-secondary text-sm font-bold hover:bg-surface-bright transition-colors border border-outline-variant/10 relative z-10"
                        >
                            View All Assessments <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                {/* Middle Column - Registrations */}
                {/* Registrations */}
                <div className="bg-surface-container-high p-6 rounded-2xl border border-primary/20 relative overflow-hidden group hover:border-primary/40 transition-all flex flex-col gap-6">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors pointer-events-none"></div>

                    <div className="flex items-start justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <ClipboardList className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white text-lg leading-tight">Registrations</h2>
                                    <p className="text-sm text-on-surface-variant font-medium mt-1">Student sign-ups</p>
                                </div>
                            </div>
                            <span className="flex items-center gap-2 px-3 py-1 bg-primary-container/20 text-primary rounded-full border border-primary/10 shadow-[0_0_12px_rgba(142,171,255,0.2)]">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:gap-4 relative z-10">
                            <div className="p-3 sm:p-4 bg-surface-container-low rounded-xl border border-outline-variant/10 flex flex-col justify-center hover:bg-surface-bright transition-all">
                                <p className="text-xl sm:text-2xl font-bold text-white">{totalRegistrations}</p>
                                <p className="text-[10px] sm:text-xs text-on-surface-variant font-bold mt-1 uppercase tracking-wider leading-tight">Total</p>
                            </div>
                            <div className="p-3 sm:p-4 bg-primary/5 rounded-xl border border-primary/10 flex flex-col justify-center hover:bg-primary/10 transition-all">
                                <p className="text-xl sm:text-2xl font-bold text-primary">{registrationsThisMonth}</p>
                                <p className="text-[10px] sm:text-xs text-primary opacity-80 font-bold mt-1 uppercase tracking-wider leading-tight">Month</p>
                            </div>
                            <div className="p-3 sm:p-4 bg-primary/10 rounded-xl border border-primary/20 flex flex-col justify-center hover:bg-primary/20 transition-all">
                                <p className="text-xl sm:text-2xl font-bold text-primary">{registrationsThisWeek}</p>
                                <p className="text-[10px] sm:text-xs text-primary opacity-80 font-bold mt-1 uppercase tracking-wider leading-tight">Week</p>
                            </div>
                        </div>

                        {/* Recent preview */}
                        <div className="flex flex-col flex-1 relative z-10">
                            <h3 className="text-xs font-bold text-on-surface-variant mb-4 uppercase tracking-wider">{currentView === 'weekly' ? 'Starts This Week' : 'Starts This Month'}</h3>
                            {recentRegistrations.length > 0 ? (
                                <div className="space-y-2">
                                    {recentRegistrations.map((r: any, i: any) => (
                                        <Link
                                            key={`${r.registrationId}-${i}`}
                                            href={`/dashboard/registrations/${r.registrationId}`}
                                            className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low hover:bg-surface-bright border border-outline-variant/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {r.childFirst[0]}{r.childLast[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-white">{r.childFirst} {r.childLast}</p>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                            r.status === 'awaiting_confirmation' ? 'bg-error-container/10 text-error border border-error/20' :
                                                            r.status === 'signed_up' ? 'bg-tertiary-container/10 text-tertiary border border-tertiary/20' :
                                                            'bg-neutral-800 text-neutral-400 border border-neutral-700'
                                                        }`}>
                                                            {r.status === 'awaiting_confirmation' ? 'Pending Review' : 
                                                             r.status === 'signed_up' ? 'Approved' : 'Pending'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                                                        Starts: {r.startDate ? new Date(r.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'TBD'}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-on-surface-variant italic text-center py-6">No activity this {currentView === 'weekly' ? 'week' : 'month'}.</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2 mt-2 relative z-10">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-primary uppercase tracking-wider">Public Link</p>
                                <p className="text-[10px] text-on-surface-variant">{registrationsThisMonth} new this month</p>
                            </div>
                            <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
                                <p className="text-xs text-white font-mono truncate">{registrationLink}</p>
                            </div>
                        </div>

                        <Link
                            href="/dashboard/registrations"
                            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-low text-primary text-sm font-bold hover:bg-surface-bright transition-colors border border-outline-variant/10 relative z-10"
                        >
                            View All Registrations <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>


            </div>
        </div>
    );
}
