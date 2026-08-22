'use client';

import { useState, useEffect, ReactNode } from 'react';

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
        <div className="flex flex-col gap-5 w-full">
            {/* Pinned page header */}
            <div className="sticky top-16 sm:top-20 z-30 bg-surface border-b border-border -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-page-title text-text">Dashboard</h1>
                <div className="flex flex-col items-end">
                    {children}
                    <span className="text-metadata mt-1">Filters KPIs and analytics</span>
                </div>
            </div>

            {/* Greeting */}
            <div className="flex flex-col gap-1">
                {orgName && <span className="text-label text-accent">{orgName}</span>}
                <h2 className="text-display text-text">{displayGreeting}</h2>
                <p className="text-small-body text-text-secondary">Here&apos;s how things are looking today.</p>
            </div>
        </div>
    );
}
