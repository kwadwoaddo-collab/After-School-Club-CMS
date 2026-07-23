import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import WondeSettingsClient from './WondeSettingsClient';

export default async function WondeSettingsPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = (session.user as any).role as string;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return redirect('/dashboard/settings');
    }

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        Wonde MIS Integration
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Sync students and parent contacts directly from your school's MIS.
                    </p>
                </div>
            </div>

            {/* Content */}
            <WondeSettingsClient orgName={org.name} lastSync={org.updatedAt} />
        </div>
    );
}
