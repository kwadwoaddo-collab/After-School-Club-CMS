'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { CalendarDays, Clock, User, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { createPortalBooking, reschedulePortalBooking } from './actions';

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
    registeredChildren: Child[];
    centres: Centre[];
    rescheduleBooking?: {
        id: string;
        startAt: Date;
        childId: string;
        centreId: string;
        confirmationCode: string | null;
    } | null;
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

function getSelectableDates(): Date[] {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 1; dates.length < 20 && i <= 56; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() !== 0 && d.getDay() !== 6) {
            dates.push(d);
        }
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

export function BookingFlow({ registeredChildren: childList, centres, rescheduleBooking }: BookingFlowProps) {
    const isRescheduling = !!rescheduleBooking;
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const handleSetStep = (newStep: 1 | 2 | 3) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setStep(newStep);
    };
    const { toast } = useToast();
    // Pre-select child and centre when rescheduling
    const preselectedChild = rescheduleBooking
        ? childList.find(c => c.id === rescheduleBooking.childId) ?? null
        : null;
    const preselectedCentre = rescheduleBooking
        ? centres.find(c => c.id === rescheduleBooking.centreId) ?? (centres.length === 1 ? centres[0] : null)
        : (centres.length === 1 ? centres[0] : null);
    const [selectedChild, setSelectedChild] = useState<Child | null>(preselectedChild);
    const [selectedCentre, setSelectedCentre] = useState<Centre | null>(preselectedCentre);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<number>(60);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ confirmationCode: string } | null>(null);

    const dates = useMemo(() => getSelectableDates(), []);
    const slots = parseSessionSlots(selectedCentre?.sessionSlots ?? null);

    async function handleConfirm() {
        if (!selectedChild || !selectedCentre || !selectedDate || !selectedSlot) return;
        setLoading(true);
        setError(null);
        try {
            let result;
            if (isRescheduling && rescheduleBooking) {
                result = await reschedulePortalBooking({
                    oldBookingId: rescheduleBooking.id,
                    childId: selectedChild.id,
                    centreId: selectedCentre.id,
                    startAt: buildStartAt(selectedDate, selectedSlot),
                    duration: selectedDuration,
                });
            } else {
                result = await createPortalBooking({
                    childId: selectedChild.id,
                    centreId: selectedCentre.id,
                    startAt: buildStartAt(selectedDate, selectedSlot),
                    duration: selectedDuration,
                });
            }
            if (result.success && result.confirmationCode) {
                const msg = isRescheduling ? 'Booking rescheduled successfully!' : 'Booking confirmed successfully!';
                toast({ title: 'Success', message: msg, variant: 'success' });
                setSuccess({ confirmationCode: result.confirmationCode });
            } else {
                const errMsg = result.error || 'Something went wrong.';
                setError(errMsg);
                toast({ title: 'Error', message: errMsg, variant: 'error' });
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'An error occurred.';
            setError(errMsg);
            toast({ title: 'Error', message: errMsg, variant: 'error' });
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
                <h2 className="text-2xl font-bold text-foreground mb-2">
                    {isRescheduling ? 'Booking Rescheduled!' : 'Booking Confirmed!'}
                </h2>
                <p className="text-on-surface-variant mb-8">
                    {isRescheduling
                        ? 'Your old booking has been cancelled and a new one created. Check your email.'
                        : 'A confirmation email has been sent. Please save your code.'}
                </p>
                <div className="bg-primary/10 border-2 border-dashed border-primary/40 rounded-2xl px-8 py-6 mb-8">
                    <p className="text-xs uppercase font-bold text-primary tracking-widest mb-2">Confirmation Code</p>
                    <p className="text-3xl font-black text-foreground tracking-widest font-mono">{success.confirmationCode}</p>
                </div>
                <a
                    href="/portal"
                    className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors"
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
                                ? 'bg-primary text-primary-foreground border-primary'
                                : step > s
                                ? 'bg-tertiary/20 text-tertiary border-tertiary/40'
                                : 'bg-card text-on-surface-variant border-outline-variant/20'
                        }`}>
                            {step > s ? '✓' : s}
                        </div>
                        {s < 3 && (
                            <div className={`flex-1 h-0.5 rounded transition-all ${step > s ? 'bg-tertiary/40' : 'bg-border/30'}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Reschedule context banner */}
            {isRescheduling && rescheduleBooking && (
                <div className="mb-6 flex items-start gap-3 bg-warning/10 border border-warning/20 rounded-2xl px-4 py-3">
                    <span className="text-warning text-lg mt-0.5">📅</span>
                    <div>
                        <p className="text-sm font-bold text-warning">Rescheduling Booking</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                            Original date: <strong className="text-foreground">{new Date(rescheduleBooking.startAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</strong>
                        </p>
                        <p className="text-xs text-on-surface-variant">Pick a new date and time below. Your original booking will be cancelled automatically.</p>
                    </div>
                </div>
            )}

            {/* ─── STEP 1: Pick child (and centre if multiple) ─── */}
            {step === 1 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-6">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-foreground">Who is this booking for?</h2>
                    </div>

                    {childList.length === 0 ? (
                        <div className="bg-card p-8 rounded-xl border border-dashed border-outline-variant/20 text-center">
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
                                            ? 'bg-primary/10 border-primary/40 text-foreground'
                                            : 'bg-card border-outline-variant/10 text-on-surface-variant hover:border-primary/20 hover:text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-foreground">{child.firstName} {child.lastName}</p>
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
                                                ? 'bg-primary/10 border-primary/40 text-foreground'
                                                : 'bg-card border-outline-variant/10 text-on-surface-variant hover:border-primary/20 hover:text-foreground'
                                        }`}
                                    >
                                        <p className="font-bold">{centre.name}</p>
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
                            onClick={() => handleSetStep(2)}
                            disabled={!selectedChild || !selectedCentre}
                            className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
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
                        <h2 className="text-xl font-bold text-foreground">Pick a Date & Time</h2>
                    </div>

                    {/* Date picker */}
                    <div>
                        <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-3">Date</p>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {dates.map((d) => (
                                <button
                                    key={d.toISOString()}
                                    onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                                    className={`min-h-[48px] min-w-[44px] p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                                        selectedDate?.toDateString() === d.toDateString()
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : 'bg-card border-outline-variant/10 text-on-surface-variant hover:border-primary/20 hover:text-foreground'
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
                                                    ? 'bg-primary border-primary text-primary-foreground'
                                                    : 'bg-card border-outline-variant/10 text-on-surface-variant hover:border-primary/20 hover:text-foreground'
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
                                                ? 'bg-secondary border-secondary text-secondary-foreground'
                                                : 'bg-card border-outline-variant/10 text-on-surface-variant hover:border-secondary/20 hover:text-foreground'
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
                            onClick={() => handleSetStep(1)}
                            className="flex items-center gap-2 text-on-surface-variant hover:text-foreground font-bold px-4 py-3 rounded-xl hover:bg-card transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={() => handleSetStep(3)}
                            disabled={!selectedDate || !selectedSlot}
                            className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                        >
                            Review <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </section>
            )}

            {/* ─── STEP 3: Confirm & Book ─── */}
            {step === 3 && selectedChild && selectedCentre && selectedDate && selectedSlot && (
                <section className="space-y-6">
                    <h2 className="text-xl font-bold text-foreground mb-2">Confirm Your Booking</h2>

                    <div className="bg-card rounded-2xl border border-outline-variant/10 divide-y divide-border/10">
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Child</span>
                            <span className="font-bold text-foreground">{selectedChild.firstName} {selectedChild.lastName}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Centre</span>
                            <span className="font-bold text-foreground">{selectedCentre.name}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Date</span>
                            <span className="font-bold text-foreground">{formatDateLabel(selectedDate)}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Time</span>
                            <span className="font-bold text-foreground">{selectedSlot}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Duration</span>
                            <span className="font-bold text-foreground">{selectedDuration} minutes</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-on-surface-variant text-sm">Modality</span>
                            <span className="font-bold text-foreground">In Person</span>
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-on-surface-variant">
                        📋 No payment required now. An invoice will be issued by staff after your session.
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-between">
                        <button
                            onClick={() => handleSetStep(2)}
                            className="flex items-center gap-2 text-on-surface-variant hover:text-foreground font-bold px-4 py-3 rounded-xl hover:bg-card transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl disabled:opacity-60 hover:bg-primary/90 transition-colors"
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
