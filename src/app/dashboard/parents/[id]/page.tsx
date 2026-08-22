/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { parents, children, invoices, payments } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import ParentProfileClient from './ParentProfileClient';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import DeleteParentButton from '@/features/parents/components/DeleteParentButton';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ParentPageProps {
    params: Promise<{ id: string }>;
}

export default async function ParentProfilePage({ params }: ParentPageProps) {
    const { id } = await params;
    // Same role rule as the Parents list and the rest of the People module —
    // see project-notes/milestone-3b-parents-audit.md §4. Previously this
    // page only checked for a session, so any authenticated org member
    // (including TUTOR) could view a family's contact details and ledger.
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    const organisationId = (session.user as any).organisationId;

    // 1. Fetch Parent & Children
    const parent = await db.query.parents.findFirst({
        where: and(
            eq(parents.id, id),
            eq(parents.organisationId, organisationId)
        ),
        with: {
            children: true
        }
    });

    if (!parent) return notFound();

    // 2. Fetch Family Invoices (Consolidated Ledger)
    const familyInvoices = await db.query.invoices.findMany({
        where: and(
            eq(invoices.parentId, id),
            eq(invoices.organisationId, organisationId)
        ),
        orderBy: [desc(invoices.createdAt)],
        with: {
            payments: true,
            centre: true,
            child: true
        }
    });

    // 3. Calculate Ledger Stats
    const totalOwed = familyInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalPaid = familyInvoices.reduce((sum, inv) => {
        const paid = inv.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0;
        return sum + paid;
    }, 0);
    const outstanding = totalOwed - totalPaid;

    const fullName = `${parent.firstName} ${parent.lastName}`;
    const initials = `${(parent.firstName || '')[0] ?? ''}${(parent.lastName || '')[0] ?? ''}`.toUpperCase();
    const childCount = parent.children.length;

    return (
        <div className="max-w-4xl mx-auto space-y-5">

            {/* ── Navigation bar ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/parents"
                    className="group inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to parents
                </Link>
                <DeleteParentButton
                    parentId={parent.id}
                    parentName={fullName}
                    childCount={childCount}
                    variant="button"
                />
            </div>

            {/* ── Header card ─────────────────────────────────────────────── */}
            <Card>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                        <span className="text-page-title select-none">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-page-title text-text truncate">{fullName}</h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <Badge>
                                {childCount} {childCount === 1 ? 'child' : 'children'}
                            </Badge>
                            <span className="text-metadata">Family account &amp; ledger</span>
                        </div>
                    </div>

                    {/* Key metrics */}
                    <div className="flex sm:flex-col gap-2 sm:min-w-[150px]">
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata">Balance</span>
                            <span className={outstanding > 0 ? 'text-small-body font-semibold text-danger' : 'text-small-body font-semibold text-text'}>
                                £{outstanding.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata">Total invoiced</span>
                            <span className="text-small-body font-semibold text-text">£{totalOwed.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* ── Tabs & tab content ──────────────────────────────────────── */}
            <ParentProfileClient
                parent={parent}
                invoices={familyInvoices}
                stats={{
                    totalOwed,
                    totalPaid,
                    outstanding
                }}
                isOwner={(session.user as any).role === 'ORG_OWNER'}
            />
        </div>
    );
}
