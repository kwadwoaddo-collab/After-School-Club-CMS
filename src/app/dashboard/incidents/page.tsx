import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import IncidentsClient from './IncidentsClient';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export default async function IncidentsPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');
    const centreIds = await getUserAccessibleCentreIds(session.user.id);
    const activeCentreId = await resolveActiveCentreId(undefined, centreIds);
    if (!activeCentreId || activeCentreId === 'all') return redirect('/dashboard');

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

            {/* Content */}
            <IncidentsClient centreId={activeCentreId} />
        </div>
    );
}
