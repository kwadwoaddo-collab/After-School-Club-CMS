'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { CalendarDays, Clock, User, CheckCircle2, ChevronRight, ChevronLeft, Loader2, MapPin, Calendar, ClipboardCheck } from 'lucide-react';
import { formatSchoolYearLabel } from '@/lib/school-year';
import { createPortalBooking, reschedulePortalBooking } from './actions';

export type CanonicalWeekday = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

const CANONICAL_WEEKDAYS: readonly CanonicalWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface PortalSessionSlotObject {
    id?: string;
    time?: string;
    startTime?: string;
    endTime?: string;
    label?: string;
    name?: string;
    daysActive?: Array<string | number>;
    days?: Array<string | number>;
}

export type RawPortalSessionSlot = string | PortalSessionSlotObject;

export interface NormalizedPortalSessionSlot {
    id: string;
    time: string;
    label?: string;
    daysActive?: CanonicalWeekday[];
}

interface Child {
    id: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    centreId?: string | null;
}

interface Centre {
    id: string;
    name: string;
    address: string | null;
    sessionSlots: string | RawPortalSessionSlot[] | null;
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

function normalizeDayToken(day: unknown): CanonicalWeekday | null {
    if (typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6) {
        return CANONICAL_WEEKDAYS[day];
    }
    if (typeof day !== 'string') return null;
    const cleaned = day.trim().toLowerCase();
    if (!cleaned) return null;
    if (/^[0-6]$/.test(cleaned)) {
        return CANONICAL_WEEKDAYS[Number(cleaned)];
    }
    if (cleaned.startsWith('sun')) return 'Sun';
    if (cleaned.startsWith('mon')) return 'Mon';
    if (cleaned.startsWith('tue')) return 'Tue';
    if (cleaned.startsWith('wed')) return 'Wed';
    if (cleaned.startsWith('thu')) return 'Thu';
    if (cleaned.startsWith('fri')) return 'Fri';
    if (cleaned.startsWith('sat')) return 'Sat';
    return null;
}

function resolveSelectedWeekday(selectedDateInput?: string | Date | null): CanonicalWeekday | null {
    if (!selectedDateInput) return null;
    if (selectedDateInput instanceof Date) {
        return Number.isNaN(selectedDateInput.getTime())
            ? null
            : CANONICAL_WEEKDAYS[selectedDateInput.getDay()];
    }
    if (typeof selectedDateInput !== 'string') return null;
    const trimmed = selectedDateInput.trim();
    if (!trimmed) return null;

    // Parse calendar YYYY-MM-DD in local calendar coordinates to avoid UTC midnight shift.
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoDateMatch) {
        const [, yearStr, monthStr, dayStr] = isoDateMatch;
        const localDate = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
        return Number.isNaN(localDate.getTime())
            ? null
            : CANONICAL_WEEKDAYS[localDate.getDay()];
    }

    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
        return CANONICAL_WEEKDAYS[parsedDate.getDay()];
    }

    return normalizeDayToken(trimmed);
}

function formatLocalIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * JC-01: Normalizes centre `sessionSlots` stored either as legacy `string[]`
 * (e.g. `["15:30", "17:00"]`) or structured `SessionSlot[]` objects
 * (e.g. `{ time, label, daysActive }` or `{ startTime, name, daysActive }`).
 * Never returns raw objects that could crash React child rendering.
 */
export function normalizePortalSessionSlots(
    rawSlots: unknown,
    selectedDateStr?: string | Date | null
): NormalizedPortalSessionSlot[] {
    if (!rawSlots) return [];

    let parsed: unknown = rawSlots;
    if (typeof rawSlots === 'string') {
        try {
            parsed = JSON.parse(rawSlots);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(parsed)) return [];

    const targetWeekday = resolveSelectedWeekday(selectedDateStr);
    const normalized: NormalizedPortalSessionSlot[] = [];

    parsed.forEach((entry, index) => {
        if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (!trimmed) return;
            normalized.push({
                id: `slot-${index}-${trimmed}`,
                time: trimmed,
            });
            return;
        }

        if (!entry || typeof entry !== 'object') return;

        const obj = entry as PortalSessionSlotObject;
        const rawTime =
            typeof obj.time === 'string' && obj.time.trim()
                ? obj.time.trim()
                : typeof obj.startTime === 'string' && obj.startTime.trim()
                ? obj.startTime.trim()
                : '';

        if (!rawTime) return;

        const cleanTime = /^\d{2}:\d{2}:\d{2}$/.test(rawTime) ? rawTime.slice(0, 5) : rawTime;

        const rawLabel =
            typeof obj.label === 'string' && obj.label.trim()
                ? obj.label.trim()
                : typeof obj.name === 'string' && obj.name.trim()
                ? obj.name.trim()
                : undefined;

        const label = rawLabel && rawLabel !== cleanTime ? rawLabel : undefined;

        const rawDays = Array.isArray(obj.daysActive)
            ? obj.daysActive
            : Array.isArray(obj.days)
            ? obj.days
            : undefined;

        let daysActive: CanonicalWeekday[] | undefined;
        if (rawDays && rawDays.length > 0) {
            const mappedDays = Array.from(
                new Set(rawDays.map(normalizeDayToken).filter((d): d is CanonicalWeekday => d !== null))
            );
            if (mappedDays.length > 0) {
                daysActive = mappedDays;
                if (targetWeekday && !daysActive.includes(targetWeekday)) {
                    return;
                }
            }
        }

        const id =
            typeof obj.id === 'string' && obj.id.trim()
                ? obj.id.trim()
                : `slot-${index}-${cleanTime}-${label ?? ''}`;

        normalized.push({
            id,
            time: cleanTime,
            ...(label ? { label } : {}),
            ...(daysActive ? { daysActive } : {}),
        });
    });

    return normalized;
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
        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setStep(newStep);
    };
    const { toast } = useToast();
    // Pre-select child and centre when rescheduling or when there is a single child/centre
    const preselectedChild = rescheduleBooking
        ? childList.find(c => c.id === rescheduleBooking.childId) ?? null
        : (childList.length === 1 ? childList[0] : null);
    const preselectedCentre = rescheduleBooking
        ? centres.find(c => c.id === rescheduleBooking.centreId) ?? (centres.length === 1 ? centres[0] : null)
        : (preselectedChild?.centreId
            ? centres.find(c => c.id === preselectedChild.centreId) ?? (centres.length === 1 ? centres[0] : null)
            : (centres.length === 1 ? centres[0] : null));
    const [selectedChild, setSelectedChild] = useState<Child | null>(preselectedChild);
    const [selectedCentre, setSelectedCentre] = useState<Centre | null>(preselectedCentre);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<number>(60);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ confirmationCode: string } | null>(null);

    const dates = useMemo(() => getSelectableDates(), []);
    const selectedDateStr = selectedDate ? formatLocalIsoDate(selectedDate) : undefined;
    const slots = useMemo(
        () => normalizePortalSessionSlots(selectedCentre?.sessionSlots ?? null, selectedDateStr),
        [selectedCentre?.sessionSlots, selectedDateStr]
    );

    function handleSelectChild(child: Child) {
        setSelectedChild(child);
        if (child.centreId) {
            const matchedCentre = centres.find(c => c.id === child.centreId);
            if (matchedCentre && matchedCentre.id !== selectedCentre?.id) {
                setSelectedCentre(matchedCentre);
                setSelectedTime(null);
                setSelectedSlotId(null);
            }
        }
    }

    async function handleConfirm() {
        if (!selectedChild || !selectedCentre || !selectedDate || !selectedTime) return;
        setLoading(true);
        setError(null);
        try {
            let result;
            if (isRescheduling && rescheduleBooking) {
                result = await reschedulePortalBooking({
                    oldBookingId: rescheduleBooking.id,
                    childId: selectedChild.id,
                    centreId: selectedCentre.id,
                    startAt: buildStartAt(selectedDate, selectedTime),
                    duration: selectedDuration,
                });
            } else {
                result = await createPortalBooking({
                    childId: selectedChild.id,
                    centreId: selectedCentre.id,
                    startAt: buildStartAt(selectedDate, selectedTime),
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
                <div className="w-20 h-20 rounded-full bg-[var(--if-success-soft,#f0fdf4)] border border-[var(--if-success,#166534)]/30 flex items-center justify-center mb-6 transition-transform duration-300">
                    <CheckCircle2 className="w-10 h-10 text-[var(--if-success,#166534)]" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold text-text mb-2">
                    {isRescheduling ? 'Booking Rescheduled!' : 'Booking Confirmed!'}
                </h2>
                <p className="text-text-muted mb-8">
                    {isRescheduling
                        ? 'Your old booking has been cancelled and a new one created. Check your email.'
                        : 'A confirmation email has been sent. Please save your code.'}
                </p>
                <div className="bg-accent-soft border-2 border-dashed border-accent/40 rounded-2xl px-8 py-6 mb-8">
                    <p className="text-xs uppercase font-bold text-accent tracking-widest mb-2">Confirmation Code</p>
                    <p className="text-3xl font-black text-text tracking-widest font-mono">{success.confirmationCode}</p>
                </div>
                <a
                    href="/portal"
                    className="bg-accent text-on-accent font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-colors"
                >
                    Back to Portal
                </a>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 pb-28 sm:pb-8">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-all ${
                            step === s
                                ? 'bg-accent text-on-accent border-accent shadow-sm'
                                : step > s
                                ? 'bg-accent-soft text-accent border-accent/40'
                                : 'bg-surface text-text-muted border-border'
                        }`}>
                            {step > s ? '✓' : s}
                        </div>
                        {s < 3 && (
                            <div className={`flex-1 h-0.5 rounded transition-all ${step > s ? 'bg-accent' : 'bg-border'}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Reschedule context banner */}
            {isRescheduling && rescheduleBooking && (
                <div className="mb-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
                    <Calendar className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-bold text-warning">Rescheduling Booking</p>
                        <p className="text-xs text-text-muted mt-0.5">
                            Original date: <strong className="text-text">{new Date(rescheduleBooking.startAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</strong>
                        </p>
                        <p className="text-xs text-text-muted">Pick a new date and time below. Your original booking will be cancelled automatically.</p>
                    </div>
                </div>
            )}

            {/* ─── STEP 1: Pick child (and centre if multiple) ─── */}
            {step === 1 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-6">
                        <User className="w-5 h-5 text-accent" aria-hidden="true" />
                        <h2 className="text-xl font-bold text-text">Who is this booking for?</h2>
                    </div>

                    {childList.length === 0 ? (
                        <div className="bg-surface p-8 rounded-xl border border-dashed border-border text-center">
                            <p className="text-text-muted">No children registered on your account.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {childList.map(child => {
                                const childCentre = child.centreId ? centres.find(c => c.id === child.centreId) : null;
                                const isChildSelected = selectedChild?.id === child.id;
                                return (
                                    <button
                                        key={child.id}
                                        type="button"
                                        aria-pressed={isChildSelected}
                                        onClick={() => handleSelectChild(child)}
                                        className={`p-5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                            isChildSelected
                                                ? 'bg-accent-soft border-accent/40 text-text ring-1 ring-accent/30'
                                                : 'bg-surface border-border text-text-muted hover:border-accent/30 hover:text-text'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-text">{child.firstName} {child.lastName}</p>
                                                <p className="text-xs text-text-muted mt-0.5">{formatSchoolYearLabel(child.schoolYear)}</p>
                                                {childCentre && (
                                                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-soft text-accent border border-accent/20">
                                                        <MapPin className="w-3 h-3" aria-hidden="true" /> {childCentre.name}
                                                    </span>
                                                )}
                                            </div>
                                            {isChildSelected && (
                                                <CheckCircle2 className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {centres.length > 1 && (
                        <div className="mt-6 space-y-3">
                            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Select Centre</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {centres.map(centre => {
                                    const isCentreSelected = selectedCentre?.id === centre.id;
                                    return (
                                        <button
                                            key={centre.id}
                                            type="button"
                                            aria-pressed={isCentreSelected}
                                            onClick={() => {
                                                setSelectedCentre(centre);
                                                setSelectedTime(null);
                                                setSelectedSlotId(null);
                                            }}
                                            className={`p-4 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                                isCentreSelected
                                                    ? 'bg-accent-soft border-accent/40 text-text ring-1 ring-accent/30'
                                                    : 'bg-surface border-border text-text-muted hover:border-accent/30 hover:text-text'
                                            }`}
                                        >
                                            <p className="font-bold">{centre.name}</p>
                                            {centre.address && (
                                                <p className="text-xs text-text-muted mt-0.5">{centre.address}</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end mt-6">
                        <button
                            type="button"
                            onClick={() => handleSetStep(2)}
                            disabled={!selectedChild || !selectedCentre}
                            className="flex items-center gap-2 bg-accent text-on-accent font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>
                </section>
            )}

            {/* ─── STEP 2: Pick date + time slot ─── */}
            {step === 2 && (
                <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="w-5 h-5 text-accent" aria-hidden="true" />
                        <h2 className="text-xl font-bold text-text">Pick a Date &amp; Time</h2>
                    </div>

                    {/* Date picker */}
                    <div>
                        <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-3">Date</p>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {dates.map((d) => {
                                const isDateSelected = selectedDate?.toDateString() === d.toDateString();
                                return (
                                    <button
                                        key={d.toISOString()}
                                        type="button"
                                        aria-pressed={isDateSelected}
                                        onClick={() => {
                                            setSelectedDate(d);
                                            setSelectedTime(null);
                                            setSelectedSlotId(null);
                                        }}
                                        className={`min-h-[48px] min-w-[44px] p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                            isDateSelected
                                                ? 'bg-accent border-accent text-on-accent shadow-sm'
                                                : 'bg-surface border-border text-text-muted hover:border-accent/30 hover:text-text'
                                        }`}
                                    >
                                        <p className="text-[10px] uppercase font-bold">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                                        <p className="text-lg font-bold leading-none mt-0.5 tabular-nums">{d.getDate()}</p>
                                        <p className="text-[10px]">{d.toLocaleDateString('en-GB', { month: 'short' })}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Time slot picker */}
                    {selectedDate && (
                        <div>
                            <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-3">Time Slot</p>
                            {slots.length === 0 ? (
                                <p className="text-text-muted text-sm">No time slots configured for this centre.</p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {slots.map(slot => {
                                        const isSelected = selectedSlotId
                                            ? selectedSlotId === slot.id
                                            : selectedTime === slot.time;
                                        const displayLabel = slot.label
                                            ? `${slot.label} (${slot.time})`
                                            : slot.time;
                                        return (
                                            <button
                                                key={slot.id}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => {
                                                    setSelectedTime(slot.time);
                                                    setSelectedSlotId(slot.id);
                                                }}
                                                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                                    isSelected
                                                        ? 'bg-accent border-accent text-on-accent shadow-sm'
                                                        : 'bg-surface border-border text-text-muted hover:border-accent/30 hover:text-text'
                                                }`}
                                            >
                                                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                {displayLabel}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Duration */}
                    {selectedTime && (
                        <div>
                            <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-3">Duration</p>
                            <div className="flex gap-2 flex-wrap">
                                {DURATION_OPTIONS.map(d => {
                                    const isDurationSelected = selectedDuration === d;
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            aria-pressed={isDurationSelected}
                                            onClick={() => setSelectedDuration(d)}
                                            className={`min-h-[44px] px-5 py-2 rounded-xl border text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                                isDurationSelected
                                                    ? 'bg-accent-soft border-accent text-accent'
                                                    : 'bg-surface border-border text-text-muted hover:border-accent/40 hover:text-text'
                                            }`}
                                        >
                                            <span className="tabular-nums">{d} min</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-6 sticky bottom-0 z-10 bg-surface/95 backdrop-blur-sm border-t border-border py-3 -mx-4 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:static sm:bg-transparent sm:border-0 sm:p-0 sm:mx-0 sm:pb-0">
                        <button
                            type="button"
                            onClick={() => handleSetStep(1)}
                            className="flex items-center gap-2 text-text-muted hover:text-text font-bold px-4 py-3 rounded-xl hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSetStep(3)}
                            disabled={!selectedDate || !selectedTime}
                            className="flex items-center gap-2 bg-accent text-on-accent font-bold px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            Review <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>
                </section>
            )}

            {/* ─── STEP 3: Confirm & Book ─── */}
            {step === 3 && selectedChild && selectedCentre && selectedDate && selectedTime && (
                <section className="space-y-6">
                    <h2 className="text-xl font-bold text-text mb-2">Confirm Your Booking</h2>

                    <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-text-muted text-sm">Child</span>
                            <span className="font-bold text-text">{selectedChild.firstName} {selectedChild.lastName}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-text-muted text-sm">Centre</span>
                            <span className="font-bold text-text">{selectedCentre.name}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-text-muted text-sm">Date</span>
                            <span className="font-bold text-text">{formatDateLabel(selectedDate)}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-text-muted text-sm">Time</span>
                            <span className="font-bold text-text">{selectedTime}</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-text-muted text-sm">Duration</span>
                            <span className="font-bold text-text">{selectedDuration} minutes</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-text-muted text-sm">Modality</span>
                            <span className="font-bold text-text">In Person</span>
                        </div>
                    </div>

                    <div className="bg-accent-soft border border-accent/20 rounded-xl p-4 text-sm text-text-muted flex items-start gap-2.5">
                        <ClipboardCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                        <span>No payment required now. An invoice will be issued by staff after your session.</span>
                    </div>

                    {error && (
                        <div role="alert" className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-6 sticky bottom-0 z-10 bg-surface/95 backdrop-blur-sm border-t border-border py-3 -mx-4 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:static sm:bg-transparent sm:border-0 sm:p-0 sm:mx-0 sm:pb-0">
                        <button
                            type="button"
                            onClick={() => handleSetStep(2)}
                            className="flex items-center gap-2 text-text-muted hover:text-text font-bold px-4 py-3 rounded-xl hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={loading}
                            className="flex items-center gap-2 bg-accent text-on-accent font-bold px-8 py-3 rounded-xl disabled:opacity-60 hover:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            {loading ? (
                                <><Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" /> Booking…</>
                            ) : (
                                <>Confirm Booking <CheckCircle2 className="w-4 h-4" aria-hidden="true" /></>
                            )}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
