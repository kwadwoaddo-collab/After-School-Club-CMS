'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useToast } from '@/components/ui/ToastProvider';
import { Save, Calendar, Loader2 } from 'lucide-react';

// Milestone 3J: Defect 2 (Option B) — The previous implementation sent a
// PATCH to /api/settings/centres/${id}/hours which does not exist (404).
// The correct endpoint is /api/centres/${id}, which already handles
// `operatingHours` with correct auth (ORG_OWNER/MANAGER) and org/centre
// isolation. We intentionally do NOT send `sessionSlots` from Settings:
// the Centres Settings → Sessions tab owns sessionSlots (as structured
// SessionSlot[] objects); this form owns only operatingHours (display hours).

interface CentreHoursFormCentre {
    id: string;
    name: string;
    operatingHours: string | null;
}

type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
const DAYS: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<Day, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
};

const DEFAULT_DAY = { open: false, start: '07:30', end: '18:00' };

function fmt12(time24: string) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const hr = parseInt(h, 10);
    const ampm = hr >= 12 ? 'pm' : 'am';
    const hr12 = hr % 12 || 12;
    return `${hr12}:${m} ${ampm}`;
}

type FormData = {
    hours: Record<Day, { open: boolean; start: string; end: string }>;
};

function parseOperatingHours(raw: string | null): FormData['hours'] {
    const fallback = DAYS.reduce((acc, d) => ({ ...acc, [d]: { ...DEFAULT_DAY } }), {} as FormData['hours']);
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return DAYS.reduce((acc, d) => ({
                ...acc,
                [d]: {
                    open: Boolean(parsed[d]?.open),
                    start: typeof parsed[d]?.start === 'string' ? parsed[d].start : DEFAULT_DAY.start,
                    end: typeof parsed[d]?.end === 'string' ? parsed[d].end : DEFAULT_DAY.end,
                },
            }), {} as FormData['hours']);
        }
    } catch {
        // ignore invalid JSON and fall back safely
    }
    return fallback;
}

export default function CentreHoursForm({ centre }: { centre: CentreHoursFormCentre }) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const savingRef = useRef(false);

    const { control, handleSubmit, setValue, reset, formState: { isDirty } } = useForm<FormData>({
        defaultValues: {
            hours: parseOperatingHours(centre.operatingHours),
        }
    });

    useEffect(() => {
        reset({ hours: parseOperatingHours(centre.operatingHours) });
        setErrorMsg(null);
    }, [centre.id, centre.operatingHours, reset]);

    const hours = useWatch({ control, name: 'hours' });

    const updateDay = (day: Day, field: 'open' | 'start' | 'end', value: boolean | string) => {
        setErrorMsg(null);
        setValue(`hours.${day}.${field}`, value, { shouldDirty: true });
    };

    const onSubmit = async (data: FormData) => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/centres/${centre.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operatingHours: data.hours,
                })
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                const serverError = payload && typeof payload.error === 'string' && payload.error !== 'INTERNAL_SERVER_ERROR'
                    ? payload.error
                    : 'Unable to save opening hours right now. Please try again.';
                throw new Error(serverError);
            }
            reset(data);
            toast({ title: 'Opening hours saved', message: `Operating hours updated for ${centre.name}.`, variant: 'success' });
        } catch (error) {
            const rawMsg = error instanceof Error ? error.message : '';
            const message = rawMsg && rawMsg !== 'INTERNAL_SERVER_ERROR'
                ? rawMsg
                : 'Unable to save opening hours right now. Please try again.';
            setErrorMsg(message);
            toast({ title: 'Could not save hours', message, variant: 'error' });
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-8 animate-in fade-in duration-500 relative">
            {errorMsg && (
                <div
                    role="alert"
                    className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
                >
                    {errorMsg}
                </div>
            )}

            {/* ── Opening Hours ────────────────── */}
            <div className="bg-card border border-border rounded-[32px] p-4 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-success/10 border border-success/20 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-success" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Standard Opening Hours</h2>
                        <p className="text-sm text-muted-foreground">General operating hours for {centre.name}.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {DAYS.map(day => {
                        const sch = hours[day];
                        const startId = `centre-hours-start-${day}`;
                        const endId = `centre-hours-end-${day}`;
                        return (
                            <div key={day} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${sch.open ? 'bg-secondary/60 border-border/60' : 'bg-transparent border-transparent opacity-60 grayscale hover:grayscale-0'}`}>
                                <div className="flex items-center gap-4 w-full sm:w-40">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={sch.open}
                                        onClick={() => updateDay(day, 'open', !sch.open)}
                                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-lg"
                                        aria-label={`Toggle ${DAY_LABELS[day]}`}
                                    >
                                        <span className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${sch.open ? 'bg-success' : 'bg-secondary-foreground/20'}`}>
                                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform ${sch.open ? 'translate-x-5' : ''}`} />
                                        </span>
                                    </button>
                                    <span className="text-sm font-semibold text-foreground">{DAY_LABELS[day]}</span>
                                </div>

                                {sch.open ? (
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
                                        <div className="flex items-center gap-2">
                                            <label htmlFor={startId} className="text-xs text-muted-foreground whitespace-nowrap">
                                                Opens
                                            </label>
                                            <input
                                                id={startId}
                                                type="time"
                                                value={sch.start}
                                                onChange={e => updateDay(day, 'start', e.target.value)}
                                                className="min-h-[44px] px-3 py-1.5 bg-secondary/60 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all font-mono"
                                            />
                                        </div>
                                        <span className="text-muted-foreground/60 text-sm" aria-hidden="true">–</span>
                                        <div className="flex items-center gap-2">
                                            <label htmlFor={endId} className="text-xs text-muted-foreground whitespace-nowrap">
                                                Closes
                                            </label>
                                            <input
                                                id={endId}
                                                type="time"
                                                value={sch.end}
                                                onChange={e => updateDay(day, 'end', e.target.value)}
                                                className="min-h-[44px] px-3 py-1.5 bg-secondary/60 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all font-mono"
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground ml-1">{fmt12(sch.start)} – {fmt12(sch.end)}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-muted-foreground italic">Closed</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Info: Session Slots managed in Centres Settings ────────────────── */}
            <div className="bg-secondary/30 border border-dashed border-border rounded-2xl px-6 py-5 flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-accent-soft border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar className="w-4 h-4 text-accent" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">Session time slots are managed in the Centre Settings</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Detailed session slots (name, start/end time, price, capacity, days) are configured under{' '}
                        <strong>Centres → [Centre] → Settings → Sessions</strong>. Changes there are immediately reflected on the registration form and booking portal.
                    </p>
                </div>
            </div>

            {/* Atomic Save Action Bar */}
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 p-4 bg-card/90 backdrop-blur-md border border-border shadow-xl rounded-2xl">
                <span className="text-muted-foreground text-sm font-medium px-2">
                    {isDirty ? 'Unsaved changes.' : 'All changes saved.'}
                </span>
                <button
                    type="submit"
                    disabled={saving || !isDirty}
                    className="min-h-[44px] px-8 py-3 bg-accent text-on-accent rounded-xl text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Hours
                </button>
            </div>
        </form>
    );
}
