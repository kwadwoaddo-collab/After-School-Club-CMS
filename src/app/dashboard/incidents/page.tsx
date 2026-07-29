import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AlertTriangle } from 'lucide-react';
import IncidentsClient from './IncidentsClient';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export default async function IncidentsPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

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
    } catch (e: any) {
        console.error("Error fetching incidents data:", e);
        hasError = true;
    }

    if (!org && !hasError) return redirect('/onboarding');
    if ((!activeCentreId || activeCentreId === 'all') && !hasError) return redirect('/dashboard');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        Incident &amp; Accident Records
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Log and manage safeguarding, medical, and accident reports.
                    </p>
                </div>
            </div>

            {hasError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p>There was a problem loading all incident data. Some information may be missing or incomplete.</p>
                </div>
            )}

            {/* Content */}
            <IncidentsClient centreId={activeCentreId} />
        </div>
    );
}
