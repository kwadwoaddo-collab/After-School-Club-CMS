/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { format, startOfWeek } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import ReportsClient from './ReportsClient';
import { getWeeklyReport } from '@/features/reports/weekly-report.action';
import { logger } from '@/lib/logger';

export default async function ReportsPage() {
    const session = await requireTenantSession();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = (session.user as any).role as string;
    if (userRole === 'TUTOR' || userRole === 'FRONT_DESK') {
        // Only ORG_OWNER and MANAGER can access reports
        return redirect('/dashboard');
    }

    const today = new Date();
    const defaultStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const defaultEnd = format(today, 'yyyy-MM-dd');

    const [orgResult, initialReportResult] = await Promise.all([
        db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1)
            .then(([foundOrg]) => ({ org: foundOrg ?? null, hasError: false }))
            .catch((e) => {
                logger.error('Error fetching org for reports page', e);
                return { org: null, hasError: true };
            }),
        getWeeklyReport(defaultStart, defaultEnd, 'all')
            .then((data) => ({ data, error: null as string | null }))
            .catch((e) => {
                logger.error('Error preloading weekly report for reports page', e);
                return {
                    data: null,
                    error: 'We couldn’t load this report. Check the selected dates and centre, then refresh the report. No records were changed.',
                };
            }),
    ]);

    const org = orgResult.org;
    const hasError = orgResult.hasError;

    if (!org && !hasError) return redirect('/onboarding');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-page-title text-text">
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
            <ReportsClient
                initialData={initialReportResult.data}
                initialError={initialReportResult.error}
            />
        </div>
    );
}
