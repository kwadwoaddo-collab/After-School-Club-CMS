import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres, bookings } from '@/db/schema';
import { eq, and, gte, lt, sql, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, MapPin, Users, Calendar, ArrowRight, BarChart3, Clock } from 'lucide-react';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { CapacityIndicator } from '@/components/ui/CapacityIndicator';
import { LoadForecast } from '@/components/dashboard/LoadForecast';

export default async function CentresPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    const userRole = (session.user as any).role;
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) return redirect('/dashboard');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    // Fetch all centres for this organisation
    const centresList = await db
        .select()
        .from(centres)
        .where(eq(centres.organisationId, org.id));

    const centreIds = centresList.map(c => c.id);

    const now = new Date();
    const next7Days = addDays(now, 7);

    // Fetch booking counts for the next 7 days ONLY for these centres (Data Isolation)
    const bookingCounts = centreIds.length > 0 ? await db
        .select({
            centreId: bookings.centreId,
            day: sql<string>`date_trunc('day', ${bookings.startAt})`,
            count: sql<number>`count(*)::int`
        })
        .from(bookings)
        .where(and(
            inArray(bookings.centreId, centreIds),
            gte(bookings.startAt, startOfDay(now)),
            lt(bookings.startAt, endOfDay(next7Days)),
            eq(bookings.status, 'confirmed')
        ))
        .groupBy(bookings.centreId, sql`date_trunc('day', ${bookings.startAt})`) : [];

    // Map counts to centres
    const centresWithStats = centresList.map(centre => {
        const centreStats = bookingCounts.filter(bc => bc.centreId === centre.id);
        const todayStats = centreStats.find(bc => {
            if (!bc.day) return false;
            const d = new Date(bc.day);
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        
        return {
            ...centre,
            todayCount: Number(todayStats?.count || 0),
            forecast: centreStats.map(bc => ({
                day: new Date(bc.day!),
                count: Number(bc.count || 0)
            }))
        };
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Centres</h1>
                    <p className="text-on-surface-variant font-medium mt-1">
                        Manage your club centres and locations
                    </p>
                </div>
                <Link
                    href="/dashboard/centres/add"
                    className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                >
                    <Plus className="w-4 h-4" /> Add Centre
                </Link>
            </div>

            {/* Centres Grid */}
            {centresList.length === 0 ? (
                <div className="glassmorphic-card rounded-[32px] p-12 text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No centres yet</h3>
                    <p className="text-on-surface-variant mb-6">
                        Get started by adding your first centre
                    </p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg glow-btn shadow-primary/30"
                    >
                        <Plus className="w-4 h-4" /> Add Your First Centre
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {centresWithStats.map((centre) => (
                        <div
                            key={centre.id}
                            className="glassmorphic-card rounded-3xl p-6 hover:border-primary/30 transition-all group glow-hover-primary"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="px-3 py-1 bg-tertiary-container/10 text-tertiary border border-tertiary/20 text-xs font-bold rounded-full uppercase tracking-wider">
                                        Active
                                    </span>
                                    <CapacityIndicator current={centre.todayCount} max={10} size="sm" />
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-white mb-2 tracking-tight group-hover:text-primary transition-colors">{centre.name}</h3>

                            {centre.address && (
                                <p className="text-sm text-on-surface-variant opacity-80 mb-6 flex items-start gap-2 h-10 overflow-hidden line-clamp-2">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{centre.address}</span>
                                </p>
                            )}

                            {/* Load Forecast Visualization */}
                            <div className="mb-6 p-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/5">
                                <div className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                    <BarChart3 className="w-3.5 h-3.5" />
                                    7-Day Load Forecast
                                </div>
                                <LoadForecast data={centre.forecast} max={10} />
                            </div>

                            <div className="pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
                                    <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-lg">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{centre.todayCount} today</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/dashboard/centres/${centre.id}/billing`}
                                        className="px-3 py-2 bg-white/5 border border-white/10 text-on-surface-variant text-xs font-bold rounded-xl hover:bg-white/10 hover:text-white flex items-center gap-1.5 transition-all"
                                    >
                                        Billing
                                    </Link>
                                    <Link
                                        href={`/dashboard/bookings?centre=${centre.id}`}
                                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-blue-600 flex items-center gap-2 transition-all shadow-md shadow-primary/20"
                                    >
                                        Manage <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
