'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useToast } from '@/components/ui/ToastProvider';
import { Save, Clock, Calendar, Plus, X, Loader2 } from 'lucide-react';

// Only the fields this form actually reads (id, name, operatingHours,
// sessionSlots) — not the full Centre row. The caller,
// src/features/settings/components/CentreHoursTab.tsx, already only has
// (and only needs) this subset, so this keeps both files honest about
// what's really required instead of forcing a full DB-row type through a
// component that uses four fields of it.
interface CentreHoursFormCentre {
    id: string;
    name: string;
    operatingHours: string | null;
    sessionSlots: string | null;
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
    slots: string[];
};

export default function CentreHoursForm({ centre }: { centre: CentreHoursFormCentre }) {
    const { toast } = useToast();
    const [newSlot, setNewSlot] = useState('');
    const [saving, setSaving] = useState(false);

    let initialHours: FormData['hours'] = DAYS.reduce((acc, d) => ({ ...acc, [d]: DEFAULT_DAY }), {} as FormData['hours']);
    if (centre.operatingHours) {
        try {
            initialHours = JSON.parse(centre.operatingHours);
        } catch { }
    }

    let initialSlots: string[] = [];
    if (centre.sessionSlots) {
        try {
            initialSlots = JSON.parse(centre.sessionSlots);
        } catch { }
    }

    const { control, handleSubmit, setValue, formState: { isDirty } } = useForm<FormData>({
        defaultValues: {
            hours: initialHours,
            slots: initialSlots,
        }
    });

    // useWatch (not methods.watch()) — react-hook-form's watch() escape hatch
    // is flagged by the React Compiler as an incompatible-library pattern
    // (react-hooks/incompatible-library); useWatch is the compiler-safe
    // subscription API and preserves identical reactive behaviour here.
    const hours = useWatch({ control, name: 'hours' });
    const slots = useWatch({ control, name: 'slots' });

    const updateDay = (day: Day, field: 'open' | 'start' | 'end', value: boolean | string) => {
        setValue(`hours.${day}.${field}`, value, { shouldDirty: true });
    };

    const addSlot = (e: React.FormEvent) => {
        e.preventDefault();
        const s = newSlot.trim();
        if (s && !slots.includes(s)) {
            setValue('slots', [...slots, s], { shouldDirty: true });
            setNewSlot('');
        }
    };

    const removeSlot = (slotToRemove: string) => {
        setValue('slots', slots.filter(s => s !== slotToRemove), { shouldDirty: true });
    };

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/settings/centres/${centre.id}/hours`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operatingHours: JSON.stringify(data.hours),
                    sessionSlots: JSON.stringify(data.slots)
                })
            });
            if (!res.ok) throw new Error('Failed to save changes');
            toast({ title: 'Success', message: 'Hours and session slots saved.', variant: 'success' });
        } catch (error) {
            toast({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to save', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in duration-500 relative">
            {/* ── Section 1: Standard Opening Hours ────────────────── */}
            <div className="bg-card border border-border rounded-[32px] p-8 shadow-sm">
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
                        return (
                            <div key={day} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${sch.open ? 'bg-secondary/60 border-border/60' : 'bg-transparent border-transparent opacity-60 grayscale hover:grayscale-0'}`}>
                                <div className="flex items-center gap-4 w-40">
                                    <button
                                        type="button"
                                        onClick={() => updateDay(day, 'open', !sch.open)}
                                        className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${sch.open ? 'bg-success' : 'bg-secondary-foreground/20'}`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform ${sch.open ? 'translate-x-5' : ''}`} />
                                    </button>
                                    <span className="text-sm font-semibold text-foreground">{DAY_LABELS[day]}</span>
                                </div>

                                {sch.open ? (
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-muted-foreground whitespace-nowrap">Opens</label>
                                            <input
                                                type="time"
                                                value={sch.start}
                                                onChange={e => updateDay(day, 'start', e.target.value)}
                                                className="px-3 py-1.5 bg-secondary/60 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all font-mono"
                                            />
                                        </div>
                                        <span className="text-muted-foreground/40 text-sm">–</span>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-muted-foreground whitespace-nowrap">Closes</label>
                                            <input
                                                type="time"
                                                value={sch.end}
                                                onChange={e => updateDay(day, 'end', e.target.value)}
                                                className="px-3 py-1.5 bg-secondary/60 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all font-mono"
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground ml-1">{fmt12(sch.start)} – {fmt12(sch.end)}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-muted-foreground/50 italic">Closed</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Section 2: Registration Session Slots ────────────────── */}
            <div className="bg-card border border-border rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-secondary border border-border rounded-xl flex items-center justify-center">
                        <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Registration Session Slots</h2>
                        <p className="text-sm text-muted-foreground">The time blocks when students attend sessions — parents choose from these on the registration form.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {slots.map(slot => (
                            <div key={slot} className="flex justify-between items-center p-3 rounded-xl border border-border bg-secondary/60 text-sm font-medium text-muted-foreground">
                                <span>{slot}</span>
                                <button
                                    type="button"
                                    onClick={() => removeSlot(slot)}
                                    className="p-1 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 p-4 rounded-xl border border-dashed border-border bg-secondary/60/30 mt-4">
                        <input
                            type="text"
                            placeholder="e.g. Wednesday 3:30–5:00 pm"
                            value={newSlot}
                            onChange={e => setNewSlot(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addSlot(e);
                                }
                            }}
                            className="flex-1 px-4 py-2.5 bg-secondary/60 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                        <button
                            type="button"
                            onClick={addSlot}
                            disabled={!newSlot.trim()}
                            className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* Atomic Save Action Bar */}
            <div className="sticky bottom-4 z-10 flex items-center justify-between p-4 bg-card/90 backdrop-blur-md border border-border shadow-xl rounded-2xl">
                <span className="text-muted-foreground text-sm font-medium px-2">
                    {isDirty ? 'Unsaved changes.' : 'All changes saved.'}
                </span>
                <button
                    type="submit"
                    disabled={saving || !isDirty}
                    className="px-8 py-3 bg-primary text-foreground rounded-xl text-sm font-bold hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:scale-100"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>
        </form>
    );
}
