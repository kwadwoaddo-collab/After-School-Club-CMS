'use client';

import { cn } from '@/components/ui/utils';

interface RegistrationFunnelProps {
    data: {
        new: number;
        approved: number;
    };
    className?: string;
}

export function RegistrationFunnel({ data, className }: RegistrationFunnelProps) {
    const total = data.new + data.approved || 1;
    const newPerc = (data.new / total) * 100;
    const approvedPerc = (data.approved / total) * 100;

    return (
        <div className={cn("space-y-6", className)}>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                <span>Registration Pipeline</span>
                <span className="text-primary">{total} Total</span>
            </div>

            {/* Funnel Bar — 2 real stages: Pending → Approved */}
            <div className="h-4 w-full flex rounded-full overflow-hidden bg-secondary/40 border border-outline-variant/10 p-0.5">
                <div 
                    className="h-full bg-error rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(255,113,108,0.4)]"
                    style={{ width: `${newPerc}%` }}
                />
                <div 
                    className="h-full bg-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(52,211,153,0.4)] ml-0.5"
                    style={{ width: `${approvedPerc}%` }}
                />
            </div>

            {/* Legend — 2 columns only */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-rose-500 tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-error" />
                        Pending Review
                    </span>
                    <span className="text-lg font-black text-white leading-none">{data.new}</span>
                </div>
                <div className="flex flex-col gap-1 border-l border-outline-variant/10 pl-4">
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-400 tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Approved
                    </span>
                    <span className="text-lg font-black text-white leading-none">{data.approved}</span>
                </div>
            </div>
        </div>
    );
}
