import TodayWork from './_components/TodayWork';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck, Monitor, CalendarPlus, UserPlus, Receipt, Share2 } from 'lucide-react';
import { db } from '@/db';
import { organisations, centres, registrations, bookings, children, staffInvites } from '@/db/schema';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { eq, sql, inArray, or, count } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { Suspense } from 'react';
import { normalizeString, normalizeDate } from '@/lib/search-params';
import DashboardHero from '@/components/dashboard/DashboardHero';
import { DashboardFilter } from '@/components/dashboard/DashboardFilter';
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist';
import WelcomeModal from '@/components/dashboard/WelcomeModal';
import DashboardKpisWidget from './_components/DashboardKpis';
import DashboardSchedule from './_components/DashboardSchedule';
import ActivityTab from './_components/ActivityTab';
import { OverviewSkeleton, ActivitySkeleton } from './_components/DashboardSkeletons';
import { RevenueWidget } from '@/components/dashboard/RevenueWidget';
import { parseISO, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';

export default async function DashboardPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const searchParams = await props.searchParams;
    const session = await requireTenantSession();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = (session.user as any).role as string;
    const isOwner = userRole === 'ORG_OWNER';

    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    const hasCentres = accessibleCentreIds.length > 0;
    const activeCentreId = await resolveActiveCentreId(searchParams.centre, accessibleCentreIds);

    let org: any;
    let centresList: unknown[] = [];
    try {
        const [orgs, fetchedCentres] = await Promise.all([
            db.select({
                id: organisations.id,
                name: organisations.name,
                slug: organisations.slug,
                subdomain: organisations.subdomain,
                contactEmail: organisations.contactEmail,
                contactPhone: organisations.contactPhone,
                registrationTerms: organisations.registrationTerms,
                brandColor: organisations.brandColor,
                logoUrl: organisations.logoUrl,
            }).from(organisations).where(eq(organisations.id, session.user.organisationId)).limit(1),
            db.select().from(centres).where(eq(centres.organisationId, session.user.organisationId))
        ]);
        org = orgs[0];
        centresList = fetchedCentres;
    } catch {
        throw new Error('Failed to load organisation data. Please try refreshing.');
    }
    if (!org) return redirect('/onboarding');
    const firstName = session.user.name?.split(' ')[0] || '';

    const typedCentres = centresList as { id: string; name: string }[];
    const selectedCentreObj = activeCentreId !== 'all'
        ? typedCentres.find(c => c.id === activeCentreId)
        : (accessibleCentreIds.length === 1 ? typedCentres.find(c => c.id === accessibleCentreIds[0]) : undefined);
    const isCombinedView = activeCentreId === 'all' && !selectedCentreObj && typedCentres.length > 1;
    const activeCentreDisplayName = selectedCentreObj?.name || (isCombinedView ? 'Combined View — All Centres' : org.name);
    const canManageOperations = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole);
    const canManageFinanceAndShare = ['ORG_OWNER', 'MANAGER'].includes(userRole);

    const now = new Date();
    const targetDateStr = normalizeDate(searchParams.date);
    const targetDate = targetDateStr ? parseISO(targetDateStr) : now;
    const currentView = normalizeString(searchParams.view) === 'monthly' ? 'monthly' : 'weekly';

    const activeStartDate = currentView === 'weekly' ? startOfWeek(targetDate, { weekStartsOn: 1 }) : startOfMonth(targetDate);
    const activeEndDate = currentView === 'weekly' ? endOfWeek(targetDate, { weekStartsOn: 1 }) : endOfMonth(targetDate);

    const prevTargetDate = currentView === 'weekly' ? subWeeks(targetDate, 1) : subMonths(targetDate, 1);
    const prevStartDate = currentView === 'weekly' ? startOfWeek(prevTargetDate, { weekStartsOn: 1 }) : startOfMonth(prevTargetDate);
    const prevEndDate = currentView === 'weekly' ? endOfWeek(prevTargetDate, { weekStartsOn: 1 }) : endOfMonth(prevTargetDate);

    const targetMonthStart = startOfMonth(targetDate);
    const targetMonthEnd = endOfMonth(targetDate);
    const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const targetWeekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

    const dateLabel = currentView === 'weekly'
        ? `${format(activeStartDate, 'MMM d')} - ${format(activeEndDate, 'MMM d, yyyy')}`
        : format(activeStartDate, 'MMMM yyyy');

    const [{ totalRegistrations }, { totalBookingsAll }, { staffInviteCount }] = await Promise.all([
        db.select({ totalRegistrations: sql<number>`count(*)::int` }).from(registrations).where(eq(registrations.organisationId, org.id)).then(r => r[0]),
        hasCentres ? db.select({ totalBookingsAll: sql<number>`count(*)::int` }).from(bookings).where(inArray(bookings.centreId, accessibleCentreIds)).then(r => r[0]) : Promise.resolve({ totalBookingsAll: 0 }),
        db.select({ staffInviteCount: sql<number>`count(*)::int` }).from(staffInvites).where(eq(staffInvites.organisationId, org.id)).then(r => r[0]),
    ]);

    const onboardingSteps = [
        { id: 'org-info', label: 'Complete your organisation profile', description: 'Add your contact email, phone, and address in Settings.', href: '/dashboard/settings', done: !!(org.contactEmail && org.contactPhone) },
        { id: 'first-centre', label: 'Add your first centre', description: 'Set up a centre so you can receive registrations and bookings.', href: '/dashboard/centres/add', done: centresList.length > 0 },
        { id: 'invite-staff', label: 'Invite your first staff member', description: 'Add your team so they can manage bookings and attendance.', href: '/dashboard/staff/invite', done: staffInviteCount > 0 },
        { id: 'set-subdomain', label: 'Set your club subdomain', description: 'Give your club its own web address (e.g. yourclub.sprintscaleit.co.uk).', href: '/dashboard/settings', done: !!org.subdomain },
        { id: 'registration-terms', label: 'Write your registration T&Cs', description: 'Parents will see these before signing the registration form.', href: '/dashboard/settings?tab=registration', done: !!(org.registrationTerms) },
        { id: 'share-form', label: 'Share your registration link', description: 'Send the link to parents so they can register their children.', href: `/r/${org.slug}`, done: totalRegistrations > 0 },
        { id: 'first-booking', label: 'Create your first booking', description: 'Schedule a session for a student.', href: '/dashboard/bookings/new', done: totalBookingsAll > 0 },
    ];
    const onboardingAllDone = onboardingSteps.every(s => s.done);
    const completedCount = onboardingSteps.filter(s => s.done).length;

    const childrenCentreCondition = activeCentreId !== 'all' ? eq(children.centreId, activeCentreId) : (hasCentres ? or(inArray(children.centreId, accessibleCentreIds), sql`${children.centreId} IS NULL`) : sql`false`);
    const bookingsCentreCondition = activeCentreId !== 'all' ? eq(bookings.centreId, activeCentreId) : (hasCentres ? inArray(bookings.centreId, accessibleCentreIds) : sql`false`);
    const registrationsCentreCondition = activeCentreId !== 'all' ? eq(registrations.centreId, activeCentreId) : (hasCentres ? inArray(registrations.centreId, accessibleCentreIds) : sql`false`);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <DashboardHero
                firstName={firstName}
                orgName={org.name}
                centreName={activeCentreDisplayName}
                isCombinedView={isCombinedView}
            >
                <Suspense fallback={<div role="status" className="w-auto min-w-[140px] h-[44px] bg-secondary rounded-xl animate-pulse" aria-label="Loading date filter" />}>
                    <DashboardFilter currentView={currentView} currentDateIso={targetDate.toISOString()} dateLabel={dateLabel} />
                </Suspense>
            </DashboardHero>

            {/* Quick Actions Bar — direct 1-click access to high-frequency daily club tasks */}
            <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2">
                <Link
                    href="/dashboard/attendance"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-accent text-white text-xs sm:text-sm font-medium hover:bg-accent-hover transition-colors shadow-xs"
                >
                    <ClipboardCheck className="size-4 flex-shrink-0" aria-hidden="true" />
                    <span>Take Roll Call</span>
                </Link>
                <Link
                    href="/dashboard/kiosk"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-border bg-surface text-text hover:bg-page text-xs sm:text-sm font-medium transition-colors"
                >
                    <Monitor className="size-4 text-accent flex-shrink-0" aria-hidden="true" />
                    <span>Launch Kiosk</span>
                </Link>
                {canManageOperations && (
                    <>
                        <Link
                            href="/dashboard/bookings/new"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-border bg-surface text-text hover:bg-page text-xs sm:text-sm font-medium transition-colors"
                        >
                            <CalendarPlus className="size-4 text-accent flex-shrink-0" aria-hidden="true" />
                            <span>New Booking</span>
                        </Link>
                        <Link
                            href="/dashboard/students/add"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-border bg-surface text-text hover:bg-page text-xs sm:text-sm font-medium transition-colors"
                        >
                            <UserPlus className="size-4 text-accent flex-shrink-0" aria-hidden="true" />
                            <span>Add Student</span>
                        </Link>
                    </>
                )}
                {canManageFinanceAndShare && (
                    <>
                        <Link
                            href="/dashboard/finance/receipt"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-border bg-surface text-text hover:bg-page text-xs sm:text-sm font-medium transition-colors"
                        >
                            <Receipt className="size-4 text-accent flex-shrink-0" aria-hidden="true" />
                            <span>Create Receipt</span>
                        </Link>
                        <Link
                            href="/dashboard/share"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-border bg-surface text-text hover:bg-page text-xs sm:text-sm font-medium transition-colors"
                        >
                            <Share2 className="size-4 text-accent flex-shrink-0" aria-hidden="true" />
                            <span>Share Centre Links</span>
                        </Link>
                    </>
                )}
            </nav>

            {/* First-time welcome modal — only shown to ORG_OWNER when nothing is done yet.
                Non-owner staff cannot complete these setup steps (Settings/Centres/Staff
                are owner-only), so showing the modal to them would be confusing. */}
            {isOwner && completedCount === 0 && <WelcomeModal orgName={org.name} ownerName={firstName} />}

            {/* U-4 (Milestone 3M): Onboarding checklist gated to ORG_OWNER only.
                MANAGER/FRONT_DESK/TUTOR cannot complete onboarding steps. */}
            {isOwner && !onboardingAllDone && <OnboardingChecklist steps={onboardingSteps} completedCount={completedCount} />}

            <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Checking today’s work…</p>}>
                <TodayWork orgId={org.id} centreIds={accessibleCentreIds} centreId={activeCentreId} centreName={selectedCentreObj?.name} role={userRole}/>
            </Suspense>

            <Suspense fallback={<OverviewSkeleton />}>
                <DashboardKpisWidget activeCentreId={activeCentreId} userRole={userRole}
                    orgId={org.id} 
                    childrenCentreCondition={childrenCentreCondition}
                    bookingsCentreCondition={bookingsCentreCondition}
                    registrationsCentreCondition={registrationsCentreCondition}
                    hasCentres={hasCentres}
                    activeStartDate={activeStartDate} activeEndDate={activeEndDate}
                    prevStartDate={prevStartDate} prevEndDate={prevEndDate}
                    targetMonthStart={targetMonthStart} targetMonthEnd={targetMonthEnd}
                    targetWeekStart={targetWeekStart} targetWeekEnd={targetWeekEnd}
                    now={now}
                />
            </Suspense>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                    <Suspense fallback={<OverviewSkeleton />}>
                        {/* D2 (Milestone 3M): pass accessibleCentreIds+hasCentres so the schedule
                            respects the user's centre restriction, not org-wide access. */}
                        <DashboardSchedule org={org} activeCentreId={activeCentreId} accessibleCentreIds={accessibleCentreIds} hasCentres={hasCentres} />
                    </Suspense>
                </div>
                <div className="lg:col-span-2">
                    <Suspense fallback={<ActivitySkeleton />}>
                        <ActivityTab searchParams={searchParams as any} org={org} activeCentreId={activeCentreId} accessibleCentreIds={accessibleCentreIds} hasCentres={hasCentres} isFeedOnly={true} />
                    </Suspense>
                </div>
            </div>

            <div className="mt-8 space-y-8">
                {/* D3 (Milestone 3M): Finance data is gated to ORG_OWNER on the Finance page.
                    Showing it on the dashboard to TUTOR/FRONT_DESK/MANAGER was inconsistent.
                    RevenueWidget is now rendered only for ORG_OWNER. */}
                {isOwner && (
                    <Suspense fallback={<OverviewSkeleton />}>
                        <RevenueWidget organisationId={org.id} />
                    </Suspense>
                )}
                
                <Suspense fallback={<ActivitySkeleton />}>
                    <ActivityTab searchParams={searchParams as any} org={org} activeCentreId={activeCentreId} accessibleCentreIds={accessibleCentreIds} hasCentres={hasCentres} isFunnelOnly={true} />
                </Suspense>
            </div>
        </div>
    );
}
