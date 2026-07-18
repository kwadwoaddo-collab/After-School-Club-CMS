'use client';

import { useEffect } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function PortalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Parent Portal Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#111216] text-[#e5e2e1] flex flex-col justify-between pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <header className="bg-[#17191e] border-b border-[#424754]/10 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-wider text-white">Parent Portal</span>
                </div>
            </header>

            {/* Error Content */}
            <main className="flex-1 max-w-md mx-auto px-4 flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight mb-2">We hit a snag</h2>
                <p className="text-sm text-[#8c909f] mb-8 leading-relaxed">
                    Something went wrong while loading this page. This could be due to a temporary connection issue.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <button
                        onClick={reset}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-blue-500/10"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reload Page
                    </button>
                    <Link
                        href="/portal"
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-card/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wider hover:bg-card/10 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Dashboard
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center text-[10px] text-[#8c909f] px-4">
                If you keep seeing this screen, please contact support at support@sprintscaleit.co.uk
            </footer>
        </div>
    );
}
