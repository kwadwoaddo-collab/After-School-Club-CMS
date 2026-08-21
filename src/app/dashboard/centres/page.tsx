/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { organisations, centres, bookings } from '@/db/schema';
import { eq, and, gte, lt, sql, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, MapPin, ChevronRight, BarChart3, Building2, AlertTriangle } from 'lucide-react';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { LoadForecast } from '@/components/dashboard/LoadForecast';
import { getAvatarGradient } from '@/components/ui/utils';

export default async function CentresPage() {
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    let hasError = false;
    let org = null;
    let centresList: any[] = [];
    let centreIds: string[] = [];
    let bookingCounts: any[] = [];
    let centresWithStats: any[] = [];

    const now = new Date();
    const next7Days = addDays(now, 7);

    try {
        const [foundOrg] = await db
            .select()
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);
        org = foundOrg;

        if (org) {
            // Fetch all centres for this organisation
            centresList = await db
                .select()
                .from(centres)
                .where(eq(centres.organisationId, org.id));

            centreIds = centresList.map(c => c.id);

            // Fetch booking counts for the next 7 days ONLY for these centres (Data Isolation)
            bookingCounts = centreIds.length > 0 ? await db
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
            centresWithStats = centresList.map(centre => {
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
        }
    } catch (e: any) {
        console.error("Error fetching centres data:", e);
        hasError = true;
    }

    if (!org && !hasError) return redirect('/onboarding');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Centres</h1>
                    <p className="text-on-surface-variant font-medium mt-1">
                        Manage your club centres and locations
                    </p>
                </div>
                <Link
                    href="/dashboard/centres/add"
                    className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/30 glow-btn duration-100"
                >
                    <Plus className="w-4 h-4" /> Add Centre
                </Link>
            </div>

            {hasError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p>There was a problem loading all centre data. Some information may be missing or incomplete.</p>
                </div>
            )}

            {/* Centres Table */}
            {centresList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-dashed border-border rounded-3xl">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">No centres yet</h3>
                    <p className="text-on-surface-variant mb-6 max-w-xs">
                        Get started by adding your first centre
                    </p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg glow-btn shadow-primary/30 duration-100"
                    >
                        <Plus className="w-4 h-4" /> Add Your First Centre
                    </Link>
                </div>
            ) : (
                <div className="glassmorphic-card rounded-[32px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-secondary/10">
                                    <th className="py-4 px-6 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Centre Identity</th>
                                    <th className="py-4 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Compliance</th>
                                    <th className="py-4 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="py-4 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">7-Day Forecast</th>
                                    <th className="py-4 px-4 w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {centresWithStats.map((centre) => {
                                    const gradient = getAvatarGradient(centre.name);
                                    
                                    return (
                                        <tr key={centre.id} className="group hover:bg-secondary/40 transition-colors cursor-pointer">
                                            <td className="py-4 px-6">
                                                <Link href={`/dashboard/centres/${centre.id}/settings`} className="flex items-center gap-3 active:scale-[0.985] transition-all duration-100">
                                                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-sm`}>
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                            {centre.name}
                                                        </p>
                                                        {centre.address && (
                                                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[250px]">
                                                                {centre.address}
                                                            </p>
                                                        )}
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Link href={`/dashboard/centres/${centre.id}/settings`} className="block">
                                                    {centre.ofstedId ? (
                                                        <span className="font-mono text-slate-500 text-xs px-2 py-1 bg-secondary rounded-md border border-border">
                                                            {centre.ofstedId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">—</span>
                                                    )}
                                                </Link>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Link href={`/dashboard/centres/${centre.id}/settings`} className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                    <span className="text-sm font-medium text-foreground">Active</span>
                                                </Link>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Link href={`/dashboard/centres/${centre.id}/settings`} className="block w-[120px]">
                                                    <LoadForecast data={centre.forecast} max={10} />
                                                </Link>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Link href={`/dashboard/centres/${centre.id}/settings`} className="p-2 text-muted-foreground hover:text-primary transition-colors active:scale-90 duration-100 flex justify-end opacity-0 group-hover:opacity-100">
                                                    <ChevronRight className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
