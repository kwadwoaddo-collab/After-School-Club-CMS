import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import FinancePricingForm from '@/components/settings/FinancePricingForm';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
    title: 'Finance & Pricing | Settings',
};

export default async function FinanceSettingsPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    
    // Check role access - Strictly ORG_OWNER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        return redirect('/dashboard');
    }
 
    const orgCentres = await db
        .select({
            id: centres.id,
            name: centres.name,
            feeSelfFinance: centres.feeSelfFinance,
            feeAssistedFinance: centres.feeAssistedFinance,
            bankName: centres.bankName,
            sortCode: centres.sortCode,
            accountNo: centres.accountNo,
            ofstedId: centres.ofstedId,
            managerName: centres.managerName,
            billingPhone: centres.billingPhone,
            billingEmail: centres.billingEmail,
            signatureUrl: centres.signatureUrl,
        })
        .from(centres)
        .where(eq(centres.organisationId, session.user.organisationId))
        .orderBy(centres.name);
 
    // Convert numeric strings to numbers for the client component
    const formattedCentres = orgCentres.map(c => ({
        ...c,
        feeSelfFinance: c.feeSelfFinance ? Number(c.feeSelfFinance) : null,
        feeAssistedFinance: c.feeAssistedFinance ? Number(c.feeAssistedFinance) : null,
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div>
                <Link 
                    href="/dashboard/settings" 
                    className="inline-flex items-center text-sm font-medium text-[#8c909f] hover:text-white transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Settings
                </Link>
                <h1 className="text-3xl font-bold text-white tracking-tight">Finance & Pricing</h1>
                <p className="text-[#8c909f] font-medium mt-1">
                    Manage standard and assisted pricing across your assessment centres
                </p>
            </div>

            <div className="max-w-3xl">
                <FinancePricingForm centres={formattedCentres} />
            </div>
        </div>
    );
}
