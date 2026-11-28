'use client';

import { Printer } from 'lucide-react';

export function PrintReceiptButton({ className }: { className?: string }) {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print receipt"
            className={
                className ??
                "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-sm hover:opacity-90 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
            }
        >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Print Receipt</span>
        </button>
    );
}

export default PrintReceiptButton;
