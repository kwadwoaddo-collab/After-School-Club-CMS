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
        <div className="bg-gradient-to-br from-[#1a1d23] to-[#1e2130] border border-[#adc6ff]/15 rounded-[24px] p-6 shadow-[0_4px_40px_rgba(0,0,0,0.3)] relative overflow-hidden animate-in fade-in duration-500">
            {/* Background glow */}
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#adc6ff]/5 rounded-full blur-3xl pointer-events-none" />

            {/* Dismiss */}
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-[#8c909f] hover:text-white hover:bg-white/5 transition-colors"
                title="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#adc6ff]/10 border border-[#adc6ff]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🚀</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-white font-bold text-base">Get started with your CMS</h2>
                    <p className="text-[#8c909f] text-sm mt-0.5">{done} of {total} steps complete</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/5 rounded-full mb-5 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-[#adc6ff] to-[#4d8eff] rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-2">
                {steps.map(step => (
                    <Link
                        key={step.id}
                        href={step.done ? '#' : step.href}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${step.done
                            ? 'opacity-50 cursor-default'
                            : 'hover:bg-white/5 cursor-pointer'
                            }`}
                        onClick={e => step.done && e.preventDefault()}
                    >
                        {step.done ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        ) : (
                            <Circle className="w-5 h-5 text-[#424754] flex-shrink-0 group-hover:text-[#adc6ff] transition-colors" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${step.done ? 'text-[#8c909f] line-through' : 'text-[#e5e2e1]'}`}>
                                {step.label}
                            </p>
                            {!step.done && (
                                <p className="text-xs text-[#8c909f] mt-0.5">{step.description}</p>
                            )}
                        </div>
                        {!step.done && (
                            <ChevronRight className="w-4 h-4 text-[#424754] group-hover:text-[#adc6ff] flex-shrink-0 transition-colors" />
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}
