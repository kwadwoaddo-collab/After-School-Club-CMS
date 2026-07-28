'use client';

import { ChevronLeft } from 'lucide-react';

export default function BackButton() {
    return (
        <button 
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-foreground text-sm font-medium transition-colors mb-8 group bg-transparent border-none p-0 cursor-pointer"
        >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            All Registrations
        </button>
    );
}
