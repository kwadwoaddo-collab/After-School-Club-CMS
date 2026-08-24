import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AlertTriangle } from 'lucide-react';
import IncidentsClient from './IncidentsClient';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export default async function IncidentsPage() {
    // Milestone 3K (Option C — orchestrator decision 2026-08-24):
    // Incident records are accessible to ORG_OWNER, MANAGER, and FRONT_DESK.
    // FRONT_DESK may view and log operational incidents (accident/incident/medication).
    // Safeguarding records remain restricted to ORG_OWNER/MANAGER at the action level.
    // Previously restricted to ORG_OWNER/MANAGER only, which was inconsistent with
    // sidebar visibility and the existing createIncident action having no role gate for
    // non-safeguarding types (see milestone-3k-incidents-audit.md, Ambiguity A-1).
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });

    let org = null;
    let centreIds: string[] = [];
    let activeCentreId = 'all';
    let hasError = false;

    try {
        const [foundOrg] = await db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);
        org = foundOrg;

        centreIds = await getUserAccessibleCentreIds(session.user.id);
        activeCentreId = await resolveActiveCentreId(undefined, centreIds);
    } catch (e) {
        logger.error('Error fetching incidents data', e);
        hasError = true;
    }

    if (!org && !hasError) return redirect('/onboarding');

    // Incidents require a specific centre context — cross-centre aggregate view
    // is not supported. If the user has no specific centre selected, redirect to
    // the dashboard so they can select one via the centre picker.
    if ((!activeCentreId || activeCentreId === 'all') && !hasError) {
        return redirect('/dashboard');
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-text tracking-tight">
                        Incident &amp; Accident Records
                    </h1>
                    <p className="text-text-muted font-medium mt-1">
                        Log and manage safeguarding, medical, and accident reports.
                    </p>
                </div>
            </div>

            {hasError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p>There was a problem loading incident data. Some information may be missing or incomplete.</p>
                </div>
            )}

            {/* Content */}
            <IncidentsClient centreId={activeCentreId} />
        </div>
    );
}
