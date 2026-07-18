import { auth } from '@/lib/auth';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
    organisations, centres, parents, children,
    bookings, bookingAttendees, registrations, registrationChildren,
} from '@/db/schema';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { eq, desc, asc, sql, and, gte, lt, lte, inArray, or } from 'drizzle-orm';
import Link from 'next/link';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { AttendanceRadial } from '@/components/ui/AttendanceRadial';
import { CapacityIndicator } from '@/components/ui/CapacityIndicator';
import { LoadForecast } from '@/components/dashboard/LoadForecast';
import { DashboardFilter } from '@/components/dashboard/DashboardFilter';
import { Suspense } from 'react';
import { startOfDay, endOfDay, addDays, isSameDay, subDays, eachWeekOfInterval } from 'date-fns';
// RegistrationFunnel deprecated — replaced by inline JSX in Activity tab
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
import { AttendanceHeatmap } from '@/components/dashboard/AttendanceHeatmap';
import DashboardHero from '@/components/dashboard/DashboardHero';
import { SegmentedTabControl } from '@/components/dashboard/SegmentedTabControl';
import { CopyableLink } from '@/components/dashboard/CopyableLink';

export default async function DashboardPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const searchParams = await props.searchParams;
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    const hasCentres = accessibleCentreIds.length > 0;
    const activeCentreId = await resolveActiveCentreId(searchParams.centre, accessibleCentreIds);

    let org: any;
    let centresList: any[] = [];
    try {
        const [orgs, fetchedCentres] = await Promise.all([
            db
                .select({
                    id: organisations.id,
                    name: organisations.name,
                    slug: organisations.slug,
                    contactEmail: organisations.contactEmail,
                    contactPhone: organisations.contactPhone,
                    registrationTerms: organisations.registrationTerms,
                    brandColor: organisations.brandColor,
                    logoUrl: organisations.logoUrl,
                })
                .from(organisations)
                .where(eq(organisations.id, session.user.organisationId))
                .limit(1),
            db.select().from(centres).where(eq(centres.organisationId, session.user.organisationId))
        ]);
        org = orgs[0];
        centresList = fetchedCentres;
    } catch {
        throw new Error('Failed to load organisation data. Please try refreshing.');
    }
    if (!org) return redirect('/onboarding');
    const userRole = (session.user as any).role as string;
    const firstName = session.user.name?.split(' ')[0] || '';

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

    // Month and Week relative to the target date for the 3-column stats
    const targetMonthStart = startOfMonth(targetDate);
    const targetMonthEnd = endOfMonth(targetDate);
    const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const targetWeekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

    const dateLabel = currentView === 'weekly'
        ? `${format(activeStartDate, 'MMM d')} - ${format(activeEndDate, 'MMM d, yyyy')}`
        : format(activeStartDate, 'MMMM yyyy');

    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeTab = normalizeString(searchParams.tab) === 'activity' ? 'activity' : 'overview';

    // ── Conditionally Run DB Queries based on active tab ─────────────────────────────────
    let dashboardData: any = {
        students: { total: 0, active: 0, prev: 0 },
        bookings: { total: 0, month: 0, week: 0, active: 0, prev: 0 },
        recentBookings: [],
        registrations: { total: 0, pending: 0, month: 0, week: 0, active: 0, prev: 0 },
        recentRegistrations: [],
        weeklyRegistrations: [],
        registrationPipelineData: [],
    };

    try {
        if (activeTab === 'overview') {
            const [
                [studentKpis],
                [bookingKpis],
                [registrationKpis],
                weeklyRegistrations,
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

                // consolidated Registrations
                db.select({
                    total: sql<number>`count(*)::int`,
                    pending: sql<number>`count(*) filter (where ${registrations.status} = 'awaiting_confirmation')::int`,
                    thisMonth: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${targetMonthStart.toISOString()} and ${registrations.createdAt} <= ${targetMonthEnd.toISOString()})::int`,
                    thisWeek: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${targetWeekStart.toISOString()} and ${registrations.createdAt} <= ${targetWeekEnd.toISOString()})::int`,
                    activePeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${activeStartDate.toISOString()} and ${registrations.createdAt} <= ${activeEndDate.toISOString()})::int`,
                    prevPeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${prevStartDate.toISOString()} and ${registrations.createdAt} <= ${prevEndDate.toISOString()})::int`
                }).from(registrations).where(
                    and(
                        eq(registrations.organisationId, org.id),
                        registrationsCentreCondition
                    )
                ),

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
            ]);

            dashboardData = {
                ...dashboardData,
                students: { total: Number(studentKpis.total), active: Number(studentKpis.activePeriod), prev: Number(studentKpis.prevPeriod) },
                bookings: { total: Number(bookingKpis.totalAll), month: Number(bookingKpis.thisMonth), week: Number(bookingKpis.thisWeek), active: Number(bookingKpis.activePeriod), prev: Number(bookingKpis.prevPeriod) },
                registrations: { total: Number(registrationKpis.total), pending: Number(registrationKpis.pending), month: Number(registrationKpis.thisMonth), week: Number(registrationKpis.thisWeek), active: Number(registrationKpis.activePeriod), prev: Number(registrationKpis.prevPeriod) },
                weeklyRegistrations,
            };
        } else {
            const [
                recentBookings,
                recentRegistrations,
                registrationPipelineData,
                [registrationKpis],
                [bookingKpis],
            ] = await Promise.all([
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

                // Status pipeline
                db.select({ status: registrations.status, count: sql<number>`count(*)::int` })
                .from(registrations).where(
                    and(
                        eq(registrations.organisationId, org.id),
                        registrationsCentreCondition
                    )
                ).groupBy(registrations.status),

                // consolidated Registrations
                db.select({
                    total: sql<number>`count(*)::int`,
                    pending: sql<number>`count(*) filter (where ${registrations.status} = 'awaiting_confirmation')::int`,
                    thisMonth: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${targetMonthStart.toISOString()} and ${registrations.createdAt} <= ${targetMonthEnd.toISOString()})::int`,
                    thisWeek: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${targetWeekStart.toISOString()} and ${registrations.createdAt} <= ${targetWeekEnd.toISOString()})::int`,
                    activePeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${activeStartDate.toISOString()} and ${registrations.createdAt} <= ${activeEndDate.toISOString()})::int`,
                    prevPeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${prevStartDate.toISOString()} and ${registrations.createdAt} <= ${prevEndDate.toISOString()})::int`
                }).from(registrations).where(
                    and(
                        eq(registrations.organisationId, org.id),
                        registrationsCentreCondition
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
            ]);

            dashboardData = {
                ...dashboardData,
                recentBookings,
                recentRegistrations,
                registrationPipelineData,
                registrations: { total: Number(registrationKpis.total), pending: Number(registrationKpis.pending), month: Number(registrationKpis.thisMonth), week: Number(registrationKpis.thisWeek), active: Number(registrationKpis.activePeriod), prev: Number(registrationKpis.prevPeriod) },
                bookings: { total: Number(bookingKpis.totalAll), month: Number(bookingKpis.thisMonth), week: Number(bookingKpis.thisWeek), active: Number(bookingKpis.activePeriod), prev: Number(bookingKpis.prevPeriod) },
            };
        }
    } catch (e) {
        console.error('CRITICAL: Dashboard Fetch Failure', e);
    }

    // Assign variables back for the rest of the logic
    const { total: totalStudents, active: studentsActivePeriod, prev: studentsPrevPeriod } = dashboardData.students;
    const { total: totalBookingsAll, month: bookingsThisMonth, week: bookingsThisWeek, active: bookingsActivePeriod, prev: bookingsPrevPeriod } = dashboardData.bookings;
    const { recentBookings, recentRegistrations, weeklyRegistrations, registrationPipelineData } = dashboardData;
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
    const safetyNotes = (activeTab === 'activity' && recentBookingsChildIds.length > 0)
        ? await db.query.studentNotes.findMany({
            where: (notes, { and, inArray }) => and(
                inArray(notes.childId, recentBookingsChildIds),
                inArray(notes.category, ['Medical', 'Safeguarding'])
            )
        })
        : [];

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

    // Format Registration Pipeline — 2 meaningful stages (Pending Review → Approved)
    const pipelineCounts = {
        new: Number(registrationPipelineData.find((d: any) => d.status === 'awaiting_confirmation')?.count || 0),
        approved: Number(registrationPipelineData.find((d: any) => d.status === 'signed_up')?.count || 0),
    };

    // ── Activity Tab derived values ───────────────────────────────────────────
    const relativeTime = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '—';
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'in the future';
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 14) return '1 week ago';
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    };

    const pendingRate = totalRegistrations > 0
        ? Math.round((pipelineCounts.new / totalRegistrations) * 100)
        : 0;

    const approvalRate = (pipelineCounts.new + pipelineCounts.approved) > 0
        ? Math.round((pipelineCounts.approved / (pipelineCounts.new + pipelineCounts.approved)) * 100)
        : 0;

    const oldestPending = (recentRegistrations as any[])
        .filter((r: any) => r.status === 'awaiting_confirmation')
        .reduce((oldest: any, r: any) =>
            !oldest || new Date(r.submittedAt) < new Date(oldest.submittedAt) ? r : oldest
        , null);

    // Format Weekly Growth (last 8 weeks)
    const weeks = eachWeekOfInterval({
        start: subDays(now, 49),
        end: now
    }, { weekStartsOn: 1 });

    const growthStats = weeks.map(w => {
        const match = weeklyRegistrations.find((d: any) => isSameDay(new Date(d.weekStart), w));
        return Number(match?.count || 0);
    });

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
            href: '/dashboard/settings?tab=registration',
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
            description: 'Schedule a session for a student.',
            href: '/dashboard/bookings/new',
            done: totalBookingsAll > 0,
        },
    ];
    const onboardingAllDone = onboardingSteps.every(s => s.done);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">

            {/* ── Collapsible Sticky Welcome Banner Hero ───────────────────────── */}
            <DashboardHero firstName={firstName} orgName={org.name}>
                <Suspense fallback={<div role="status" className="w-auto min-w-[140px] h-[44px] bg-secondary rounded-xl animate-pulse" aria-label="Loading date filter" />}>
                    <DashboardFilter
                        currentView={currentView}
                        currentDateIso={targetDate.toISOString()}
                        dateLabel={dateLabel}
                    />
                </Suspense>
            </DashboardHero>

            {/* ── Apple Segmented Tab Switcher (Client — Optimistic Pill) ───── */}
            <SegmentedTabControl
                defaultTab={activeTab as 'overview' | 'activity'}
                searchParams={searchParams as Record<string, string | string[] | undefined>}
            />

            {activeTab === 'overview' ? (
                <div key="overview-tab" className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
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
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                            Period Summary — {dateLabel}
                        </p>
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
                    </div>
                </div>
            ) : (
                <div key="activity-tab" className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-2">

                    {/* ── Orientation header ────────────────────────────────────── */}
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            Activity — {dateLabel}
                        </p>
                        {pipelineCounts.new > 0 && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                                </span>
                                {pipelineCounts.new} pending review
                            </span>
                        )}
                    </div>

                    {/* ── Feature Module Cards ─────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* ── Card 1: Registration Funnel ──────────────────────── */}
                        <div className={cn(
                            "glassmorphic-card p-6 rounded-3xl relative overflow-hidden flex flex-col gap-6",
                            "transition-all duration-300 md:col-span-2 lg:col-span-1",
                            pipelineCounts.new > 0
                                ? "border border-amber-500/30 hover:border-amber-500/50"
                                : "border border-border hover:border-primary/30"
                        )}>
                            {/* Backdrop aura */}
                            <div className={cn(
                                "absolute -right-4 -top-4 w-32 h-32 rounded-full blur-3xl pointer-events-none transition-colors",
                                pipelineCounts.new > 0 ? "bg-amber-500/[0.08]" : "bg-primary/5"
                            )} />

                            {/* Header */}
                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        Registration Funnel
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                        Pipeline health
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-black text-muted-foreground tabular-nums">
                                    {totalRegistrations} total
                                </span>
                            </div>

                            {/* Vertical stepped funnel */}
                            <div className="flex flex-col items-center gap-0 relative z-10 w-full">

                                {/* Stage 1: Submitted (full width) */}
                                <div className="w-full">
                                    <div className="w-full rounded-xl p-4 border bg-secondary border-border transition-all duration-300">
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                                    Submitted
                                                </p>
                                                <p className="text-3xl font-black text-foreground tabular-nums leading-none mt-1">
                                                    {totalRegistrations}
                                                </p>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-medium">All time</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Connector 1→2 */}
                                <div className="flex flex-col items-center py-1.5 gap-1">
                                    <div className="w-px h-2 bg-border" />
                                    <span className="px-2.5 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-black text-muted-foreground tabular-nums">
                                        ↓{' '}
                                        {totalRegistrations > 0
                                            ? Math.round(((pipelineCounts.new + pipelineCounts.approved) / totalRegistrations) * 100)
                                            : 0}% active
                                    </span>
                                    <div className="w-px h-2 bg-border" />
                                </div>

                                {/* Stage 2: Pending Review (88% width) */}
                                <div className="w-[88%]">
                                    <div className={cn(
                                        "w-full rounded-xl p-4 border transition-all duration-300",
                                        pipelineCounts.new > 0
                                            ? "bg-amber-500/10 border-amber-500/30"
                                            : "bg-secondary border-border"
                                    )}>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                                                    pipelineCounts.new > 0
                                                        ? "text-amber-700 dark:text-amber-400"
                                                        : "text-muted-foreground"
                                                )}>
                                                    Pending Review
                                                    {pipelineCounts.new > 0 && (
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                                                        </span>
                                                    )}
                                                </p>
                                                <p className={cn(
                                                    "text-3xl font-black tabular-nums leading-none mt-1",
                                                    pipelineCounts.new > 0
                                                        ? "text-amber-700 dark:text-amber-400"
                                                        : "text-foreground"
                                                )}>
                                                    {pipelineCounts.new}
                                                </p>
                                            </div>
                                            {oldestPending && pipelineCounts.new > 0 && (
                                                <div className="text-right">
                                                    <p className="text-[10px] text-muted-foreground font-medium">Oldest</p>
                                                    <p className="text-xs font-black text-amber-700 dark:text-amber-400 tabular-nums">
                                                        {relativeTime(oldestPending.submittedAt)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Connector 2→3 */}
                                <div className="flex flex-col items-center py-1.5 gap-1">
                                    <div className="w-px h-2 bg-border" />
                                    <span className="px-2.5 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-black text-muted-foreground tabular-nums">
                                        ↓ {approvalRate}% approved
                                    </span>
                                    <div className="w-px h-2 bg-border" />
                                </div>

                                {/* Stage 3: Approved (72% width) */}
                                <div className="w-[72%]">
                                    <div className="w-full rounded-xl p-4 border bg-emerald-500/10 border-emerald-500/20 transition-all duration-300">
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                                                    Approved
                                                </p>
                                                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums leading-none mt-1">
                                                    {pipelineCounts.approved}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* CTA — urgency conditional */}
                            {pipelineCounts.new > 0 ? (
                                <Link
                                    href="/dashboard/registrations?status=awaiting_confirmation"
                                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-colors border border-amber-500/20 relative z-10 group/btn"
                                >
                                    Review {pipelineCounts.new} Pending
                                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                </Link>
                            ) : (
                                <Link
                                    href="/dashboard/registrations"
                                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-full bg-secondary text-muted-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors border border-border relative z-10 group/btn"
                                >
                                    View Pipeline
                                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                </Link>
                            )}
                        </div>

                        {/* ── Card 2: Sessions & Bookings ──────────────────────── */}
                        <div className={cn(
                            "glassmorphic-card p-6 rounded-3xl border border-border relative overflow-hidden",
                            "hover:border-violet-500/30 transition-all duration-300 flex flex-col gap-6"
                        )}>
                            {/* Subtle aura */}
                            <div className="absolute -right-4 -top-4 w-28 h-28 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

                            {/* Header */}
                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        Sessions &amp; Bookings
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                        {dateLabel}
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-black text-muted-foreground tabular-nums">
                                    {recentBookingsWithNotes.length} shown
                                </span>
                            </div>

                            {/* Week-on-week trend headline */}
                            <div className="flex items-end justify-between relative z-10 p-4 rounded-xl bg-secondary/40 border border-border">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        {currentView === 'weekly' ? 'This Week' : 'This Month'}
                                    </p>
                                    <p className="text-3xl font-black text-foreground tabular-nums leading-none mt-1">
                                        {currentView === 'weekly' ? bookingsThisWeek : bookingsThisMonth}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">bookings</p>
                                </div>
                                <div className="text-right">
                                    {bookingsTrend.type !== 'neutral' && (
                                        <div className={cn(
                                            "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                                            bookingsTrend.type === 'positive'
                                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                                : "bg-error/10 text-error border-error/20"
                                        )}>
                                            {bookingsTrend.type === 'positive'
                                                ? <ArrowUpRight className="w-3 h-3" />
                                                : <ArrowDownRight className="w-3 h-3" />
                                            }
                                            {bookingsTrend.text} vs last {currentView === 'weekly' ? 'week' : 'month'}
                                        </div>
                                    )}
                                    {bookingsTrend.type === 'neutral' && (
                                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-secondary text-muted-foreground border-border">
                                            <Minus className="w-3 h-3" />
                                            No change
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recent bookings list */}
                            <div className="flex flex-col flex-1 relative z-10">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Bookings: {dateLabel}</p>
                                {recentBookingsWithNotes.length > 0 ? (
                                    <div className="space-y-2">
                                        {recentBookingsWithNotes.map((b: any) => (
                                            <Link
                                                key={b.id}
                                                href={`/dashboard/bookings/${b.id}`}
                                                className="flex items-center justify-between p-3 rounded-xl bg-card hover:bg-secondary/60 border border-border transition-colors duration-150 active:scale-[0.99] cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <AttendanceRadial
                                                        percentage={b.attendanceStats.total > 0 ? (b.attendanceStats.completed / b.attendanceStats.total) * 100 : 0}
                                                        size="sm"
                                                        title={b.attendanceStats.total === 0
                                                            ? "No attendance data yet"
                                                            : `${b.attendanceStats.completed}/${b.attendanceStats.total} sessions attended`}
                                                    >
                                                        <div className="w-full h-full bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-xs">
                                                            {(b.childFirst || '')[0] || ''}{(b.childLast || '')[0] || ''}
                                                        </div>
                                                    </AttendanceRadial>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-foreground">{b.childFirst} {b.childLast}</p>
                                                            {(() => {
                                                                const resolved = resolveAttendanceStatus(
                                                                    (b.attendanceStatus as AttendanceStatus | null) ?? null,
                                                                    b.status
                                                                );
                                                                return (
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                                        getAttendanceColorClass(resolved.status),
                                                                        resolved.status === 'pending' ? 'bg-secondary text-muted-foreground border-border' : 'border-current/20'
                                                                    )}>
                                                                        {resolved.label}
                                                                    </span>
                                                                );
                                                            })()}
                                                            {b.hasMedicalNote && (
                                                                <div className="relative group/tooltip flex items-center outline-none">
                                                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-error/10 border border-error/20 cursor-help">
                                                                        <AlertTriangle className="w-3 h-3 text-error" />
                                                                    </div>
                                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                        <div className="font-bold text-error mb-1 border-b border-border pb-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/>Medical Alert</div>
                                                                        {b.medicalNotesContent}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {b.hasSafeguardingNote && (
                                                                <div className="relative group/tooltip flex items-center outline-none">
                                                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 border border-primary/20 cursor-help">
                                                                        <Shield className="w-3 h-3 text-primary" />
                                                                    </div>
                                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-popover border border-border text-foreground text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                        <div className="font-bold text-primary mb-1 border-b border-border pb-1 flex items-center gap-1.5"><Shield className="w-3 h-3"/>Safeguarding Alert</div>
                                                                        {b.safeguardingNotesContent}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                                            {b.startAt ? new Date(b.startAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                                                            {b.centreName ? ` · ${b.centreName}` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                                        <CalendarCheck className="w-8 h-8 text-muted-foreground/20" />
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">
                                                No bookings for this period
                                            </p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">
                                                Schedule a session to see it here
                                            </p>
                                        </div>
                                        <Link
                                            href="/dashboard/bookings/new"
                                            className="mt-1 text-xs font-semibold text-primary hover:underline"
                                        >
                                            Create a booking →
                                        </Link>
                                    </div>
                                )}
                            </div>

                            <Link
                                href="/dashboard/bookings"
                                className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-full bg-secondary text-muted-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors border border-border relative z-10 group/btn"
                            >
                                View All Bookings <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                        </div>

                        {/* ── Card 3: Registrations Feed ─────────────────────────── */}
                        <div className={cn(
                            "glassmorphic-card p-6 rounded-3xl border border-border relative overflow-hidden",
                            "hover:border-primary/30 transition-all duration-300 flex flex-col gap-6"
                        )}>
                            {/* Subtle backdrop */}
                            <div className="absolute -right-4 -top-4 w-28 h-28 bg-primary/[0.04] rounded-full blur-3xl pointer-events-none" />

                            {/* Header */}
                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        Registrations
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                        {dateLabel}
                                    </p>
                                </div>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-black tabular-nums border",
                                    pipelineCounts.new > 0
                                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                        : "bg-secondary text-muted-foreground border-border"
                                )}>
                                    {recentRegistrations.length} shown
                                </span>
                            </div>

                            {/* Recent registrations list */}
                            <div className="flex flex-col flex-1 relative z-10">
                                {recentRegistrations.length > 0 ? (
                                    <div className="space-y-2">
                                        {recentRegistrations.map((r: any, i: any) => (
                                            <Link
                                                key={`${r.registrationId}-${i}`}
                                                href={`/dashboard/registrations/${r.registrationId}`}
                                                className="flex items-center justify-between p-3 rounded-xl bg-card hover:bg-secondary/60 border border-border transition-colors duration-150 active:scale-[0.99] cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">
                                                        {(r.childFirst || '')[0] || ''}{(r.childLast || '')[0] || ''}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-bold text-foreground">{r.childFirst} {r.childLast}</p>
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                                r.status === 'awaiting_confirmation'
                                                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                                                    : r.status === 'signed_up'
                                                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                                                    : "bg-secondary text-muted-foreground border-border"
                                                            )}>
                                                                {r.status === 'awaiting_confirmation' ? 'Pending' :
                                                                 r.status === 'signed_up' ? 'Approved' : 'Other'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                                            Submitted {r.submittedAt ? relativeTime(r.submittedAt) : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                                        <ClipboardList className="w-8 h-8 text-muted-foreground/20" />
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">
                                                No registrations for this period
                                            </p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">
                                                Share your registration link to get started
                                            </p>
                                        </div>
                                        <Link
                                            href={registrationLink}
                                            className="mt-1 text-xs font-semibold text-primary hover:underline"
                                        >
                                            Open registration form →
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Public link section */}
                            <div className="flex flex-col gap-2 relative z-10">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    Public Registration Link
                                </p>
                                <CopyableLink link={registrationLink} />
                            </div>

                            <Link
                                href="/dashboard/registrations"
                                className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-full bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors border border-primary/20 relative z-10 group/btn"
                            >
                                View All Registrations <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
