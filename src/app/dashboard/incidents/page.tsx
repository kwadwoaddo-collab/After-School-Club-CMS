import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AlertTriangle, Building2 } from 'lucide-react';
import IncidentsClient from './IncidentsClient';
import { getIncidents } from '@/features/incidents/actions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';
import { EmptyState } from '@/components/ui/EmptyState';
import { logger } from '@/lib/logger';

export default async function IncidentsPage(props: { searchParams?: Promise<{ centre?: string }> } = {}) {
    const resolvedSearchParams = (await props.searchParams) ?? {};
    // Milestone 3K (Option C — orchestrator decision 2026-08-24):
    // Incident records are accessible to ORG_OWNER, MANAGER, and FRONT_DESK.
    // FRONT_DESK may view and log operational incidents (accident/incident/medication).
    // Safeguarding records remain restricted to ORG_OWNER/MANAGER at the action level.
    // Previously restricted to ORG_OWNER/MANAGER only, which was inconsistent with
    // sidebar visibility and the existing createIncident action having no role gate for
    // non-safeguarding types (see milestone-3k-incidents-audit.md, Ambiguity A-1).
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    const userRole = String((session.user as { role?: string }).role || '');

    let org = null;
    let centreIds: string[] = [];
    let activeCentreId = '';
    let activeCentre: { name: string; ofstedId: string | null } | null = null;
    let hasError = false;

    try {
        const [foundOrg] = await db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);
        org = foundOrg;

        const rawCentreIds = await getUserAccessibleCentreIds(session.user.id);
        centreIds = (rawCentreIds ?? []).filter(isValidUuid);

        if (centreIds.length > 0) {
            const resolved = await resolveActiveCentreId(resolvedSearchParams.centre, centreIds);
            activeCentreId = isValidUuid(resolved) && centreIds.includes(resolved)
                ? resolved
                : centreIds[0];

            if (isValidUuid(activeCentreId)) {
                const foundCentre = await db.query.centres.findFirst({
                    where: eq(centres.id, activeCentreId),
                    columns: { name: true, ofstedId: true },
                });
                activeCentre = foundCentre ?? null;
            }
        }
    } catch (e) {
        logger.error('Error fetching incidents data', e);
        hasError = true;
    }

    if (!org && !hasError) return redirect('/onboarding');

    const centreName = activeCentre?.name || undefined;
    const hasValidCentre = isValidUuid(activeCentreId);

    let initialIncidents: Awaited<ReturnType<typeof getIncidents>> | undefined = undefined;
    if (hasValidCentre) {
        try {
            initialIncidents = await getIncidents(activeCentreId);
        } catch {
            initialIncidents = undefined;
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    {centreName && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold mb-2">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{centreName}{activeCentre?.ofstedId ? ` · Ofsted ${activeCentre.ofstedId}` : ''}</span>
                        </div>
                    )}
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
            {!hasValidCentre ? (
                hasError ? (
                    <EmptyState
                        icon={<AlertTriangle className="w-8 h-8" />}
                        title="Unable to load centres"
                        description="Incident records could not be loaded right now. Please refresh the page and try again."
                    />
                ) : userRole === 'ORG_OWNER' ? (
                    <EmptyState
                        icon={<Building2 className="w-8 h-8" />}
                        title="No centres set up yet"
                        description="Create your first centre before logging or viewing incident and accident records."
                        action={
                            <Link
                                href="/dashboard/centres/add"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent text-xs font-bold rounded-xl hover:bg-accent-hover transition-all"
                            >
                                Add Centre
                            </Link>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={<Building2 className="w-8 h-8" />}
                        title="No centres assigned"
                        description="You are not currently assigned to any centres. Ask an organisation owner to assign you to a centre to view or log incident records."
                    />
                )
            ) : (
                <IncidentsClient
                    centreId={activeCentreId}
                    centreName={centreName}
                    userRole={userRole}
                    initialIncidents={initialIncidents}
                />
            )}
        </div>
    );
}
