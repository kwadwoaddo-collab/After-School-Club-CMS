import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { registrations, organisations, registrationParents, registrationChildren } from '@/db/schema';
import { eq, desc, and, inArray, or, ilike } from 'drizzle-orm';
import Link from 'next/link';
import { Suspense } from 'react';
import CopyRegistrationLink from '@/components/dashboard/CopyRegistrationLink';
import RegistrationsBulkClient from '@/components/dashboard/RegistrationsBulkClient';
import RegistrationsFilters from '@/components/registration/RegistrationsFilters';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { normalizeString } from '@/lib/search-params';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { FileText, Clock, CheckCircle2, AlertTriangle, Share2 } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
    awaiting_confirmation: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    signed_up: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    not_interested: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const STATUS_LABEL: Record<string, string> = {
    awaiting_confirmation: 'Awaiting Confirmation',
    signed_up: 'Signed Up',
    not_interested: 'Not Interested',
};

export default async function RegistrationsPage(props: {
    searchParams: Promise<{
        centre?: string;
        search?: string;
        status?: string;
    }>
}) {
    const rawSearchParams = await props.searchParams;
    const searchParams = {
        centre: Array.isArray(rawSearchParams.centre) ? rawSearchParams.centre[0] : rawSearchParams.centre,
        search: Array.isArray(rawSearchParams.search) ? rawSearchParams.search[0] : rawSearchParams.search,
        status: Array.isArray(rawSearchParams.status) ? rawSearchParams.status[0] : rawSearchParams.status,
    };

    const session = await auth();
    if (!session?.user) redirect('/login');

    const orgId = (session.user as any).organisationId;
    if (!orgId) redirect('/onboarding');

    // Fetch org slug for the registration link
    const [org] = await db
        .select({ slug: organisations.slug, name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';
    const registrationUrl = org ? `${baseUrl.replace(/^https?:\/\//, '')}/r/${org.slug}` : null;
    const fullRegistrationUrl = org ? `${baseUrl}/r/${org.slug}` : null;

    // Get accessible centres
    const orgCentres = await getUserAccessibleCentres(session.user.id);
    const centreIds = orgCentres.map(c => c.id);

    const activeCentreId = await resolveActiveCentreId(searchParams.centre, centreIds);

    // Fetch all registrations in the active centre to calculate counts
    const allActiveCentreRegistrations = await db.query.registrations.findMany({
        where: and(
            eq(registrations.organisationId, orgId),
            activeCentreId !== 'all'
                ? eq(registrations.centreId, activeCentreId)
                : centreIds.length > 0
                    ? inArray(registrations.centreId, centreIds)
                    : eq(registrations.centreId, 'unauthorized_centre_id')
        ),
        columns: {
            id: true,
            status: true,
        }
    });

    const totalCount = allActiveCentreRegistrations.length;
    const awaitingConfirmationCount = allActiveCentreRegistrations.filter(r => r.status === 'awaiting_confirmation').length;
    const signedUpCount = allActiveCentreRegistrations.filter(r => r.status === 'signed_up').length;
    const notInterestedCount = allActiveCentreRegistrations.filter(r => r.status === 'not_interested').length;

    let rows: any[] = [];
    let searchActiveAndNoResults = false;
    let matchingIds: string[] = [];

    if (searchParams.search) {
        const searchPattern = `%${searchParams.search}%`;
        try {
            const matchingRegistrations = await db
                .select({ id: registrations.id })
                .from(registrations)
                .leftJoin(registrationParents, eq(registrations.id, registrationParents.registrationId))
                .leftJoin(registrationChildren, eq(registrations.id, registrationChildren.registrationId))
                .where(
                    and(
                        eq(registrations.organisationId, orgId),
                        activeCentreId !== 'all'
                            ? eq(registrations.centreId, activeCentreId)
                            : centreIds.length > 0
                                ? inArray(registrations.centreId, centreIds)
                                : eq(registrations.centreId, 'unauthorized_centre_id'),
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
        } catch (error) {
            console.error('Failed to search registrations:', error);
            searchActiveAndNoResults = true;
        }
    }

    if (!searchActiveAndNoResults) {
        const conditions = [eq(registrations.organisationId, orgId)];

        if (activeCentreId !== 'all') {
            conditions.push(eq(registrations.centreId, activeCentreId));
        } else if (centreIds.length > 0) {
            conditions.push(inArray(registrations.centreId, centreIds));
        } else {
            conditions.push(eq(registrations.centreId, 'unauthorized_centre_id'));
        }

        if (searchParams.status && searchParams.status !== 'all') {
            conditions.push(eq(registrations.status, searchParams.status as any));
        }

        if (searchParams.search) {
            if (matchingIds.length > 0) {
                conditions.push(inArray(registrations.id, matchingIds));
            } else {
                conditions.push(eq(registrations.id, '00000000-0000-0000-0000-000000000000'));
            }
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
    const isFiltered = !!(
        searchParams.search ||
        (searchParams.status && searchParams.status !== 'all') ||
        activeCentreId !== 'all'
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Registrations</h1>
                    <p className="text-[#8c909f] font-medium mt-1">
                        {isFiltered
                            ? `Showing ${rows.length} of ${totalCount}`
                            : `${totalCount} total submission${totalCount !== 1 ? 's' : ''}`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {fullRegistrationUrl && (
                        <>
                            <Link
                                href="/dashboard/share"
                                className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 text-primary hover:text-blue-400 text-sm font-bold rounded-2xl transition-all border border-outline-variant/10 shadow-sm"
                            >
                                <Share2 className="w-4 h-4" />
                                Share Form
                            </Link>
                            <Link
                                href={fullRegistrationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Open Form
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* Segmented Status Tabs — Combines stats and filtering inside a single clean row */}
            <div className="flex bg-[#14161b]/60 p-1 rounded-2xl border border-outline-variant/10 self-start overflow-x-auto max-w-full scrollbar-none gap-1">
                {[
                    { value: 'all', label: 'All Registrations', count: totalCount },
                    { value: 'awaiting_confirmation', label: 'Awaiting Conf.', count: awaitingConfirmationCount, color: 'text-amber-400 bg-amber-500/10' },
                    { value: 'signed_up', label: 'Signed Up', count: signedUpCount, color: 'text-emerald-400 bg-emerald-500/10' },
                    { value: 'not_interested', label: 'Not Interested', count: notInterestedCount, color: 'text-red-400 bg-red-500/10' },
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
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 duration-150 ${
                                isActive
                                    ? 'bg-[#2a2d35] text-white shadow-lg border border-[#424754]/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none ${
                                isActive ? 'bg-primary text-white shadow-sm' : `${tab.color || 'bg-white/5 text-slate-400'}`
                            }`}>
                                {tab.count}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* Filters — sticky so it stays visible while scrolling through registrations */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-[#0d1117]/90 backdrop-blur-xl border-b border-white/5">
                <Suspense fallback={<div className="h-10 animate-pulse bg-slate-800/50 rounded-xl w-full" />}>
                    <RegistrationsFilters centres={orgCentres} resultsCount={rows.length} />
                </Suspense>
            </div>

            {/* Empty state or list */}
            {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center glassmorphic-card rounded-2xl border-dashed border-outline-variant/30 animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-3xl">📋</div>
                    <h3 className="text-white font-bold mb-2">
                        {isFiltered ? 'No matching registrations' : 'No registrations yet'}
                    </h3>
                    <p className="text-[#8c909f] text-sm max-w-sm mb-5">
                        {isFiltered 
                            ? 'Try adjusting or clearing your filters to find what you are looking for.' 
                            : 'Share your registration link with parents to start receiving submissions.'}
                    </p>
                    {!isFiltered && fullRegistrationUrl && (
                        <Link
                            href={fullRegistrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 text-primary hover:bg-white/10 text-sm font-bold rounded-2xl transition-all border border-outline-variant/10"
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
                />
            )}
        </div>
    );
}
