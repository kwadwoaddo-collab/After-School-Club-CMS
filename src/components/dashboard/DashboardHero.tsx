'use client';

import { useState, useEffect, ReactNode } from 'react';
import { MapPin, Layers } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface DashboardHeroProps {
    firstName: string;
    orgName?: string;
    centreName?: string;
    isCombinedView?: boolean;
    children: ReactNode;
}

/**
 * Milestone 2 Correction Pass: previously a two-tier "sticky title bar +
 * oversized greeting hero" (text-display heading, standalone org label,
 * separate supporting paragraph) — a treatment InvoiceFlow's authenticated
 * product never uses (it has no marketing-style hero on any dashboard page).
 * Rebuilt on the shared PageHeader primitive so the Dashboard reads as an
 * application page, not a landing screen: one page title, one quiet
 * application-context line, and the date filter presented as a page-header
 * action rather than a separate chrome band. Greeting logic, centre/organisation
 * context, and the supporting copy are all preserved — just compacted into
 * a single description line instead of a dedicated hero section.
 */
export default function DashboardHero({ firstName, orgName, centreName, isCombinedView, children }: DashboardHeroProps) {
    const [greeting, setGreeting] = useState('Hello');

    useEffect(() => {
        const hours = new Date().getHours();
        if (hours < 12) setGreeting('Good morning');
        else if (hours < 17) setGreeting('Good afternoon');
        else setGreeting('Good evening');
    }, []);

    const displayGreeting = firstName ? `${greeting}, ${firstName}` : greeting;
    const contextLabel = centreName || orgName;

    return (
        <PageHeader
            title="Dashboard"
            description={`${displayGreeting}${contextLabel ? ` · ${contextLabel}` : ''} — here's how things are looking today.`}
            actions={
                <div className="flex flex-wrap items-center gap-2" aria-label="Filters KPIs and analytics">
                    {centreName && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-text-secondary">
                            {isCombinedView ? (
                                <Layers className="size-3.5 text-accent flex-shrink-0" aria-hidden="true" />
                            ) : (
                                <MapPin className="size-3.5 text-accent flex-shrink-0" aria-hidden="true" />
                            )}
                            <span>{centreName}</span>
                        </span>
                    )}
                    {children}
                </div>
            }
        />
    );
}
