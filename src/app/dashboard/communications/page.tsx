import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import CommunicationsClient from './CommunicationsClient';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export default async function CommunicationsPage() {
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
                        Broadcast Messaging
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Send announcements to parents. Respects GDPR communication consent.
                    </p>
                </div>
            </div>

            {/* Content */}
            <CommunicationsClient organisationId={session.user.organisationId} centreId={activeCentreId} />
        </div>
    );
}
