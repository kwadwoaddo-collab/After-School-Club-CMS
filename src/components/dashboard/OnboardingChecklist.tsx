'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';

interface ChecklistStep {
    id: string;
    label: string;
    description: string;
    href: string;
    done: boolean;
}

interface OnboardingChecklistProps {
    steps: ChecklistStep[];
}

export default function OnboardingChecklist({ steps }: OnboardingChecklistProps) {
    const [dismissed, setDismissed] = useState(false);
    const done = steps.filter(s => s.done).length;
    const total = steps.length;
    const allDone = done === total;

    if (dismissed || allDone) return null;

    const pct = Math.round((done / total) * 100);

    return (
        <div className="bg-gradient-to-br from-card to-secondary/30 border border-border rounded-[24px] p-6 shadow-sm relative overflow-hidden animate-in fade-in duration-500">
            {/* Background glow */}
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Dismiss */}
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🚀</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-foreground font-bold text-base">Get started with your CMS</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">{done} of {total} steps complete</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-secondary rounded-full mb-5 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-2">
                {steps.map(step => (
                    step.done ? (
                        <div
                            key={step.id}
                            className="flex items-center gap-3 p-3 rounded-xl opacity-50 cursor-default"
                        >
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-muted-foreground line-through">
                                    {step.label}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <Link
                            key={step.id}
                            href={step.href}
                            className="flex items-center gap-3 p-3 rounded-xl transition-all group hover:bg-secondary cursor-pointer"
                        >
                            <Circle className="w-5 h-5 text-muted-foreground/60 flex-shrink-0 group-hover:text-primary transition-colors" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                    {step.label}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary flex-shrink-0 transition-colors" />
                        </Link>
                    )
                ))}
            </div>
        </div>
    );
}
