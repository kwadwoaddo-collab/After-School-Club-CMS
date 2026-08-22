'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, Users, BarChart3, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface WelcomeModalProps {
    orgName: string;
    ownerName?: string;
}

const STORAGE_KEY = 'sprintscale_welcome_seen';

/**
 * Milestone 2 Correction Pass: logic unchanged (once-per-browser visibility,
 * dismissal persistence). Presentation rebuilt to match the flatter,
 * restrained-accent, smaller-radii treatment applied to OnboardingChecklist —
 * this modal is part of the same first-run onboarding surface and was
 * carrying the same gradient/glow/blur old-CMS language.
 */
export default function WelcomeModal({ orgName, ownerName }: WelcomeModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Only show once per browser
        try {
            const seen = localStorage.getItem(STORAGE_KEY);
            if (!seen) setVisible(true);
        } catch {
            // Private browsing — show anyway
            setVisible(true);
        }
    }, []);

    const dismiss = () => {
        try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* noop */ }
        setVisible(false);
    };

    if (!visible) return null;

    const features = [
        { icon: BookOpen, label: 'Manage bookings & registrations', desc: 'Accept sessions, track payments, and manage your register.' },
        { icon: Users, label: 'Organise your team & students', desc: 'Invite staff, track attendance, and manage parent accounts.' },
        { icon: BarChart3, label: 'Run reports & insights', desc: 'See revenue, attendance trends, and activity across all centres.' },
    ];

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50"
            onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
        >
            <div className="relative w-full max-w-md bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Close */}
                <button
                    onClick={dismiss}
                    id="welcome-dismiss"
                    className="absolute top-3 right-3 p-1.5 rounded-md text-text-muted hover:text-text hover:bg-page transition-colors"
                    aria-label="Close welcome message"
                >
                    <X className="size-4" />
                </button>

                <div className="p-6">
                    {/* Emoji + greeting */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent-soft mb-3">
                            <span className="text-2xl">🎉</span>
                        </div>
                        <h2 id="welcome-title" className="text-lg font-semibold text-text">
                            Welcome{ownerName ? `, ${ownerName}` : ''}!
                        </h2>
                        <p className="text-text-secondary text-sm mt-1.5 max-w-xs">
                            <span className="text-accent font-medium">{orgName}</span> is now live on SprintScale.
                            Let&apos;s get you set up in a few quick steps.
                        </p>
                    </div>

                    {/* Feature highlights */}
                    <div className="space-y-2 mb-6">
                        {features.map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="flex items-start gap-3 p-3 rounded-md border border-border bg-page">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft mt-0.5">
                                    <Icon className="size-4 text-accent" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-text">{label}</p>
                                    <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <Button onClick={dismiss} id="welcome-start-btn" className="w-full">
                        Start Setup
                        <ArrowRight className="size-4" />
                    </Button>
                    <p className="text-center text-xs text-text-muted mt-3">
                        Your checklist is waiting below — takes about 10 minutes
                    </p>
                </div>
            </div>
        </div>
    );
}
