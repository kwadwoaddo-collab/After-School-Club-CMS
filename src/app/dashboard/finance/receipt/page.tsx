import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { centres, children } from '@/db/schema';
import ReceiptGeneratorClient from '@/components/finance/ReceiptGeneratorClient';

export default async function ReceiptPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) return redirect('/onboarding');

    // Fetch accessible centres
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, orgId),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    // Fetch all children with parent records for the selection dropdown
    const allChildren = await db.query.children.findMany({
        where: eq(children.organisationId, orgId),
        with: {
            parent: true,
        },
        orderBy: (children, { asc }) => [asc(children.firstName)],
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-center gap-4 no-print">
                <Link
                    href="/dashboard/finance"
                    className="p-2 hover:bg-[#2a2a2a] rounded-2xl transition-all text-[#8c909f] hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Cash Receipt Generator
                    </h1>
                    <p className="text-[#8c909f] font-medium mt-1">
                        Create, print, and download quick cash receipts for parents
                    </p>
                </div>
            </div>

            {/* Main Interactive Work Area */}
            <div className="bg-[#14161b] border border-[#2a2a2a]/40 rounded-[32px] p-6 sm:p-8 shadow-2xl relative">
                <ReceiptGeneratorClient 
                    organisation={{
                        id: orgId,
                        name: session.user.name || 'AfterSchool Club',
                        slug: '',
                    }}
                    centres={orgCentres}
                    children={allChildren}
                />
            </div>
        </div>
    );
}
