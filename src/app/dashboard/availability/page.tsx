/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres, centreAvailabilityRules } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { Clock, MapPin, Settings } from 'lucide-react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function AvailabilityPage() {
    const session = await requireTenantSession();

    if (!session?.user?.id) {
        redirect('/login');
    }

    if (!session.user.organisationId) {
        redirect('/onboarding');
    }

    const userRole = (session.user as any).role || 'TUTOR';
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) {
        redirect('/dashboard');
    }

    const orgId = session.user.organisationId;

    const accessibleCentres = await getUserAccessibleCentres(session.user.id);
    const accessibleCentreIds = accessibleCentres.map(c => c.id);

    const centresList = accessibleCentreIds.length > 0
        ? await db.query.centres.findMany({
            where: and(
                eq(centres.organisationId, orgId),
                inArray(centres.id, accessibleCentreIds)
            ),
            with: { availabilityRules: true },
        })
        : [];

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard"
                    aria-label="Back to dashboard"
                    className="p-2 hover:bg-secondary rounded-md min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 flex items-center justify-center transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-text-muted" aria-hidden="true" />
                </Link>
                <PageHeader
                    title="Centre Availability"
                    description="Configure session capacity, operating days, and date overrides per centre."
                    className="flex-1"
                />
            </div>

            {/* Empty State */}
            {centresList.length === 0 && (
                <EmptyState
                    icon={<Clock className="w-8 h-8" aria-hidden="true" />}
                    title="No centres found"
                    description="Create a centre first, then configure its opening hours here."
                    className="m-0"
                    action={
                        <Link
                            href="/dashboard/centres/add"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent rounded-md text-sm font-semibold text-on-accent hover:bg-accent-hover transition-colors"
                        >
                            + Add Centre
                        </Link>
                    }
                />
            )}

            {/* Centre Cards */}
            <div className="space-y-6">
                {centresList.map(centre => (
                    <div key={centre.id} className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
                        {/* Card Header */}
                        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-accent-soft rounded-lg flex items-center justify-center shrink-0">
                                    <MapPin className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-text capitalize">{centre.name}</h2>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted font-medium">
                                        {centre.address && <span>{centre.address}</span>}
                                        {centre.address && (centre.managerName || centre.timezone) && <span>·</span>}
                                        {centre.managerName && <span>Manager: {centre.managerName}</span>}
                                        {centre.managerName && centre.timezone && <span>·</span>}
                                        {centre.timezone && <span>{centre.timezone}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/dashboard/centres/${centre.id}/settings`}
                                    className="flex items-center gap-2 px-3.5 py-2 min-h-11 sm:min-h-9 bg-secondary hover:bg-secondary/80 text-text rounded-md text-sm font-semibold transition-colors border border-border"
                                >
                                    Centre Settings
                                </Link>
                                <Link
                                    href={`/dashboard/availability/${centre.id}`}
                                    className="flex items-center gap-2 px-3.5 py-2 min-h-11 sm:min-h-9 bg-accent-soft hover:bg-accent/20 text-accent rounded-md text-sm font-semibold transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                    Edit Hours
                                </Link>
                            </div>
                        </div>

                        {/* Weekly Schedule Grid */}
                        <div className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                                {DAYS.map((day, index) => {
                                    const rule = centre.availabilityRules.find(r => r.dayOfWeek === index);
                                    const isWeekend = index === 0 || index === 6;

                                    return (
                                        <div
                                            key={day}
                                            className={`rounded-lg p-3 text-center ${
                                                rule
                                                    ? 'bg-success/10 border border-success/20'
                                                    : isWeekend
                                                        ? 'bg-secondary border border-dashed border-border'
                                                        : 'bg-secondary border border-border'
                                            }`}
                                        >
                                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                                                {day.slice(0, 3)}
                                            </p>
                                            {rule ? (
                                                <>
                                                    <p className="text-xs font-bold text-success tabular-nums">{rule.startTime}</p>
                                                    <p className="text-[10px] text-text-muted">to</p>
                                                    <p className="text-xs font-bold text-success tabular-nums">{rule.endTime}</p>
                                                </>
                                            ) : (
                                                <p className="text-xs text-text-muted italic">Closed</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
