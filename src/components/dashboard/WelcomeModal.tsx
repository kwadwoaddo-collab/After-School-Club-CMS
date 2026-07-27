'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, Users, BarChart3, ArrowRight } from 'lucide-react';

interface WelcomeModalProps {
    orgName: string;
    ownerName?: string;
}

const STORAGE_KEY = 'sprintscale_welcome_seen';

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
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
        >
            <div className="relative w-full max-w-lg bg-card border border-border rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Decorative gradient top bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-primary via-indigo-400 to-primary/60" />

                {/* Close */}
                <button
                    onClick={dismiss}
                    id="welcome-dismiss"
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Close welcome message"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="p-8">
                    {/* Emoji + greeting */}
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
                            <span className="text-3xl">🎉</span>
                        </div>
                        <h2 id="welcome-title" className="text-2xl font-black text-foreground tracking-tight">
                            Welcome{ownerName ? `, ${ownerName}` : ''}!
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1.5 max-w-xs">
                            <span className="text-primary font-semibold">{orgName}</span> is now live on SprintScale.
                            Let&apos;s get you set up in a few quick steps.
                        </p>
                    </div>

                    {/* Feature highlights */}
                    <div className="space-y-3 mb-8">
                        {features.map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={dismiss}
                        id="welcome-start-btn"
                        className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-primary to-indigo-500 text-white font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                        Start Setup
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-center text-xs text-muted-foreground/60 mt-3">
                        Your checklist is waiting below — takes about 10 minutes
                    </p>
                </div>
            </div>
        </div>
    );
}
