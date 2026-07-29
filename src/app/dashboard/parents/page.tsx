/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { Users, AlertCircle, PoundSterling, Baby, Archive } from 'lucide-react';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import ParentsTable, { ParentRow } from '@/features/parents/components/ParentsTable';
import ParentsFilters from '@/features/parents/components/ParentsFilters';
import Pagination from '@/components/ui/Pagination';

interface Props {
    searchParams: Promise<{ search?: string; centre?: string; status?: string; page?: string }>;
}

export default async function ParentsPage({ searchParams }: Props) {
    const rawParams = await searchParams;
    const search = rawParams.search?.trim() ?? '';
    const centreParam = rawParams.centre;
    const status = rawParams.status ?? 'all';
    
    const PAGE_SIZE = 20;
    const page = Math.max(1, parseInt(rawParams.page || '1', 10));
    const offset = (page - 1) * PAGE_SIZE;

    const session = await auth();
    if (!session?.user) return redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) return redirect('/onboarding');

    let hasError = false;
    let accessibleCentreIds: string[] = [];
    let activeCentreId: string = 'all';
    let totalFamilies = 0;
    let totalChildren = 0;
    let withOutstanding = 0;
    let totalOutstanding = 0;
    let filteredCount = 0;
    let totalPages = 0;
    let rows: ParentRow[] = [];

    try {
        accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        activeCentreId = await resolveActiveCentreId(centreParam, accessibleCentreIds);

        // 1. Build CTEs for children data and invoices
        const baseQuery = sql`
            WITH ChildData AS (
                SELECT
                    parent_id,
                    COUNT(*) as child_count,
                    json_agg(
                        json_build_object('id', id, 'first_name', first_name, 'last_name', last_name)
                    ) as children_list
                FROM children
                WHERE organisation_id = ${orgId} AND deleted_at IS NULL
                ${activeCentreId !== 'all' ? sql`AND centre_id = ${activeCentreId}` : sql``}
                GROUP BY parent_id
            ),
            InvoiceSummary AS (
                SELECT
                    i.parent_id,
                    COALESCE(SUM(i.amount), 0) as total_invoiced,
                    COALESCE(SUM(p.paid), 0) as total_paid
                FROM invoices i
                LEFT JOIN (
                    SELECT invoice_id, SUM(amount) as paid
                    FROM payments
                    GROUP BY invoice_id
                ) p ON i.id = p.invoice_id
                WHERE i.organisation_id = ${orgId}
                  AND i.status != 'void'
                  ${activeCentreId !== 'all' ? sql`AND i.centre_id = ${activeCentreId}` : sql``}
                GROUP BY i.parent_id
            ),
            ParentBase AS (
                SELECT
                    pa.id,
                    pa.first_name,
                    pa.last_name,
                    pa.email,
                    pa.phone,
                    COALESCE(cd.child_count, 0) as child_count,
                    COALESCE(cd.children_list, '[]'::json) as children_list,
                    GREATEST(0, COALESCE(ins.total_invoiced, 0) - COALESCE(ins.total_paid, 0)) as outstanding
                FROM parents pa
                LEFT JOIN ChildData cd ON pa.id = cd.parent_id
                LEFT JOIN InvoiceSummary ins ON pa.id = ins.parent_id
                WHERE pa.organisation_id = ${orgId} AND pa.deleted_at IS NULL
                ${activeCentreId !== 'all' ? sql`AND (cd.child_count > 0 OR pa.id IN (SELECT parent_id FROM children WHERE centre_id = ${activeCentreId} AND deleted_at IS NULL))` : sql``}
            )
            SELECT * FROM ParentBase
            WHERE 1=1
        `;

        // 2. Add filters
        const filterClauses = [];
        if (search) {
            filterClauses.push(sql`(
                first_name ILIKE ${'%' + search + '%'} OR
                last_name ILIKE ${'%' + search + '%'} OR
                email ILIKE ${'%' + search + '%'} OR
                phone ILIKE ${'%' + search + '%'} OR
                EXISTS (
                    SELECT 1 FROM json_array_elements(children_list) as child
                    WHERE (child->>'first_name') ILIKE ${'%' + search + '%'}
                       OR (child->>'last_name') ILIKE ${'%' + search + '%'}
                )
            )`);
        }

        if (status === 'active') {
            filterClauses.push(sql`child_count > 0`);
        } else if (status === 'inactive') {
            filterClauses.push(sql`child_count = 0`);
        } else if (status === 'arrears') {
            filterClauses.push(sql`outstanding > 0`);
        }

        const whereSql = filterClauses.length > 0 
            ? sql` AND ${sql.join(filterClauses, sql` AND `)}`
            : sql``;

        // 3. Get total counts (both filtered and total KPIs)
        const kpisResult = await db.execute(sql`
            WITH ChildData AS (
                SELECT parent_id, COUNT(*) as child_count
                FROM children
                WHERE organisation_id = ${orgId} AND deleted_at IS NULL
                ${activeCentreId !== 'all' ? sql`AND centre_id = ${activeCentreId}` : sql``}
                GROUP BY parent_id
            ),
            InvoiceSummary AS (
                SELECT
                    i.parent_id,
                    GREATEST(0, COALESCE(SUM(i.amount), 0) - COALESCE(SUM(p.paid), 0)) as outstanding
                FROM invoices i
                LEFT JOIN (
                    SELECT invoice_id, SUM(amount) as paid
                    FROM payments
                    GROUP BY invoice_id
                ) p ON i.id = p.invoice_id
                WHERE i.organisation_id = ${orgId} AND i.status != 'void'
                ${activeCentreId !== 'all' ? sql`AND i.centre_id = ${activeCentreId}` : sql``}
                GROUP BY i.parent_id
            )
            SELECT
                COUNT(pa.id) as total_families,
                COALESCE(SUM(cd.child_count), 0) as total_children,
                COUNT(pa.id) FILTER (WHERE ins.outstanding > 0) as with_outstanding,
                COALESCE(SUM(ins.outstanding), 0) as total_outstanding
            FROM parents pa
            LEFT JOIN ChildData cd ON pa.id = cd.parent_id
            LEFT JOIN InvoiceSummary ins ON pa.id = ins.parent_id
            WHERE pa.organisation_id = ${orgId} AND pa.deleted_at IS NULL
            ${activeCentreId !== 'all' ? sql`AND cd.child_count > 0` : sql``}
        `);

        const kpis = kpisResult[0] || { total_families: 0, total_children: 0, with_outstanding: 0, total_outstanding: 0 };
        totalFamilies = Number(kpis.total_families);
        totalChildren = Number(kpis.total_children);
        withOutstanding = Number(kpis.with_outstanding);
        totalOutstanding = Number(kpis.total_outstanding);

        // 4. Get filtered total for pagination
        const countQuery = sql`
            ${baseQuery}
            ${whereSql}
        `;
        
        const countResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM (${countQuery}) as sub`);
        filteredCount = Number(countResult[0]?.count || 0);
        totalPages = Math.ceil(filteredCount / PAGE_SIZE);

        // 5. Get paginated rows
        const dataQuery = sql`
            ${baseQuery}
            ${whereSql}
            ORDER BY last_name ASC, first_name ASC
            LIMIT ${PAGE_SIZE}
            OFFSET ${offset}
        `;

        const rawRows = await db.execute(dataQuery);

        rows = rawRows.map(row => ({
            id: row.id as string,
            firstName: row.first_name as string,
            lastName: row.last_name as string,
            email: row.email as string | null,
            phone: row.phone as string | null,
            childCount: Number(row.child_count),
            childrenList: row.children_list as any,
            outstanding: Number(row.outstanding)
        }));
    } catch (e: any) {
        console.error("Error fetching parents:", e);
        hasError = true;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">Parents</h1>
                    <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground text-[10px] font-bold">
                        {totalFamilies}
                    </span>
                </div>
            </HeaderPortal>
            
            <HeaderPortal targetId="header-right-actions">
                <Link
                    href="/dashboard/parents/bin"
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border rounded-xl text-xs font-bold text-foreground transition-all active:scale-95 duration-100 cursor-pointer"
                >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Recovery Bin</span>
                </Link>
            </HeaderPortal>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-[28px] p-5 group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Families</p>
                    <p className="text-3xl font-black text-foreground mt-0.5">{totalFamilies}</p>
                </div>
                <div className="bg-card border border-border rounded-[28px] p-5 group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-success/10 border border-success/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Baby className="w-5 h-5 text-success" />
                        </div>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Children</p>
                    <p className="text-3xl font-black text-foreground mt-0.5">{totalChildren}</p>
                </div>
                <div className="bg-card border border-border rounded-[28px] p-5 group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-warning/10 border border-warning/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <AlertCircle className="w-5 h-5 text-warning" />
                        </div>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">With Balance</p>
                    <p className="text-3xl font-black text-foreground mt-0.5">{withOutstanding}</p>
                </div>
                <div className="bg-card border border-border rounded-[28px] p-5 group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <PoundSterling className="w-5 h-5 text-destructive" />
                        </div>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Outstanding</p>
                    <p className="text-3xl font-black text-foreground mt-0.5">£{totalOutstanding.toFixed(0)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-xl border-b border-border">
                <ParentsFilters resultsCount={filteredCount} />
            </div>

            <div className="relative">
                <ParentsTable parents={rows} error={hasError} />
                
                {totalPages > 1 && (
                    <div className="sticky bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-md border-t border-border mt-4 rounded-b-3xl">
                        <Pagination currentPage={page} totalPages={totalPages} />
                    </div>
                )}
            </div>
        </div>
    );
}
