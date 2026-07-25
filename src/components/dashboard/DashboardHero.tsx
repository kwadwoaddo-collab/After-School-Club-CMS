'use client';

import { useState, useEffect, ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

interface DashboardHeroProps {
    firstName: string;
    orgName?: string;
    children: ReactNode;
}

export default function DashboardHero({ firstName, orgName, children }: DashboardHeroProps) {
    const [greeting, setGreeting] = useState('Hello');

    useEffect(() => {
        const hours = new Date().getHours();
        if (hours < 12) setGreeting('Good morning');
        else if (hours < 17) setGreeting('Good afternoon');
        else setGreeting('Good evening');
    }, []);

    const displayGreeting = firstName ? `${greeting}, ${firstName}` : greeting;

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Pinned Header */}
            <div className="sticky top-16 sm:top-20 z-30 bg-white dark:bg-slate-900 border-b border-border -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-lg md:text-xl font-extrabold text-foreground tracking-tight">
                        Dashboard
                    </h1>
                </div>
                <div className="flex flex-col items-end">
                    {children}
                    <span className="text-xs text-slate-500 mt-1">
                        Filters KPIs and Analytical charts.
                    </span>
                </div>
            </div>

            {/* Hero Greeting (Static) */}
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-card via-card/95 to-primary/8 p-8 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col gap-2">
                    {orgName && (
                        <span className="text-xs font-semibold text-primary mb-1 block">
                            {orgName}
                        </span>
                    )}
                    <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight headline-lg">
                        {displayGreeting}
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-xl">
                        Here's how things are looking today.
                    </p>
                </div>
            </div>
        </div>
    );
}
