/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { Archive, ArrowLeft, Clock } from 'lucide-react';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import Link from 'next/link';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import BinActions from '@/features/parents/components/BinActions';
import { purgeStaleBinItems } from '../bin.actions';

export default async function BinPage() {
    // Same role rule as the rest of the Parents module — see
    // project-notes/milestone-3b-parents-audit.md §4.
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    const orgId = (session.user as any).organisationId;

    // Fire-and-forget purge of items older than 30 days
    await purgeStaleBinItems();

    // Fetch soft-deleted parents
    const deletedParents = await db.execute(sql`
        WITH ChildCounts AS (
            SELECT parent_id, COUNT(*) as child_count
            FROM children
            WHERE organisation_id = ${orgId}
            GROUP BY parent_id
        )
        SELECT
            pa.id,
            pa.first_name,
            pa.last_name,
            pa.email,
            pa.deleted_at,
            COALESCE(cc.child_count, 0) as child_count
        FROM parents pa
        LEFT JOIN ChildCounts cc ON pa.id = cc.parent_id
        WHERE pa.organisation_id = ${orgId}
          AND pa.deleted_at IS NOT NULL
        ORDER BY pa.deleted_at DESC
    `);

    const rows = deletedParents as unknown as Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        deleted_at: string;
        child_count: number;
    }>;

    return (
        <div className="space-y-6">
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/parents"
                        className="p-2 -ml-2 text-text-muted hover:text-text hover:bg-page rounded-sm transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-page-title text-text">Recovery Bin</h1>
                        <p className="text-metadata">Items are permanently deleted after 30 days</p>
                    </div>
                </div>
            </HeaderPortal>

            {rows.length === 0 ? (
                <EmptyState
                    icon={<Archive className="w-8 h-8" />}
                    title="Bin is empty"
                    description="No recently deleted families found."
                />
            ) : (
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                    <Table caption="Deleted parents">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Family</TableHead>
                                <TableHead>Children</TableHead>
                                <TableHead>Deleted on</TableHead>
                                <TableHead>Expires in</TableHead>
                                <TableHead align="right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const deletedDate = new Date(row.deleted_at);
                                const expiryDate = new Date(deletedDate);
                                expiryDate.setDate(expiryDate.getDate() + 30);

                                const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                const isExpiringSoon = daysLeft <= 3;

                                return (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <Link href={`/dashboard/parents/${row.id}`} className="text-accent hover:underline font-medium">
                                                {row.first_name} {row.last_name}
                                            </Link>
                                            <div className="text-metadata mt-0.5">{row.email || 'No email'}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-page border border-border-subtle text-text-secondary text-xs font-medium">
                                                {row.child_count} {row.child_count === 1 ? 'child' : 'children'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-text-secondary">
                                            {deletedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={isExpiringSoon ? 'error' : 'warning'}>
                                                <Clock className="w-3 h-3" />
                                                {daysLeft} days
                                            </Badge>
                                        </TableCell>
                                        <TableCell align="right">
                                            <BinActions parentId={row.id} parentName={`${row.first_name} ${row.last_name}`} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
