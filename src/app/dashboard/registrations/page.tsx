import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { registrations, organisations } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import Link from 'next/link';
import CopyRegistrationLink from '@/components/dashboard/CopyRegistrationLink';
import RegistrationItem from '@/components/dashboard/RegistrationItem';
import RegistrationsFilters from '@/components/registration/RegistrationsFilters';
import { getUserAccessibleCentres } from '@/lib/permissions';

const STATUS_BADGE: Record<string, string> = {
    awaiting_confirmation: 'bg-error-container/10 text-error border border-error/20',
    signed_up: 'bg-tertiary-container/10 text-tertiary border border-tertiary/20',
    not_interested: 'bg-neutral-800 text-neutral-400 border border-neutral-700',
};

const STATUS_LABEL: Record<string, string> = {
    awaiting_confirmation: 'Awaiting Confirmation',
    signed_up: 'Signed Up',
    not_interested: 'Not Interested',
};

export default async function RegistrationsPage(props: {
    searchParams: Promise<{
        centre?: string;
    }>
}) {
    const searchParams = await props.searchParams;
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

    const conditions = [eq(registrations.organisationId, orgId)];

    if (searchParams.centre && searchParams.centre !== 'all') {
        if (centreIds.includes(searchParams.centre as string)) {
            conditions.push(eq(registrations.centreId, searchParams.centre as string));
        } else {
            conditions.push(eq(registrations.centreId, 'unauthorized_centre_id'));
        }
    }

    // Use relational query to fetch all registration data in ONE trip
    const rows = await db.query.registrations.findMany({
        where: and(...conditions),
        with: {
            registrationChildren: true,
            registrationParents: true,
        },
        orderBy: [desc(registrations.createdAt)],
    });

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-white">Registrations</h1>
                    <p className="text-on-surface-variant text-sm mt-1">{rows.length} total submission{rows.length !== 1 ? 's' : ''}</p>
                </div>
                {fullRegistrationUrl && (
                    <Link
                        href={fullRegistrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Registration Form
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="bg-surface-container-high border border-outline-variant/10 shadow-xl rounded-3xl p-6 mb-6">
                <RegistrationsFilters centres={orgCentres} resultsCount={rows.length} />
            </div>

            {/* Registration link card */}
            {fullRegistrationUrl && registrationUrl && (
                <div className="mb-6 bg-surface-container-low border border-outline-variant/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Your Registration Link</p>
                        <p className="text-sm text-white font-mono truncate">{registrationUrl}</p>
                        <p className="text-xs text-on-surface-variant mt-1">Share this link with parents to let them register their children.</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <CopyRegistrationLink url={fullRegistrationUrl} />
                        <Link
                            href="/dashboard/settings/registration"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-container-high border border-outline-variant/20 text-on-surface hover:bg-surface-bright text-sm font-medium rounded-xl transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Edit T&amp;Cs
                        </Link>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/20">
                    <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 text-3xl">📋</div>
                    <h3 className="text-white font-semibold mb-2">No registrations yet</h3>
                    <p className="text-on-surface-variant text-sm max-w-sm mb-5">
                        Share your registration link with parents to start receiving submissions.
                    </p>
                    {fullRegistrationUrl && (
                        <Link
                            href={fullRegistrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                            Open Registration Form ↗
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {rows.map(r => (
                        <RegistrationItem 
                            key={r.id} 
                            registration={r as any} 
                            statusBadge={STATUS_BADGE} 
                            statusLabel={STATUS_LABEL} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
