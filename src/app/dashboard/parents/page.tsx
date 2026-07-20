import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { parents, children, invoices, payments } from '@/db/schema';
import { eq, and, desc, ilike, or, sum, count, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Users, Mail, Phone, ChevronRight, Search, AlertCircle, PoundSterling, Baby } from 'lucide-react';
import HeaderPortal from '@/components/dashboard/HeaderPortal';

interface Props {
    searchParams: Promise<{ search?: string }>;
}

function getInitials(firstName: string, lastName: string) {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

function getAvatarGradient(name: string) {
    const gradients = [
        'from-blue-500 to-indigo-600',
        'from-violet-500 to-purple-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-rose-500 to-pink-600',
        'from-cyan-500 to-sky-600',
    ];
    const idx = name.charCodeAt(0) % gradients.length;
    return gradients[idx];
}

export default async function ParentsPage({ searchParams }: Props) {
    const rawParams = await searchParams;
    const search = rawParams.search?.trim() ?? '';

    const session = await auth();
    if (!session?.user) return redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) return redirect('/onboarding');

    // Fetch parents with child counts and outstanding balance
    const allParents = await db.execute(sql`
        WITH ChildCounts AS (
            SELECT parent_id, COUNT(*) as child_count
            FROM children
            WHERE organisation_id = ${orgId}
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
            GROUP BY i.parent_id
        )
        SELECT
            pa.id,
            pa.first_name,
            pa.last_name,
            pa.email,
            pa.phone,
            pa.preferred_contact,
            pa.created_at,
            COALESCE(cc.child_count, 0) as child_count,
            COALESCE(ins.total_invoiced, 0) as total_invoiced,
            COALESCE(ins.total_paid, 0) as total_paid,
            GREATEST(0, COALESCE(ins.total_invoiced, 0) - COALESCE(ins.total_paid, 0)) as outstanding
        FROM parents pa
        LEFT JOIN ChildCounts cc ON pa.id = cc.parent_id
        LEFT JOIN InvoiceSummary ins ON pa.id = ins.parent_id
        WHERE pa.organisation_id = ${orgId}
        ${search ? sql`AND (
            pa.first_name ILIKE ${'%' + search + '%'} OR
            pa.last_name ILIKE ${'%' + search + '%'} OR
            pa.email ILIKE ${'%' + search + '%'} OR
            pa.phone ILIKE ${'%' + search + '%'}
        )` : sql``}
        ORDER BY pa.last_name ASC, pa.first_name ASC
    `);

    const rows = allParents as unknown as Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        preferred_contact: string;
        created_at: string;
        child_count: number;
        total_invoiced: number;
        total_paid: number;
        outstanding: number;
    }>;

    // Split into families WITH children vs orphaned parent records (0 children)
    const familyRows = rows.filter(r => Number(r.child_count) > 0);
    const orphanedRows = rows.filter(r => Number(r.child_count) === 0);

    const totalFamilies = familyRows.length;
    const totalChildren = familyRows.reduce((s, r) => s + Number(r.child_count), 0);
    const withOutstanding = familyRows.filter(r => Number(r.outstanding) > 0).length;
    const totalOutstanding = familyRows.reduce((s, r) => s + Number(r.outstanding), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header portal */}
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">Parents</h1>
                    <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground text-[10px] font-bold">
                        {totalFamilies}
                    </span>
                </div>
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

            {/* Search */}
            <form method="GET" className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    name="search"
                    defaultValue={search}
                    placeholder="Search by name, email or phone…"
                    className="w-full h-11 pl-10 pr-4 rounded-2xl bg-card border border-border text-foreground text-sm font-medium
                               placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                />
            </form>

            {/* Parent list */}
            {familyRows.length === 0 && orphanedRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-dashed border-border rounded-3xl">
                    <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4 text-3xl">👪</div>
                    <h3 className="text-foreground font-bold mb-2">
                        {search ? 'No parents match your search' : 'No parents yet'}
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                        {search
                            ? 'Try clearing your search or checking the spelling.'
                            : 'Parents are automatically created when a student is registered.'}
                    </p>
                    {search && (
                        <Link href="/dashboard/parents" className="mt-4 text-sm text-primary font-bold hover:underline">
                            Clear search
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Families WITH children */}
                    {familyRows.length > 0 && (
                        <div className="bg-card border border-border rounded-[32px] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="py-4 px-6 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Parent / Family</th>
                                            <th className="py-4 px-6 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Contact</th>
                                            <th className="py-4 px-4 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">Children</th>
                                            <th className="py-4 px-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Outstanding</th>
                                            <th className="py-4 px-4 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {familyRows.map((parent) => {
                                            const fullName = `${parent.first_name} ${parent.last_name}`;
                                            const initials = getInitials(parent.first_name, parent.last_name);
                                            const gradient = getAvatarGradient(parent.first_name);
                                            const outstanding = Number(parent.outstanding);
                                            const childCount = Number(parent.child_count);

                                            return (
                                                <tr
                                                    key={parent.id}
                                                    className="group hover:bg-secondary/40 transition-colors cursor-pointer"
                                                >
                                                    <td className="py-4 px-6">
                                                        <Link href={`/dashboard/parents/${parent.id}`} className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-sm`}>
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                                    {fullName}
                                                                </p>
                                                                {parent.email && (
                                                                    <p className="text-xs text-muted-foreground">{parent.email}</p>
                                                                )}
                                                            </div>
                                                        </Link>
                                                    </td>
                                                    <td className="py-4 px-6 hidden md:table-cell">
                                                        <div className="space-y-0.5">
                                                            {parent.phone && (
                                                                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                                                    <Phone className="w-3 h-3 text-muted-foreground" />
                                                                    {parent.phone}
                                                                </p>
                                                            )}
                                                            {parent.email && (
                                                                <p className="text-xs font-medium text-foreground flex items-center gap-1.5 md:hidden lg:flex">
                                                                    <Mail className="w-3 h-3 text-muted-foreground" />
                                                                    {parent.email}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-xl text-xs font-black border ${
                                                            childCount >= 2
                                                                ? 'bg-success/10 text-success border-success/20'
                                                                : 'bg-primary/10 text-primary border-primary/20'
                                                        }`}>
                                                            {childCount}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4 text-right hidden sm:table-cell">
                                                        {outstanding > 0 ? (
                                                            <span className="text-sm font-black text-destructive">
                                                                £{outstanding.toFixed(2)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground font-medium">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <Link href={`/dashboard/parents/${parent.id}`}>
                                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-6 py-3 border-t border-border bg-secondary/20">
                                <p className="text-xs text-muted-foreground font-medium">
                                    {familyRows.length} famil{familyRows.length !== 1 ? 'ies' : 'y'} · {totalChildren} child{totalChildren !== 1 ? 'ren' : ''} {search ? `matching "${search}"` : 'total'} · Sorted A–Z by surname
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Orphaned parent records (no children linked) */}
                    {orphanedRows.length > 0 && !search && (
                        <details className="group">
                            <summary className="flex items-center gap-2 cursor-pointer list-none px-1 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors select-none">
                                <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                                {orphanedRows.length} incomplete registration{orphanedRows.length !== 1 ? 's' : ''} (no children linked)
                            </summary>
                            <div className="mt-2 bg-card border border-dashed border-border rounded-[28px] overflow-hidden opacity-60">
                                <table className="w-full">
                                    <tbody className="divide-y divide-border">
                                        {orphanedRows.map((parent) => {
                                            const fullName = `${parent.first_name} ${parent.last_name}`;
                                            const initials = getInitials(parent.first_name, parent.last_name);
                                            return (
                                                <tr key={parent.id} className="group/row hover:bg-secondary/40 transition-colors">
                                                    <td className="py-3 px-6">
                                                        <Link href={`/dashboard/parents/${parent.id}`} className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-xs font-black text-muted-foreground flex-shrink-0">
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-muted-foreground">{fullName}</p>
                                                                {parent.email && <p className="text-xs text-muted-foreground/70">{parent.email}</p>}
                                                            </div>
                                                        </Link>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">No children</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
