import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AlertTriangle, Building2 } from 'lucide-react';
import CommunicationsClient from './CommunicationsClient';
import { getBroadcasts, getParentsForCentre, getClassesForCentre } from '@/features/communications/actions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/require-auth';

/**
 * Milestone 3H, C8: this page previously had no role restriction at all —
 * any authenticated org member (including FRONT_DESK/TUTOR) could view it,
 * and since sendBroadcast (the underlying server action) also had no role
 * check of its own (see C1/C8 in project-notes/
 * milestone-3h-communications-audit.md), effectively anyone could send an
 * organisation-wide broadcast. Restricted to ORG_OWNER/MANAGER, matching
 * this codebase's one existing sibling precedent for bulk messaging
 * (src/app/api/register/bulk-email/route.ts). sendBroadcast itself also
 * independently enforces this — page-level gating alone is never treated
 * as sufficient authorization for a server action in this codebase.
 */
export default async function CommunicationsPage(props: { searchParams?: Promise<{ centre?: string }> } = {}) {
    const resolvedSearchParams = (await props.searchParams) ?? {};
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    let org = null;
    let centreIds: string[] = [];
    let activeCentreId = 'all';
    let activeCentre: { name: string } | null = null;
    let hasError = false;

    let initialData: {
        broadcasts: Awaited<ReturnType<typeof getBroadcasts>>;
        parents: Awaited<ReturnType<typeof getParentsForCentre>>;
        classes: Awaited<ReturnType<typeof getClassesForCentre>>;
    } | undefined = undefined;

    try {
        const [[foundOrg], fetchedCentreIds] = await Promise.all([
            db
                .select()
                .from(organisations)
                .where(eq(organisations.id, session.user.organisationId))
                .limit(1),
            getUserAccessibleCentreIds(session.user.id),
        ]);
        org = foundOrg;
        centreIds = fetchedCentreIds;
        activeCentreId = (await resolveActiveCentreId(resolvedSearchParams.centre, centreIds)) || 'all';

        if (org) {
            const [foundCentre, initialTuple] = await Promise.all([
                activeCentreId !== 'all'
                    ? db.query.centres.findFirst({
                        where: eq(centres.id, activeCentreId),
                        columns: { name: true },
                    })
                    : Promise.resolve(null),
                Promise.all([
                    getBroadcasts(activeCentreId),
                    getParentsForCentre(activeCentreId, 'all'),
                    getClassesForCentre(activeCentreId),
                ]).catch(() => undefined),
            ]);
            activeCentre = foundCentre ?? null;
            if (initialTuple) {
                const [broadcasts, parents, classes] = initialTuple;
                initialData = { broadcasts, parents, classes };
            }
        }
    } catch (e) {
        logger.error("Error fetching communications data", e);
        hasError = true;
    }

    if (!org && !hasError) return redirect('/onboarding');
    if (!activeCentreId) activeCentreId = 'all';

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-2">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{activeCentre?.name || 'All Accessible Centres'}</span>
                    </div>
                    <h1 className="text-page-title text-text">
                        Broadcast Messaging
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Send announcements to parents. Respects GDPR communication consent.
                    </p>
                </div>
            </div>

            {hasError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p>There was a problem loading all communications data. Some information may be missing or incomplete.</p>
                </div>
            )}

            {/* Content */}
            <CommunicationsClient centreId={activeCentreId} centreName={activeCentre?.name || null} initialData={initialData} />
        </div>
    );
}
