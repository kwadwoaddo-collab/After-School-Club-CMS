import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = (session.user as any).role as string;
    if (userRole === 'TUTOR' || userRole === 'FRONT_DESK') {
        // Only ORG_OWNER and MANAGER can access reports
        return redirect('/dashboard');
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
                        Reports &amp; Exports
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Download your booking and student data as CSV files.
                    </p>
                </div>
            </div>

            {/* Reports Content */}
            <ReportsClient />
        </div>
    );
}
