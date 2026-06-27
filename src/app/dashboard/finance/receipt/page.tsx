import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function ReceiptIframePage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-center gap-4">
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

            {/* Iframe Card */}
            <div className="bg-[#14161b] border border-[#2a2a2a] rounded-[32px] overflow-hidden shadow-2xl">
                <iframe
                    src="https://assessment-dashboard-5610a.web.app"
                    className="w-full h-[calc(100vh-240px)] min-h-[600px] border-0"
                    allow="clipboard-write"
                    title="Cash Receipt Generator"
                />
            </div>
        </div>
    );
}
