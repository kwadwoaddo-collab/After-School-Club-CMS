'use client';

import { useState } from 'react';
import { updateAvailability, DayRule } from './actions';
import { ChevronDown, MapPin, Clock, CheckCircle } from '@/components/ui/Icons';
import { cn } from '@/components/ui/utils';
import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

// Common options
const HOURS = Array.from({ length: 25 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
}).flat().slice(0, -1); // 00:00 to 24:00 (exclude 24:00+ if any, but 24 is fine or handle appropriately)

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AvailabilityFormProps {
    centreId: string;
    centreName: string;
    initialRules: DayRule[];
}

export default function AvailabilityForm({ centreId, centreName, initialRules }: AvailabilityFormProps) {
    const router = useRouter();
    const [rules, setRules] = useState<DayRule[]>(initialRules);
    const [isPending, startTransition] = useTransition();
    const [isSuccess, setIsSuccess] = useState(false);

    const handleToggleOpen = (dayIndex: number) => {
        setRules(prev => prev.map(r =>
            r.dayOfWeek === dayIndex ? { ...r, isOpen: !r.isOpen } : r
        ));
    };

    const handleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
        setRules(prev => prev.map(r =>
            r.dayOfWeek === dayIndex ? { ...r, [field]: value } : r
        ));
    };

    const handleSave = async () => {
        startTransition(async () => {
            const result = await updateAvailability(centreId, rules);
            if (result.success) {
                setIsSuccess(true);
                // Wait briefly for the user to see success message, then redirect
                setTimeout(() => {
                    router.push('/dashboard/availability');
                }, 1000);
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-700">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Edit Availability</h1>
                    <p className="text-slate-400 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        Setting hours for <span className="font-bold text-white">{centreName}</span>
                    </p>
                </div>
                <Link href="/dashboard/availability" className="text-sm font-bold text-primary hover:text-blue-400 transition-colors flex items-center gap-1">
                    ← Cancel & Return
                </Link>
            </header>

            <div className="bg-card rounded-2xl shadow-xl border border-outline-variant/10 overflow-hidden">
                <div className="p-6 border-b border-outline-variant/10 bg-card/50">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Weekly Schedule</h2>
                </div>

                <div className="divide-y divide-border">
                    {rules.map((rule) => (
                        <div key={rule.dayOfWeek} className={cn("p-4 flex items-center gap-4 transition-colors", rule.isOpen ? "bg-card-low" : "bg-transparent")}>
                            {/* Day Checkbox */}
                            <div className="w-40 flex items-center gap-3">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={rule.isOpen}
                                        onChange={() => handleToggleOpen(rule.dayOfWeek)}
                                        className="w-5 h-5 rounded border-outline-variant/20 text-primary focus:ring-primary/20 bg-[#13151a] cursor-pointer"
                                    />
                                    <span className={cn("font-bold", rule.isOpen ? "text-white" : "text-slate-500 line-through")}>
                                        {DAYS[rule.dayOfWeek]}
                                    </span>
                                </label>
                            </div>

                            {/* Time Selectors */}
                            <div className="flex-1 flex items-center gap-4">
                                {rule.isOpen ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-400">From</span>
                                            <input
                                                type="time"
                                                value={rule.startTime}
                                                onChange={(e) => handleTimeChange(rule.dayOfWeek, 'startTime', e.target.value)}
                                                className="block w-32 rounded-xl bg-[#13151a] text-white border-[#2a2d35] shadow-sm focus:border-primary focus:ring-primary/20 sm:text-sm p-3 border transition-all"
                                            />
                                        </div>
                                        <span className="text-slate-500 font-bold">→</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-400">To</span>
                                            <input
                                                type="time"
                                                value={rule.endTime}
                                                onChange={(e) => handleTimeChange(rule.dayOfWeek, 'endTime', e.target.value)}
                                                className="block w-32 rounded-xl bg-[#13151a] text-white border-[#2a2d35] shadow-sm focus:border-primary focus:ring-primary/20 sm:text-sm p-3 border transition-all"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-sm text-slate-500 italic font-medium">Closed all day</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-card flex items-center justify-end gap-3 border-t border-outline-variant/10">
                    {isSuccess && (
                        <span className="text-sm text-emerald-400 font-bold flex items-center gap-1 mr-2 animate-pulse">
                            <CheckCircle className="w-5 h-5" />
                            Saved Successfully!
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className={cn(
                            "px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/30 glow-btn hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/20 transition-all",
                            isPending && "opacity-50 cursor-wait bg-[#2a2d35] shadow-none"
                        )}
                    >
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-primary/10 border border-primary/20 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-primary mb-1">What does this do?</h3>
                <p className="text-sm text-primary/80 leading-relaxed font-medium">
                    These define your <strong className="text-primary font-bold">standard operating hours</strong>. When a parent or student tries to book a session,
                    available time slots will only be generated during these windows. If you mark a day as "Closed", no bookings can be made for that day of the week.
                </p>
            </div>
        </div>
    );
}
