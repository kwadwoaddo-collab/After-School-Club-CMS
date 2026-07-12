'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/ui/utils';

interface SegmentedTabControlProps {
    defaultTab: 'overview' | 'activity';
    searchParams: Record<string, string | string[] | undefined>;
}

export function SegmentedTabControl({ defaultTab, searchParams }: SegmentedTabControlProps) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [optimisticTab, setOptimisticTab] = useState<'overview' | 'activity'>(defaultTab);

    const navigate = (tab: 'overview' | 'activity') => {
        if (tab === optimisticTab) return;
        // Layer 1: Immediate UI response (< 16ms) — pill moves before server responds
        setOptimisticTab(tab);
        // Layer 2: Kick off navigation (server round-trip begins in background)
        startTransition(() => {
            const params = new URLSearchParams();
            // Preserve existing search params (centre, date, view etc.)
            Object.entries(searchParams).forEach(([k, v]) => {
                if (k !== 'tab' && v !== undefined) {
                    if (Array.isArray(v)) params.set(k, v[0]);
                    else params.set(k, v);
                }
            });
            params.set('tab', tab);
            router.push(`/dashboard?${params.toString()}`);
        });
    };

    return (
        <div className="flex justify-center my-6 relative z-10">
            <div className="relative inline-flex p-1 bg-secondary/80 dark:bg-[#19191b]/80 backdrop-blur-md rounded-2xl border border-white/[0.06] shadow-lg">
                {/* Sliding active pill — moves INSTANTLY on click */}
                <div
                    aria-hidden="true"
                    className={cn(
                        'absolute top-1 bottom-1 rounded-xl bg-white/10 shadow-sm pointer-events-none',
                        'transition-[left,right] duration-200 ease-out',
                        optimisticTab === 'overview'
                            ? 'left-1 right-[calc(50%+2px)]'
                            : 'left-[calc(50%+2px)] right-1'
                    )}
                />
                <button
                    onClick={() => navigate('overview')}
                    className={cn(
                        'relative z-10 px-5 py-2 rounded-xl text-xs font-bold cursor-pointer select-none',
                        'transition-[color,opacity] duration-150',
                        'active:scale-95 active:opacity-75',
                        optimisticTab === 'overview' ? 'text-white' : 'text-slate-400 hover:text-white'
                    )}
                    aria-pressed={optimisticTab === 'overview'}
                >
                    Overview
                </button>
                <button
                    onClick={() => navigate('activity')}
                    className={cn(
                        'relative z-10 px-5 py-2 rounded-xl text-xs font-bold cursor-pointer select-none',
                        'transition-[color,opacity] duration-150',
                        'active:scale-95 active:opacity-75',
                        optimisticTab === 'activity' ? 'text-white' : 'text-slate-400 hover:text-white'
                    )}
                    aria-pressed={optimisticTab === 'activity'}
                >
                    Activity &amp; Funnel
                </button>
            </div>
        </div>
    );
}
