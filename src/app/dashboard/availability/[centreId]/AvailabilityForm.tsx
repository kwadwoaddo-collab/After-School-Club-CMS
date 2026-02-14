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
        <div className="max-w-4xl mx-auto py-8 px-4">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">Edit Availability</h1>
                    <p className="text-gray-500 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        Setting hours for <span className="font-semibold text-gray-900">{centreName}</span>
                    </p>
                </div>
                <Link href="/dashboard/availability" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                    ← Cancel & Return
                </Link>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Weekly Schedule</h2>
                </div>

                <div className="divide-y divide-gray-100">
                    {rules.map((rule) => (
                        <div key={rule.dayOfWeek} className={cn("p-4 flex items-center gap-4 transition-colors", rule.isOpen ? "bg-white" : "bg-gray-50/30")}>
                            {/* Day Checkbox */}
                            <div className="w-40 flex items-center gap-3">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={rule.isOpen}
                                        onChange={() => handleToggleOpen(rule.dayOfWeek)}
                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className={cn("font-medium", rule.isOpen ? "text-gray-900" : "text-gray-400 line-through")}>
                                        {DAYS[rule.dayOfWeek]}
                                    </span>
                                </label>
                            </div>

                            {/* Time Selectors */}
                            <div className="flex-1 flex items-center gap-4">
                                {rule.isOpen ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">From</span>
                                            <input
                                                type="time"
                                                value={rule.startTime}
                                                onChange={(e) => handleTimeChange(rule.dayOfWeek, 'startTime', e.target.value)}
                                                className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                        <span className="text-gray-300">→</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">To</span>
                                            <input
                                                type="time"
                                                value={rule.endTime}
                                                onChange={(e) => handleTimeChange(rule.dayOfWeek, 'endTime', e.target.value)}
                                                className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-sm text-gray-400 italic">Closed all day</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-200">
                    {isSuccess && (
                        <span className="text-sm text-green-600 font-medium flex items-center gap-1 mr-2 animate-pulse">
                            <CheckCircle className="w-4 h-4" />
                            Saved Successfully!
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className={cn(
                            "px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all",
                            isPending && "opacity-75 cursor-wait"
                        )}
                    >
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">What does this do?</h3>
                <p className="text-sm text-blue-700">
                    These define your <strong>standard operating hours</strong>. When a parent or student tries to book a session,
                    available time slots will only be generated during these windows. If you mark a day as "Closed", no bookings can be made for that day of the week.
                </p>
            </div>
        </div>
    );
}
