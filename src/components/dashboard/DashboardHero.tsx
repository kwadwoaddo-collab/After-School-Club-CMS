'use client';

import { useState, useEffect, ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

interface DashboardHeroProps {
    firstName: string;
    children: ReactNode;
}

export default function DashboardHero({ firstName, children }: DashboardHeroProps) {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Match isScrolled when page scrolls past the banner height (approx 80px)
            setIsScrolled(window.scrollY > 80);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div
            className={cn(
                "transition-all duration-300 ease-in-out",
                isScrolled
                    ? "sticky top-16 sm:top-20 z-30 bg-[#0e0e0f]/90 backdrop-blur-xl border-b border-outline-variant/10 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.4)] mb-6"
                    : "relative overflow-hidden rounded-[32px] bg-gradient-to-r from-surface-container-high via-surface-container-high to-primary/5 p-8 border border-outline-variant/10 shadow-xl mb-2"
            )}
        >
            {/* Backdrop light aura - visible only when expanded */}
            {!isScrolled && (
                <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-in fade-in duration-500" />
            )}

            <div
                className={cn(
                    "flex justify-between items-start gap-6 relative z-10",
                    isScrolled ? "flex-row items-center" : "flex-col md:flex-row md:items-center"
                )}
            >
                <div className={cn("transition-all duration-300", isScrolled ? "scale-95 origin-left" : "")}>
                    {!isScrolled && (
                        <span className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-1.5 block animate-in slide-in-from-top-1 duration-300">
                            After-School Club CMS
                        </span>
                    )}
                    <h1
                        className={cn(
                            "font-extrabold text-white tracking-tight transition-all duration-300",
                            isScrolled ? "text-lg md:text-xl" : "text-3xl md:text-4xl headline-lg"
                        )}
                    >
                        Welcome back{firstName ? `, ${firstName}` : ''}!
                    </h1>
                    {!isScrolled && (
                        <p className="text-on-surface-variant text-sm mt-1 max-w-xl font-medium animate-in fade-in duration-300">
                            Here is a breakdown of your centres, enrolments, and booking activity for today.
                        </p>
                    )}
                </div>

                <div className={cn("transition-all duration-300", isScrolled ? "scale-90 sm:scale-95 origin-right" : "")}>
                    {children}
                </div>
            </div>
        </div>
    );
}
