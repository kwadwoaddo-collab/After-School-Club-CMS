'use client';

import Link from 'next/link';
import {
    CheckCircle2, Circle, ChevronRight, X,
    User, Building2, Users, Globe, FileText, Share2, CalendarDays
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface ChecklistStep {
    id: string;
    label: string;
    description: string;
    href: string;
    done: boolean;
}

interface OnboardingChecklistProps {
    steps: ChecklistStep[];
    completedCount: number;
}

const DISMISSED_KEY = 'sprintscale_checklist_dismissed';

const STEP_ICONS: Record<string, React.ElementType> = {
    'org-info': User,
    'first-centre': Building2,
    'invite-staff': Users,
    'set-subdomain': Globe,
    'registration-terms': FileText,
    'share-form': Share2,
    'first-booking': CalendarDays,
};

/**
 * Milestone 2 Correction Pass: this component's LOGIC is unchanged — same
 * progress tracking, auto-expand of the first incomplete step, dismissal
 * persistence, and completion celebration. Only the presentation changed:
 * the oversized rounded-[24px] outer card, background glow blur, primary/blue
 * gradients, and deeply-nested bordered expansion panel have been replaced
 * with InvoiceFlow-aligned flat surfaces, restrained accent usage, smaller
 * radii, and the shared Button primitive for the step CTA.
 */
export default function OnboardingChecklist({ steps, completedCount }: OnboardingChecklistProps) {
    const [dismissed, setDismissed] = useState(false);
    const [celebrating, setCelebrating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const total = steps.length;
    const allDone = completedCount === total;
    const pct = Math.round((completedCount / total) * 100);

    // Auto-expand the first incomplete step
    useEffect(() => {
        const firstPending = steps.find(s => !s.done);
        if (firstPending && !expandedId) setExpandedId(firstPending.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Check if previously dismissed
    useEffect(() => {
        try {
            if (localStorage.getItem(DISMISSED_KEY)) setDismissed(true);
        } catch { /* noop */ }
    }, []);

    // Trigger celebration when all done
    useEffect(() => {
        if (allDone) {
            setCelebrating(true);
            const t = setTimeout(() => {
                try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* noop */ }
                setDismissed(true);
            }, 4000);
            return () => clearTimeout(t);
        }
    }, [allDone]);

    const handleDismiss = () => {
        try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* noop */ }
        setDismissed(true);
    };

    if (dismissed) return null;

    if (celebrating) {
        return (
            <div className="rounded-lg border border-border bg-surface p-5 text-center animate-in fade-in duration-500">
                <div className="text-3xl mb-2">🎉</div>
                <h2 className="text-section-title text-text">You&apos;re all set!</h2>
                <p className="text-small-body text-text-secondary mt-1">Your club is live and ready to accept bookings.</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border bg-surface p-5 relative animate-in fade-in duration-500">
            {/* Dismiss */}
            <button
                onClick={handleDismiss}
                id="checklist-dismiss-btn"
                className="absolute top-3 right-3 p-1.5 rounded-md text-text-muted hover:text-text hover:bg-page transition-colors"
                title="Dismiss setup guide"
                aria-label="Dismiss setup guide"
            >
                <X className="size-4" />
            </button>

            {/* Header + progress */}
            <div className="flex items-start gap-3 mb-4 pr-8">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft">
                    <span className="text-base">🚀</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-text font-semibold text-sm">Set up your club</h2>
                    <p className="text-text-muted text-xs mt-0.5">
                        {completedCount} of {total} steps complete
                    </p>
                </div>
                <span className="text-xs font-semibold text-accent flex-shrink-0">{pct}%</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-page rounded-full mb-4 overflow-hidden">
                <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-0.5">
                {steps.map(step => {
                    const Icon = STEP_ICONS[step.id] || Circle;
                    const isExpanded = expandedId === step.id;

                    if (step.done) {
                        return (
                            <div
                                key={step.id}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-md opacity-60"
                            >
                                <CheckCircle2 className="size-4 text-success flex-shrink-0" />
                                <p className="text-sm text-text-secondary line-through flex-1 min-w-0 truncate">
                                    {step.label}
                                </p>
                            </div>
                        );
                    }

                    return (
                        <div key={step.id} className="rounded-md">
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : step.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-left ${
                                    isExpanded
                                        ? 'bg-accent-soft'
                                        : 'hover:bg-page'
                                }`}
                                id={`step-btn-${step.id}`}
                                aria-expanded={isExpanded}
                            >
                                <Icon className={`size-4 flex-shrink-0 transition-colors ${isExpanded ? 'text-accent' : 'text-text-muted'}`} />
                                <p className={`text-sm font-medium flex-1 min-w-0 text-left ${isExpanded ? 'text-accent' : 'text-text'}`}>
                                    {step.label}
                                </p>
                                <ChevronRight className={`size-4 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-accent' : 'text-text-muted'}`} />
                            </button>

                            {/* Expanded content — no nested bordered panel, just indented copy + CTA */}
                            {isExpanded && (
                                <div className="px-3 pb-3 pt-1.5 animate-in slide-in-from-top-1 duration-200">
                                    <p className="text-xs text-text-secondary mb-2.5 leading-relaxed">{step.description}</p>
                                    <Button asChild size="sm" id={`step-cta-${step.id}`}>
                                        <Link href={step.href}>
                                            Go to {step.label.split(' ').slice(0, 3).join(' ')}
                                            <ChevronRight className="size-3.5" />
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
