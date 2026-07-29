/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AlertTriangle } from 'lucide-react';
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

    let org = null;
    let hasError = false;

    try {
        const [foundOrg] = await db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);
        org = foundOrg;
    } catch (e: any) {
        console.error("Error fetching org for reports page:", e);
        hasError = true;
    }

    if (!org && !hasError) return redirect('/onboarding');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        Reports &amp; Exports
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        View executive activity reports and export raw data to CSV or PDF.
                    </p>
                </div>
            </div>

            {/* Reports Content */}
            {hasError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 mb-4">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p>There was a problem loading all report data. Some information may be missing or incomplete.</p>
                </div>
            )}
            <ReportsClient />
        </div>
    );
}
