'use client';

import Link from 'next/link';
import {
    CheckCircle2, Circle, ChevronRight, X,
    User, Building2, Users, Globe, FileText, Share2, CalendarDays
} from 'lucide-react';
import { useState, useEffect } from 'react';

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
            <div className="bg-gradient-to-br from-emerald-500/10 to-primary/10 border border-emerald-500/30 rounded-[24px] p-6 text-center animate-in fade-in duration-500 shadow-sm">
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-lg font-black text-foreground">You&apos;re all set!</h2>
                <p className="text-sm text-muted-foreground mt-1">Your club is live and ready to accept bookings.</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-card to-secondary/20 border border-border rounded-[24px] p-6 shadow-sm relative overflow-hidden animate-in fade-in duration-500">
            {/* Background glow */}
            <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Dismiss */}
            <button
                onClick={handleDismiss}
                id="checklist-dismiss-btn"
                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Dismiss setup guide"
                aria-label="Dismiss setup guide"
            >
                <X className="w-4 h-4" />
            </button>

            {/* Header + progress */}
            <div className="flex items-start gap-4 mb-4 pr-8">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🚀</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-foreground font-bold text-base">Set up your club</h2>
                    <p className="text-muted-foreground text-xs mt-0.5">
                        {completedCount} of {total} steps complete
                    </p>
                </div>
                <span className="text-xs font-black text-primary flex-shrink-0">{pct}%</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-secondary rounded-full mb-5 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-1.5">
                {steps.map(step => {
                    const Icon = STEP_ICONS[step.id] || Circle;
                    const isExpanded = expandedId === step.id;

                    if (step.done) {
                        return (
                            <div
                                key={step.id}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <p className="text-sm font-semibold text-muted-foreground line-through flex-1 min-w-0 truncate">
                                    {step.label}
                                </p>
                            </div>
                        );
                    }

                    return (
                        <div key={step.id} className="rounded-xl overflow-hidden">
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : step.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                                    isExpanded
                                        ? 'bg-primary/10 border border-primary/20'
                                        : 'hover:bg-secondary/60'
                                }`}
                                id={`step-btn-${step.id}`}
                                aria-expanded={isExpanded}
                            >
                                <div className={`w-4 h-4 flex-shrink-0 transition-colors ${isExpanded ? 'text-primary' : 'text-muted-foreground/60'}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <p className={`text-sm font-semibold flex-1 min-w-0 text-left ${isExpanded ? 'text-primary' : 'text-foreground'}`}>
                                    {step.label}
                                </p>
                                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground/40'}`} />
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="px-3 pb-3 pt-1 bg-primary/5 border-x border-b border-primary/20 rounded-b-xl animate-in slide-in-from-top-1 duration-200">
                                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{step.description}</p>
                                    <Link
                                        href={step.href}
                                        id={`step-cta-${step.id}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all"
                                    >
                                        Go to {step.label.split(' ').slice(0, 3).join(' ')}
                                        <ChevronRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
