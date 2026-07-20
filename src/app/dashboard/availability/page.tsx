import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres, centreAvailabilityRules } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { Clock, MapPin, Settings } from 'lucide-react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUserAccessibleCentres } from '@/lib/permissions';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function AvailabilityPage() {
    const session = await auth();

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
                    className="p-2 hover:bg-secondary rounded-xl transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Centre Hours</h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Configure opening hours for each centre
                    </p>
                </div>
            </div>

            {/* Empty State */}
            {centresList.length === 0 && (
                <div className="glass-card rounded-[32px] p-16 text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Clock className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">No centres found</h3>
                    <p className="text-muted-foreground max-w-md mx-auto mb-8">
                        Create a centre first, then configure its opening hours here.
                    </p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/30"
                    >
                        + Add Centre
                    </Link>
                </div>
            )}

            {/* Centre Cards */}
            <div className="space-y-6">
                {centresList.map(centre => (
                    <div key={centre.id} className="glass-card rounded-3xl overflow-hidden">
                        {/* Card Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-foreground capitalize">{centre.name}</h2>
                                    {centre.timezone && (
                                        <p className="text-xs text-muted-foreground font-medium">{centre.timezone}</p>
                                    )}
                                </div>
                            </div>
                            <Link
                                href={`/dashboard/availability/${centre.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl text-sm font-bold transition-all"
                            >
                                <Settings className="w-4 h-4" />
                                Edit Hours
                            </Link>
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
                                            className={`rounded-2xl p-3 text-center ${
                                                rule
                                                    ? 'bg-success/10 border border-success/20'
                                                    : isWeekend
                                                        ? 'bg-secondary border border-dashed border-border'
                                                        : 'bg-secondary border border-border'
                                            }`}
                                        >
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                                {day.slice(0, 3)}
                                            </p>
                                            {rule ? (
                                                <>
                                                    <p className="text-xs font-bold text-success">{rule.startTime}</p>
                                                    <p className="text-[10px] text-muted-foreground">to</p>
                                                    <p className="text-xs font-bold text-success">{rule.endTime}</p>
                                                </>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic">Closed</p>
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
