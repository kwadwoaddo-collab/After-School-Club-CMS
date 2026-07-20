import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { parents, children } from '@/db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';
import { Archive, Trash2, ArrowLeft, Clock } from 'lucide-react';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import Link from 'next/link';
import BinActions from '@/components/parents/BinActions';
import { purgeStaleBinItems } from '../bin.actions';

export default async function BinPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) return redirect('/onboarding');

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
        <div className="space-y-8 animate-in fade-in duration-700">
            <HeaderPortal targetId="header-right-actions">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/parents" className="p-2 bg-secondary text-muted-foreground hover:bg-secondary/80 rounded-xl transition-all active:scale-90 duration-100">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">Recovery Bin</h1>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold">
                            Items are permanently deleted after 30 days
                        </p>
                    </div>
                </div>
            </HeaderPortal>

            {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-3xl shadow-sm text-center">
                    <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4">
                        <Archive className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-1">Bin is empty</h3>
                    <p className="text-muted-foreground">No recently deleted items found.</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Family</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Children</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Deleted On</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Expires In</th>
                                    <th className="px-6 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((row) => {
                                    const deletedDate = new Date(row.deleted_at);
                                    const expiryDate = new Date(deletedDate);
                                    expiryDate.setDate(expiryDate.getDate() + 30);
                                    
                                    const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                    const isExpiringSoon = daysLeft <= 3;

                                    return (
                                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-foreground">{row.first_name} {row.last_name}</div>
                                                <div className="text-xs text-muted-foreground">{row.email || 'No email'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-bold">
                                                    {row.child_count} children
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground font-medium">
                                                {deletedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${
                                                    isExpiringSoon ? 'text-destructive bg-destructive/10' : 'text-warning bg-warning/10'
                                                }`}>
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {daysLeft} days
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <BinActions parentId={row.id} parentName={`${row.first_name} ${row.last_name}`} />
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
