'use client';

import { useState, useEffect, ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';

interface DashboardHeroProps {
    firstName: string;
    orgName?: string;
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
 * action rather than a separate chrome band. Greeting logic, organisation
 * context, and the supporting copy are all preserved — just compacted into
 * a single description line instead of a dedicated hero section.
 */
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
        <PageHeader
            title="Dashboard"
            description={`${displayGreeting}${orgName ? ` · ${orgName}` : ''} — here's how things are looking today.`}
            actions={<div aria-label="Filters KPIs and analytics">{children}</div>}
        />
    );
}
