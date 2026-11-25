'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { updateAvailability, DayRule } from './actions';
import { MapPin, CheckCircle } from '@/components/ui/Icons';
import { cn } from '@/components/ui/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AvailabilityFormProps {
    centreId: string;
    centreName: string;
    initialRules: DayRule[];
}

export default function AvailabilityForm({ centreId, centreName, initialRules }: AvailabilityFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [rules, setRules] = useState<DayRule[]>(initialRules);
    const [isPending, startTransition] = useTransition();
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const savingRef = useRef(false);
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setRules(initialRules);
        setIsSuccess(false);
        setErrorMsg(null);
    }, [centreId, initialRules]);

    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) {
                clearTimeout(redirectTimerRef.current);
            }
        };
    }, []);

    const handleToggleOpen = (dayIndex: number) => {
        setErrorMsg(null);
        setRules(prev => prev.map(r =>
            r.dayOfWeek === dayIndex ? { ...r, isOpen: !r.isOpen } : r
        ));
    };

    const handleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
        setErrorMsg(null);
        setRules(prev => prev.map(r =>
            r.dayOfWeek === dayIndex ? { ...r, [field]: value } : r
        ));
    };

    const handleSave = () => {
        if (savingRef.current || isPending || isSuccess) return;
        savingRef.current = true;
        setErrorMsg(null);

        startTransition(async () => {
            try {
                const result = await updateAvailability(centreId, rules);
                if (result.success) {
                    setIsSuccess(true);
                    toast({
                        title: 'Availability saved',
                        message: `Operating hours updated for ${centreName}.`,
                        variant: 'success',
                    });
                    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
                    redirectTimerRef.current = setTimeout(() => {
                        router.push('/dashboard/availability');
                    }, 1000);
                } else {
                    const message = result.error || 'Could not save availability hours. Please check your start and end times.';
                    setErrorMsg(message);
                    toast({ title: 'Could not save hours', message, variant: 'error' });
                    savingRef.current = false;
                }
            } catch {
                const message = 'Something went wrong while saving availability hours. Please try again.';
                setErrorMsg(message);
                toast({ title: 'Could not save hours', message, variant: 'error' });
                savingRef.current = false;
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-700">
            <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground mb-1">Edit Availability</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-accent" />
                        Setting hours for <span className="font-bold text-foreground">{centreName}</span>
                    </p>
                </div>
                <Link
                    href="/dashboard/availability"
                    className="min-h-[44px] inline-flex items-center gap-1 text-sm font-bold text-accent hover:opacity-80 transition-opacity"
                >
                    ← Cancel &amp; Return
                </Link>
            </header>

            {errorMsg && (
                <div
                    role="alert"
                    className="mb-6 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
                >
                    {errorMsg}
                </div>
            )}

            <div className="bg-card rounded-2xl shadow-xl border border-outline-variant/10 overflow-hidden">
                <div className="p-6 border-b border-outline-variant/10 bg-card/50">
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Weekly Schedule</h2>
                </div>

                <div className="divide-y divide-border">
                    {rules.map((rule) => {
                        const dayName = DAYS[rule.dayOfWeek];
                        const startId = `avail-start-${rule.dayOfWeek}`;
                        const endId = `avail-end-${rule.dayOfWeek}`;
                        return (
                            <div
                                key={rule.dayOfWeek}
                                className={cn(
                                    'p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-colors',
                                    rule.isOpen ? 'bg-secondary/40' : 'bg-transparent'
                                )}
                            >
                                {/* Day Checkbox */}
                                <div className="w-full sm:w-40 flex items-center gap-3">
                                    <label className="min-h-[44px] flex items-center gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={rule.isOpen}
                                            onChange={() => handleToggleOpen(rule.dayOfWeek)}
                                            className="w-5 h-5 rounded border-outline-variant/20 text-accent focus:ring-accent/20 bg-secondary cursor-pointer"
                                        />
                                        <span className={cn('font-bold', rule.isOpen ? 'text-foreground' : 'text-muted-foreground line-through')}>
                                            {dayName}
                                        </span>
                                    </label>
                                </div>

                                {/* Time Selectors */}
                                <div className="flex-1 flex flex-wrap items-center gap-2 sm:gap-4">
                                    {rule.isOpen ? (
                                        <>
                                            <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                                <label htmlFor={startId} className="text-sm font-bold text-muted-foreground">
                                                    From
                                                </label>
                                                <input
                                                    id={startId}
                                                    type="time"
                                                    aria-label={`${dayName} opening time`}
                                                    value={rule.startTime}
                                                    onChange={(e) => handleTimeChange(rule.dayOfWeek, 'startTime', e.target.value)}
                                                    className="block w-32 flex-1 sm:flex-none min-h-[44px] rounded-xl bg-secondary text-foreground border-border shadow-sm focus:border-accent focus:ring-accent/20 sm:text-sm p-2.5 border transition-all"
                                                />
                                            </div>
                                            <span className="text-muted-foreground font-bold" aria-hidden="true">→</span>
                                            <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                                <label htmlFor={endId} className="text-sm font-bold text-muted-foreground">
                                                    To
                                                </label>
                                                <input
                                                    id={endId}
                                                    type="time"
                                                    aria-label={`${dayName} closing time`}
                                                    value={rule.endTime}
                                                    onChange={(e) => handleTimeChange(rule.dayOfWeek, 'endTime', e.target.value)}
                                                    className="block w-32 flex-1 sm:flex-none min-h-[44px] rounded-xl bg-secondary text-foreground border-border shadow-sm focus:border-accent focus:ring-accent/20 sm:text-sm p-2.5 border transition-all"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-sm text-muted-foreground italic font-medium">Closed all day</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-card flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/10">
                    {isSuccess && (
                        <span role="status" className="text-sm text-success font-bold flex items-center gap-1 mr-2 animate-pulse">
                            <CheckCircle className="w-5 h-5" />
                            Saved Successfully!
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isPending || isSuccess}
                        className={cn(
                            'min-h-[44px] px-8 py-3 bg-accent text-on-accent rounded-2xl font-bold shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-all',
                            (isPending || isSuccess) && 'opacity-50 cursor-wait shadow-none'
                        )}
                    >
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-accent-soft border border-accent/20 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-accent mb-1">What does this do?</h3>
                <p className="text-sm text-text-secondary leading-relaxed font-medium">
                    These define your <strong className="text-foreground font-bold">standard operating hours</strong>. When a parent or student tries to book a session,
                    available time slots will only be generated during these windows. If you mark a day as &quot;Closed&quot;, no bookings can be made for that day of the week.
                </p>
            </div>
        </div>
    );
}
