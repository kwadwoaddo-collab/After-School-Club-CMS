'use client';

import { useState } from 'react';
import { CalendarDays, Clock, User, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { createPortalBooking } from './actions';

interface Child {
    id: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
}

interface Centre {
    id: string;
    name: string;
    address: string | null;
    sessionSlots: string | null; // JSON string[]
}

interface BookingFlowProps {
    children: Child[];
    centres: Centre[];
}

const DURATION_OPTIONS = [30, 60, 90];

function parseSessionSlots(raw: string | null): string[] {
    if (!raw) return [];
    try {
        return JSON.parse(raw) as string[];
    } catch {
        return [];
    }
}

// Get next 28 days as selectable dates (skipping days with no slots configured at the centre level — no day-of-week filter for simplicity)
function getSelectableDates(): Date[] {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 28; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function formatDateLabel(d: Date): string {
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function buildStartAt(date: Date, timeSlot: string): string {
    // timeSlot is like "09:00" or "09:00 - 10:00"
    const timePart = timeSlot.split(' - ')[0].trim();
    const [hours, minutes] = timePart.split(':').map(Number);
    const dt = new Date(date);
    dt.setHours(hours, minutes, 0, 0);
    return dt.toISOString();
}

export function BookingFlow({ children: childList, centres }: BookingFlowProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedChild, setSelectedChild] = useState<Child | null>(null);
    const [selectedCentre, setSelectedCentre] = useState<Centre | null>(centres.length === 1 ? centres[0] : null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<number>(60);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ confirmationCode: string } | null>(null);

    const dates = getSelectableDates();
    const slots = parseSessionSlots(selectedCentre?.sessionSlots ?? null);

    async function handleConfirm() {
        if (!selectedChild || !selectedCentre || !selectedDate || !selectedSlot) return;
        setLoading(true);
        setError(null);
        try {
            const result = await createPortalBooking({
                childId: selectedChild.id,
                centreId: selectedCentre.id,
                startAt: buildStartAt(selectedDate, selectedSlot),
                duration: selectedDuration,
            });
            if (result.success && result.confirmationCode) {
                setSuccess({ confirmationCode: result.confirmationCode });
            } else {
                setError(result.error || 'Something went wrong.');
            }
        } finally {
            setLoading(false);
        }
    }

    // Success state
    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 rounded-full bg-tertiary/10 border border-tertiary/30 flex items-center justify-center mb-6 animate-bounce-once">
                    <CheckCircle2 className="w-10 h-10 text-tertiary" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h2>
                <p className="text-on-surface-variant mb-8">A confirmation email has been sent. Please save your code.</p>
                <div className="bg-primary/10 border-2 border-dashed border-primary/40 rounded-2xl px-8 py-6 mb-8">
                    <p className="text-xs uppercase font-bold text-primary tracking-widest mb-2">Confirmation Code</p>
                    <p className="text-3xl font-black text-white tracking-widest font-mono">{success.confirmationCode}</p>
                </div>
                <a
                    href="/portal"
                    className="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors"
                >
                    Back to Portal
                </a>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-all ${
                            step === s
                                ? 'bg-primary text-white border-primary'
                                : step > s
                                ? 'bg-tertiary/20 text-tertiary border-tertiary/40'
                                : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20'
                        }`}>
                            {step > s ? '✓' : s}
                        </div>
                        {s < 3 && (
                            <div className={`flex-1 h-0.5 rounded transition-all ${step > s ? 'bg-tertiary/40' : 'bg-outline-variant/10'}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* ─── STEP 1: Pick child (and centre if multiple) ─── */}
            {step === 1 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-6">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-white">Who is this booking for?</h2>
                    </div>

                    {childList.length === 0 ? (
                        <div className="bg-surface-container-high p-8 rounded-xl border border-dashed border-outline-variant/20 text-center">
                            <p className="text-on-surface-variant">No children registered on your account.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {childList.map(child => (
                                <button
                                    key={child.id}
                                    onClick={() => setSelectedChild(child)}
                                    className={`p-5 rounded-xl border text-left transition-all ${
                                        selectedChild?.id === child.id
                                            ? 'bg-primary/10 border-primary/40 text-white'
                                            : 'bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:border-primary/20 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-white">{child.firstName} {child.lastName}</p>
                                            <p className="text-xs text-on-surface-variant mt-0.5">{child.schoolYear}</p>
                                        </div>
                                        {selectedChild?.id === child.id && (
                                            <CheckCircle2 className="w-5 h-5 text-primary" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {centres.length > 1 && (
                        <div className="mt-6 space-y-3">
                            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Select Centre</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {centres.map(centre => (
                                    <button
                                        key={centre.id}
                                        onClick={() => setSelectedCentre(centre)}
                                        className={`p-4 rounded-xl border text-left transition-all ${
                                            selectedCentre?.id === centre.id
                                                ? 'bg-primary/10 border-primary/40'
                                                : 'bg-surface-container-high border-outline-variant/10 hover:border-primary/20'
                                        }`}
                                    >
                                        <p className="font-bold text-white">{centre.name}</p>
                                        {centre.address && (
                                            <p className="text-xs text-on-surface-variant mt-0.5">{centre.address}</p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end mt-6">
                        <button
                            onClick={() => setStep(2)}
                            disabled={!selectedChild || !selectedCentre}
                            className="flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </section>
            )}

            {/* ─── STEP 2: Pick date + time slot ─── */}
            {step === 2 && (
                <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-white">Pick a Date & Time</h2>
                    </div>

                    {/* Date picker */}
                    <div>
                        <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-3">Date</p>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {dates.map((d) => (
                                <button
                                    key={d.toISOString()}
                                    onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                                    className={`p-2 rounded-xl border text-center transition-all ${
                                        selectedDate?.toDateString() === d.toDateString()
                                            ? 'bg-primary/20 border-primary/50 text-white'
                                            : 'bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:border-primary/20 hover:text-white'
                                    }`}
                                >
                                    <p className="text-[10px] uppercase font-bold">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                                    <p className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</p>
                                    <p className="text-[10px]">{d.toLocaleDateString('en-GB', { month: 'short' })}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time slot picker */}
                    {selectedDate && (
                        <div>
                            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-3">Time Slot</p>
                            {slots.length === 0 ? (
                                <p className="text-on-surface-variant text-sm">No time slots configured for this centre.</p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {slots.map(slot => (
                                        <button
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${
                                                selectedSlot === slot
                                                    ? 'bg-primary/20 border-primary/50 text-white'
                                                    : 'bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:border-primary/20 hover:text-white'
                                            }`}
                                        >
                                            <Clock className="w-3.5 h-3.5 shrink-0" />
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Duration */}
                    {selectedSlot && (
                        <div>
                            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-3">Duration</p>
                            <div className="flex gap-2">
                                {DURATION_OPTIONS.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSelectedDuration(d)}
                                        className={`px-5 py-2 rounded-xl border text-sm font-bold transition-all ${
                                            selectedDuration === d
                                                ? 'bg-secondary/20 border-secondary/50 text-white'
                                                : 'bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:border-secondary/20 hover:text-white'
                                        }`}
                                    >
                                        {d} min
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between mt-6">
                        <button
                            onClick={() => setStep(1)}
                            className="flex items-center gap-2 text-on-surface-variant hover:text-white font-bold px-4 py-3 rounded-xl hover:bg-surface-bright transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={!selectedDate || !selectedSlot}
                            className="flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                        >
                            Review <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </section>
            )}

            {/* ─── STEP 3: Confirm & Book ─── */}
            {step === 3 && selectedChild && selectedCentre && selectedDate && selectedSlot && (
                <section className="space-y-6">
                    <h2 className="text-xl font-bold text-white mb-2">Confirm Your Booking</h2>

                    <div className="bg-surface-container-high rounded-2xl border border-outline-variant/10 divide-y divide-outline-variant/10">
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Child</span>
                            <span className="font-bold text-white">{selectedChild.firstName} {selectedChild.lastName}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Centre</span>
                            <span className="font-bold text-white">{selectedCentre.name}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Date</span>
                            <span className="font-bold text-white">{formatDateLabel(selectedDate)}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Time</span>
                            <span className="font-bold text-white">{selectedSlot}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Duration</span>
                            <span className="font-bold text-white">{selectedDuration} minutes</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Modality</span>
                            <span className="font-bold text-white">In Person</span>
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-on-surface-variant">
                        📋 No payment required now. An invoice will be issued by staff after your session.
                    </div>

                    {error && (
                        <div className="bg-error/10 border border-error/30 text-error rounded-xl p-4 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-between">
                        <button
                            onClick={() => setStep(2)}
                            className="flex items-center gap-2 text-on-surface-variant hover:text-white font-bold px-4 py-3 rounded-xl hover:bg-surface-bright transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="flex items-center gap-2 bg-primary text-white font-bold px-8 py-3 rounded-xl disabled:opacity-60 hover:bg-primary/90 transition-colors"
                        >
                            {loading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</>
                            ) : (
                                <>Confirm Booking <CheckCircle2 className="w-4 h-4" /></>
                            )}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
