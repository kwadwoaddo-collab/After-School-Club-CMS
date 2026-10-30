import { parseSummaryRange, summaryRangeSql } from '@/features/dashboard/summary-links';
import SummaryRangeNotice from '@/features/dashboard/SummaryRangeNotice';
import JoiningJourneyGuide from '@/features/students/components/JoiningJourneyGuide';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { registrations, organisations, registrationParents, registrationChildren } from '@/db/schema';
import { eq, desc, and, inArray, or, ilike, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Suspense } from 'react';
import RegistrationsBulkClient from '@/components/dashboard/RegistrationsBulkClient';
import RegistrationsFilters from '@/features/registration/components/RegistrationsFilters';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { Building2, Share2 } from 'lucide-react';
import HeaderPortal from '@/components/dashboard/HeaderPortal';

const STATUS_BADGE: Record<string, string> = {
    awaiting_confirmation: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
    signed_up: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
    not_interested: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
};

const STATUS_LABEL: Record<string, string> = {
    awaiting_confirmation: 'Form received — awaiting confirmation',
    signed_up: 'Joining confirmed',
    not_interested: 'Not Interested',
};

export default async function RegistrationsPage(props: {
    searchParams: Promise<{
        centre?: string;
        summaryFrom?: string;
        summaryTo?: string;
        search?: string;
        status?: string;
    }>
}) {
    const rawSearchParams = await props.searchParams;
    const summaryRange = parseSummaryRange(rawSearchParams.summaryFrom, rawSearchParams.summaryTo);
    const searchParams = {
        centre: Array.isArray(rawSearchParams.centre) ? rawSearchParams.centre[0] : rawSearchParams.centre,
        search: Array.isArray(rawSearchParams.search) ? rawSearchParams.search[0] : rawSearchParams.search,
        status: Array.isArray(rawSearchParams.status) ? rawSearchParams.status[0] : rawSearchParams.status,
    };

    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    const orgId = (session.user as any).organisationId;

    let hasError = false;
    let org: any = null;
    let orgCentres: any[] = [];
    let centreIds: string[] = [];
    let activeCentreId = 'all';
    let statusCountsAgg: any[] = [];
    let awaitingConfirmationCount = 0;
    let signedUpCount = 0;
    let notInterestedCount = 0;
    let totalCount = 0;
    let rows: unknown[] = [];
    let searchActiveAndNoResults = false;
    let matchingIds: string[] = [];
    let fullRegistrationUrl: string | null = null;

    try {
        // Fetch org slug and accessible centres concurrently
        const [[fetchedOrg], fetchedCentres] = await Promise.all([
            db
                .select({ slug: organisations.slug, name: organisations.name })
                .from(organisations)
                .where(eq(organisations.id, orgId))
                .limit(1),
            getUserAccessibleCentres(session.user.id),
        ]);
        org = fetchedOrg;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';

        orgCentres = fetchedCentres;
        centreIds = orgCentres.map(c => c.id);

        activeCentreId = await resolveActiveCentreId(searchParams.centre, centreIds);
        const activeCentreObj = activeCentreId !== 'all'
            ? orgCentres.find(c => c.id === activeCentreId)
            : null;
        fullRegistrationUrl = org
            ? activeCentreObj?.slug
                ? `${baseUrl}/register/${org.slug}/${activeCentreObj.slug}`
                : `${baseUrl}/register/${org.slug}`
            : null;

        const centreScopeCondition = activeCentreId !== 'all'
            ? eq(registrations.centreId, activeCentreId)
            : centreIds.length > 0
                ? inArray(registrations.centreId, centreIds)
                : eq(registrations.centreId, 'unauthorized_centre_id');

        // Fetch status counts via aggregation
        const aggWhere = and(
            eq(registrations.organisationId, orgId),
            summaryRangeSql(registrations.createdAt, summaryRange),
            centreScopeCondition
        );

        statusCountsAgg = await db.select({
            status: registrations.status,
            count: sql<number>`count(*)::int`
        })
        .from(registrations)
        .where(aggWhere)
        .groupBy(registrations.status);

        awaitingConfirmationCount = statusCountsAgg.find(s => s.status === 'awaiting_confirmation')?.count || 0;
        signedUpCount = statusCountsAgg.find(s => s.status === 'signed_up')?.count || 0;
        notInterestedCount = statusCountsAgg.find(s => s.status === 'not_interested')?.count || 0;
        totalCount = statusCountsAgg.reduce((sum, s) => sum + s.count, 0);

        if (searchParams.search) {
            const searchPattern = `%${searchParams.search}%`;
            const matchingRegistrations = await db
                .select({ id: registrations.id })
                .from(registrations)
                .leftJoin(registrationParents, eq(registrations.id, registrationParents.registrationId))
                .leftJoin(registrationChildren, eq(registrations.id, registrationChildren.registrationId))
                .where(
                    and(
                        eq(registrations.organisationId, orgId),
                        centreScopeCondition,
                        or(
                            ilike(registrationParents.submittedFirstName, searchPattern),
                            ilike(registrationParents.submittedLastName, searchPattern),
                            ilike(registrationParents.submittedEmail, searchPattern),
                            ilike(registrationParents.submittedPhone, searchPattern),
                            ilike(registrationChildren.submittedFirstName, searchPattern),
                            ilike(registrationChildren.submittedLastName, searchPattern)
                        )
                    )
                );
            matchingIds = matchingRegistrations.map(mr => mr.id);
            if (matchingIds.length === 0) {
                searchActiveAndNoResults = true;
            }
        }

        if (!searchActiveAndNoResults) {
            const conditions = [eq(registrations.organisationId, orgId)];
            const periodCondition = summaryRangeSql(registrations.createdAt, summaryRange);
            if (periodCondition) conditions.push(periodCondition);

            conditions.push(centreScopeCondition);

            if (searchParams.status && searchParams.status !== 'all') {
                conditions.push(eq(registrations.status, searchParams.status as any));
            }

            if (searchParams.search && matchingIds.length > 0) {
                conditions.push(inArray(registrations.id, matchingIds));
            }

            // Use relational query to fetch all registration data in ONE trip
            rows = await db.query.registrations.findMany({
                where: and(...conditions),
                with: {
                    registrationChildren: true,
                    registrationParents: true,
                },
                orderBy: [desc(registrations.createdAt)],
            });
        }
    } catch (e: any) {
        logger.error("Error fetching registrations", e);
        hasError = true;
    }

    const isFiltered = !!(
        searchParams.search ||
        (searchParams.status && searchParams.status !== 'all') ||
        activeCentreId !== 'all'
    );

    const activeCentreName = activeCentreId !== 'all'
        ? orgCentres.find(c => c.id === activeCentreId)?.name ?? null
        : null;

    return (
        <div className="space-y-4 animate-in fade-in duration-700">
            <JoiningJourneyGuide />
            {/* Header Portals — Fuses page header into the global header bar */}
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">Registrations</h1>
                    <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground text-[10px] font-bold">
                        {isFiltered ? `${rows.length} of ${totalCount}` : totalCount}
                    </span>
                    {activeCentreName && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                            <Building2 className="w-3 h-3" />
                            {activeCentreName}
                        </span>
                    )}
                </div>
            </HeaderPortal>

            <HeaderPortal targetId="header-middle">
                {/* Segmented Status Tabs */}
                <div className="flex bg-secondary/60 p-1 rounded-2xl border border-border self-start overflow-x-auto max-w-full scrollbar-none gap-1">
                    {[
                        { value: 'all', label: 'All', count: totalCount },
                        { value: 'awaiting_confirmation', label: 'Awaiting confirmation', count: awaitingConfirmationCount, color: 'text-warning bg-warning/10' },
                        { value: 'signed_up', label: 'Joining confirmed', count: signedUpCount, color: 'text-success bg-success/10' },
                        { value: 'not_interested', label: 'Not Interested', count: notInterestedCount, color: 'text-destructive bg-destructive/10' },
                    ].map((tab) => {
                        const isActive = (searchParams.status || 'all') === tab.value;
                        const query = new URLSearchParams();
                        if (searchParams.search) query.set('search', searchParams.search);
                        if (searchParams.centre) query.set('centre', searchParams.centre);
                        if (tab.value !== 'all') query.set('status', tab.value);
                        
                        const href = `/dashboard/registrations${query.toString() ? `?${query.toString()}` : ''}`;
                        
                        return (
                            <Link
                                key={tab.value}
                                href={href}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 duration-150 ${
                                    isActive
                                        ? 'bg-card text-foreground shadow-sm border border-border'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none ${
                                    isActive ? 'bg-primary text-white shadow-sm' : `${tab.color || 'bg-secondary text-muted-foreground'}`
                                }`}>
                                    {tab.count}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </HeaderPortal>

            {fullRegistrationUrl && (
                <HeaderPortal targetId="header-right-actions">
                    <Link
                        href="/dashboard/share"
                        className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold rounded-xl transition-all border border-border shadow-sm active:scale-95 duration-100"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                    </Link>
                    <Link
                        href={fullRegistrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-primary rounded-xl text-xs font-bold text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 active:scale-95 duration-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Form
                    </Link>
                </HeaderPortal>
            )}

            {/* Filters — sticky */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-xl border-b border-border">
                <SummaryRangeNotice range={summaryRange} basis="Registration forms received" clearHref={`/dashboard/registrations?${new URLSearchParams(Object.entries(searchParams).filter(([key,value]) => typeof value === 'string') as [string,string][])}`}/>
            <Suspense fallback={<div className="h-10 animate-pulse bg-slate-800/50 rounded-xl w-full" />}>
                    <RegistrationsFilters centres={orgCentres} resultsCount={rows.length} />
                </Suspense>
            </div>

            {/* Empty state or list */}
            {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-2xl animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 text-3xl">📋</div>
                    <h3 className="text-foreground font-bold mb-2">
                        {isFiltered ? 'No matching registrations' : 'No registrations yet'}
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-sm mb-5">
                        {isFiltered 
                            ? 'Try adjusting or clearing your filters to find what you are looking for.' 
                            : 'Share your registration link with parents to start receiving submissions.'}
                    </p>
                    {!isFiltered && fullRegistrationUrl && (
                        <Link
                            href={fullRegistrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-primary hover:bg-secondary/80 text-sm font-bold rounded-2xl transition-all border border-border"
                        >
                            Open Registration Form ↗
                        </Link>
                    )}
                </div>
            ) : (
                <RegistrationsBulkClient
                    rows={rows as any}
                    statusBadge={STATUS_BADGE}
                    statusLabel={STATUS_LABEL}
                    centres={orgCentres}
                    isFiltered={isFiltered}
                    totalCount={totalCount}
                    error={hasError}
                    userRole={(session.user as any).role}
                />
            )}
        </div>
    );
}
