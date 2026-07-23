/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { parents, children, invoices, payments } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import ParentProfileClient from './ParentProfileClient';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import DeleteParentButton from '@/features/parents/components/DeleteParentButton';

interface ParentPageProps {
    params: Promise<{ id: string }>;
}

export default async function ParentProfilePage({ params }: ParentPageProps) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) return redirect('/login');
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

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header / Navigation */}
            <div>
                <Link 
                    href="/dashboard/parents"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-bold group mb-2 text-xs uppercase tracking-widest active:scale-95 duration-100"
                >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                    Back to Directory
                </Link>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 text-2xl font-black">
                        {(parent.firstName || '')[0] || ''}{(parent.lastName || '')[0] || ''}
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-foreground tracking-tight">
                            {parent.firstName} {parent.lastName}
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            Family Account Profile & Ledger
                        </p>
                    </div>
                </div>
                <DeleteParentButton 
                    parentId={parent.id} 
                    parentName={`${parent.firstName} ${parent.lastName}`} 
                    childCount={parent.children.length} 
                    variant="button" 
                />
            </div>

            {/* Client Component for Tabs & Interaction */}
            <ParentProfileClient 
                parent={parent}
                invoices={familyInvoices}
                stats={{
                    totalOwed,
                    totalPaid,
                    outstanding: totalOwed - totalPaid
                }}
                isOwner={(session.user as any).role === 'ORG_OWNER'}
            />
        </div>
    );
}
