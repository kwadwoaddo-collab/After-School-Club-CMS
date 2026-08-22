/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { organisations, centres, bookings } from '@/db/schema';
import { eq, and, gte, lt, sql, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, MapPin, ChevronRight, Building2, AlertTriangle } from 'lucide-react';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { LoadForecast } from '@/components/dashboard/LoadForecast';
import { logger } from '@/lib/logger';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

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
    } catch (e) {
        logger.error("Error fetching centres data", e);
        hasError = true;
    }

    if (!org && !hasError) return redirect('/onboarding');

    return (
        <div className="space-y-6">
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-page-title text-text">Centres</h1>
                    <span className="px-2 py-0.5 rounded-sm bg-page border border-border-subtle text-text-muted text-xs font-medium">
                        {centresWithStats.length}
                    </span>
                </div>
            </HeaderPortal>

            <HeaderPortal targetId="header-right-actions">
                <Button asChild>
                    <Link href="/dashboard/centres/add">
                        <Plus className="w-3.5 h-3.5" />
                        Add Centre
                    </Link>
                </Button>
            </HeaderPortal>

            {hasError && (
                <div className="rounded-md bg-danger-soft border border-danger/20 text-small-body text-danger font-medium px-4 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p>There was a problem loading all centre data. Some information may be missing or incomplete.</p>
                </div>
            )}

            {centresList.length === 0 ? (
                <EmptyState
                    icon={<MapPin className="w-8 h-8" />}
                    title="No centres yet"
                    description="Get started by adding your first centre."
                    action={
                        <Button asChild>
                            <Link href="/dashboard/centres/add">
                                <Plus className="w-4 h-4" /> Add your first centre
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    {/* Desktop / tablet — table. Collapses to stacked cards below `md`,
                        matching the People-module mobile table pattern. */}
                    <div className="hidden md:block rounded-lg border border-border bg-surface overflow-hidden">
                        <Table caption="Centres list">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Centre</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead>Ofsted ID</TableHead>
                                    <TableHead>7-day forecast</TableHead>
                                    <TableHead align="right"><span className="sr-only">View</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {centresWithStats.map((centre) => (
                                    <TableRow key={centre.id} clickable>
                                        <TableCell>
                                            <Link href={`/dashboard/centres/${centre.id}/settings`} className="flex items-center gap-3 focus:outline-none">
                                                <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <span className="text-table-value font-medium text-text">{centre.name}</span>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-text-secondary">
                                            <Link href={`/dashboard/centres/${centre.id}/settings`} className="block truncate max-w-[280px] focus:outline-none">
                                                {centre.address || <span className="text-text-muted">—</span>}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/dashboard/centres/${centre.id}/settings`} className="block focus:outline-none">
                                                {centre.ofstedId ? (
                                                    <span className="font-mono text-xs px-2 py-1 rounded-sm border border-border-subtle bg-page text-text-secondary">
                                                        {centre.ofstedId}
                                                    </span>
                                                ) : (
                                                    <span className="text-text-muted">—</span>
                                                )}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/dashboard/centres/${centre.id}/settings`} className="block w-[120px] focus:outline-none">
                                                <LoadForecast data={centre.forecast} max={10} />
                                            </Link>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Link
                                                href={`/dashboard/centres/${centre.id}/settings`}
                                                className="inline-flex p-1.5 text-text-muted hover:text-text transition-colors focus:outline-none"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile — stacked record cards, not a horizontally-scrolled table. */}
                    <div className="md:hidden flex flex-col gap-3">
                        {centresWithStats.map((centre) => (
                            <Link
                                key={centre.id}
                                href={`/dashboard/centres/${centre.id}/settings`}
                                className="block rounded-lg border border-border bg-surface p-4 active:bg-page/60 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-table-value font-medium text-text truncate">{centre.name}</p>
                                        {centre.address && (
                                            <p className="text-small-body text-text-secondary truncate mt-0.5">{centre.address}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            {centre.ofstedId ? (
                                                <span className="font-mono text-xs px-2 py-1 rounded-sm border border-border-subtle bg-page text-text-secondary">
                                                    {centre.ofstedId}
                                                </span>
                                            ) : (
                                                <span className="text-metadata">No Ofsted ID</span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0 mt-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
