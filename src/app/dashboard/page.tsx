import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres, registrations, bookings } from '@/db/schema';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { eq, sql, inArray } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { Suspense } from 'react';
import { normalizeString, normalizeDate } from '@/lib/search-params';
import DashboardHero from '@/components/dashboard/DashboardHero';
import { DashboardFilter } from '@/components/dashboard/DashboardFilter';
import { SegmentedTabControl } from '@/components/dashboard/SegmentedTabControl';
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist';
import OverviewTab from './_components/OverviewTab';
import ActivityTab from './_components/ActivityTab';
import { OverviewSkeleton, ActivitySkeleton } from './_components/DashboardSkeletons';
import { parseISO, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

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
    const firstName = session.user.name?.split(' ')[0] || '';

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

    const dateLabel = currentView === 'weekly'
        ? `${format(activeStartDate, 'MMM d')} - ${format(activeEndDate, 'MMM d, yyyy')}`
        : format(activeStartDate, 'MMMM yyyy');

    const activeTab = normalizeString(searchParams.tab) === 'activity' ? 'activity' : 'overview';

    // Fast query for onboarding logic
    const [{ totalRegistrations }, { totalBookingsAll }] = await Promise.all([
        db.select({ totalRegistrations: sql<number>`count(*)::int` }).from(registrations).where(eq(registrations.organisationId, org.id)).then(r => r[0]),
        hasCentres ? db.select({ totalBookingsAll: sql<number>`count(*)::int` }).from(bookings).where(inArray(bookings.centreId, accessibleCentreIds)).then(r => r[0]) : Promise.resolve({ totalBookingsAll: 0 })
    ]);

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
            <DashboardHero firstName={firstName} orgName={org.name}>
                <Suspense fallback={<div role="status" className="w-auto min-w-[140px] h-[44px] bg-secondary rounded-xl animate-pulse" aria-label="Loading date filter" />}>
                    <DashboardFilter
                        currentView={currentView}
                        currentDateIso={targetDate.toISOString()}
                        dateLabel={dateLabel}
                    />
                </Suspense>
            </DashboardHero>

            <SegmentedTabControl
                defaultTab={activeTab as 'overview' | 'activity'}
                searchParams={searchParams as Record<string, string | string[] | undefined>}
            />

            {activeTab === 'overview' ? (
                <>
                    {!onboardingAllDone && (
                        <OnboardingChecklist steps={onboardingSteps} />
                    )}
                    <Suspense key="overview" fallback={<OverviewSkeleton />}>
                        <OverviewTab searchParams={searchParams as any} org={org} activeCentreId={activeCentreId} accessibleCentreIds={accessibleCentreIds} hasCentres={hasCentres} />
                    </Suspense>
                </>
            ) : (
                <Suspense key="activity" fallback={<ActivitySkeleton />}>
                    <ActivityTab searchParams={searchParams as any} org={org} activeCentreId={activeCentreId} accessibleCentreIds={accessibleCentreIds} hasCentres={hasCentres} />
                </Suspense>
            )}
        </div>
    );
}
