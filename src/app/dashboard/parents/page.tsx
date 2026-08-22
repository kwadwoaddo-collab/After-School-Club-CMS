/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
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
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { logger } from '@/lib/logger';

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

    // Same role rule as the rest of the People module — see
    // project-notes/milestone-3b-parents-audit.md §4. Previously this page
    // only checked for a session, so any authenticated org member (including
    // TUTOR) could view the full parent/family directory.
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    const orgId = (session.user as any).organisationId;

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

        // Centre-scoping for the 'all' view — mirrors the restriction the
        // Students list already applies (src/app/dashboard/students/page.tsx),
        // which Parents was missing: previously, selecting "All centres"
        // (the default resolveActiveCentreId falls back to a specific
        // accessible centre, but 'all' can still be requested explicitly via
        // ?centre=all) applied no centre restriction whatsoever, so a
        // non-ORG_OWNER user could see every family in the organisation,
        // including ones tied only to centres they have no membership in.
        // A child with no centre assigned is treated the same permissive way
        // Students treats it (visible to anyone), and ORG_OWNER is
        // unaffected since their accessibleCentreIds already covers every
        // centre in the org. See project-notes/milestone-3b-parents-audit.md §4.
        const visibleCentreSql = accessibleCentreIds.length > 0
            ? sql`(centre_id IS NULL OR centre_id IN (${sql.join(accessibleCentreIds.map(id => sql`${id}`), sql`, `)}))`
            : sql`centre_id IS NULL`;
        const visibleCentreSqlI = accessibleCentreIds.length > 0
            ? sql`(i.centre_id IS NULL OR i.centre_id IN (${sql.join(accessibleCentreIds.map(id => sql`${id}`), sql`, `)}))`
            : sql`i.centre_id IS NULL`;

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
                ${activeCentreId !== 'all' ? sql`AND centre_id = ${activeCentreId}` : sql`AND ${visibleCentreSql}`}
                GROUP BY parent_id
            ),
            AllChildData AS (
                -- Unscoped child count — used only to tell "this parent has
                -- no children at all" apart from "this parent has children,
                -- but none in a centre this viewer can see" for the
                -- 'all'-view visibility check below. Not otherwise exposed.
                SELECT parent_id, COUNT(*) as total_child_count
                FROM children
                WHERE organisation_id = ${orgId} AND deleted_at IS NULL
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
                  ${activeCentreId !== 'all' ? sql`AND i.centre_id = ${activeCentreId}` : sql`AND ${visibleCentreSqlI}`}
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
                LEFT JOIN AllChildData acd ON pa.id = acd.parent_id
                LEFT JOIN InvoiceSummary ins ON pa.id = ins.parent_id
                WHERE pa.organisation_id = ${orgId} AND pa.deleted_at IS NULL
                ${activeCentreId !== 'all'
                    ? sql`AND (cd.child_count > 0 OR pa.id IN (SELECT parent_id FROM children WHERE centre_id = ${activeCentreId} AND deleted_at IS NULL))`
                    : sql`AND (COALESCE(acd.total_child_count, 0) = 0 OR COALESCE(cd.child_count, 0) > 0)`}
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
                ${activeCentreId !== 'all' ? sql`AND centre_id = ${activeCentreId}` : sql`AND ${visibleCentreSql}`}
                GROUP BY parent_id
            ),
            AllChildData AS (
                SELECT parent_id, COUNT(*) as total_child_count
                FROM children
                WHERE organisation_id = ${orgId} AND deleted_at IS NULL
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
                ${activeCentreId !== 'all' ? sql`AND i.centre_id = ${activeCentreId}` : sql`AND ${visibleCentreSqlI}`}
                GROUP BY i.parent_id
            )
            SELECT
                COUNT(pa.id) as total_families,
                COALESCE(SUM(cd.child_count), 0) as total_children,
                COUNT(pa.id) FILTER (WHERE ins.outstanding > 0) as with_outstanding,
                COALESCE(SUM(ins.outstanding), 0) as total_outstanding
            FROM parents pa
            LEFT JOIN ChildData cd ON pa.id = cd.parent_id
            LEFT JOIN AllChildData acd ON pa.id = acd.parent_id
            LEFT JOIN InvoiceSummary ins ON pa.id = ins.parent_id
            WHERE pa.organisation_id = ${orgId} AND pa.deleted_at IS NULL
            ${activeCentreId !== 'all'
                ? sql`AND cd.child_count > 0`
                : sql`AND (COALESCE(acd.total_child_count, 0) = 0 OR COALESCE(cd.child_count, 0) > 0)`}
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
        logger.error("Error fetching parents", e);
        hasError = true;
    }

    const hasActiveFilters = !!(search || status !== 'all' || activeCentreId !== 'all');

    return (
        <div className="space-y-6">
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-page-title text-text">Parents</h1>
                    <span className="px-2 py-0.5 rounded-sm bg-page border border-border-subtle text-text-muted text-xs font-medium">
                        {totalFamilies}
                    </span>
                </div>
            </HeaderPortal>

            <HeaderPortal targetId="header-right-actions">
                <Button variant="secondary" asChild>
                    <Link href="/dashboard/parents/bin">
                        <Archive className="w-3.5 h-3.5" />
                        Recovery Bin
                    </Link>
                </Button>
            </HeaderPortal>

            {/* KPI stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                            <Users className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">{totalFamilies}</p>
                            <p className="text-metadata">Families</p>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-soft text-success">
                            <Baby className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">{totalChildren}</p>
                            <p className="text-metadata">Children</p>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning">
                            <AlertCircle className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">{withOutstanding}</p>
                            <p className="text-metadata">With balance</p>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-4 flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
                            <PoundSterling className="w-4 h-4" />
                        </span>
                        <div>
                            <p className="text-financial-total text-text">£{totalOutstanding.toFixed(0)}</p>
                            <p className="text-metadata">Outstanding</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Toolbar — sticky */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-page/90 backdrop-blur-sm border-b border-border-subtle">
                <ParentsFilters resultsCount={filteredCount} />
            </div>

            <div>
                <ParentsTable parents={rows} error={hasError} hasActiveFilters={hasActiveFilters} />

                {totalPages > 1 && (
                    <div className="mt-4">
                        <Pagination currentPage={page} totalPages={totalPages} />
                    </div>
                )}
            </div>
        </div>
    );
}
