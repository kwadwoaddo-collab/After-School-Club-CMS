'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { Save, Plus, X, Clock, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────
interface DaySchedule {
    open: boolean;
    start: string;
    end: string;
}

type WeekSchedule = Record<string, DaySchedule>;

interface CentreHoursFormProps {
    centre: {
        id: string;
        name: string;
        sessionSlots: string | null;
        operatingHours: string | null;
    };
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const DEFAULT_OPERATING_HOURS: WeekSchedule = {
    monday: { open: true, start: '09:00', end: '17:00' },
    tuesday: { open: true, start: '09:00', end: '17:00' },
    wednesday: { open: true, start: '09:00', end: '17:00' },
    thursday: { open: true, start: '09:00', end: '17:00' },
    friday: { open: true, start: '09:00', end: '17:00' },
    saturday: { open: false, start: '09:00', end: '13:00' },
    sunday: { open: false, start: '09:00', end: '13:00' },
};

const DEFAULT_SLOTS = [
    'Monday 4:30–5:50 pm', 'Monday 6:00–7:20 pm',
    'Tuesday 4:30–5:50 pm', 'Tuesday 6:00–7:20 pm',
    'Wednesday 4:30–5:50 pm', 'Wednesday 6:00–7:20 pm',
    'Thursday 4:30–5:50 pm', 'Thursday 6:00–7:20 pm',
    'Friday 4:30–5:50 pm', 'Friday 6:00–7:20 pm',
    'Saturday 10:00–11:20 am', 'Saturday 11:30–12:50 pm', 'Saturday 1:00–2:20 pm',
];

function parseHours(raw: string | null): WeekSchedule {
    if (!raw) return { ...DEFAULT_OPERATING_HOURS };
    try {
        const parsed = JSON.parse(raw);
        // Merge with defaults so all 7 days are always present
        const result: WeekSchedule = { ...DEFAULT_OPERATING_HOURS };
        for (const day of DAYS) {
            if (parsed[day]) result[day] = { ...DEFAULT_OPERATING_HOURS[day], ...parsed[day] };
        }
        return result;
    } catch {
        return { ...DEFAULT_OPERATING_HOURS };
    }
}

function fmt12(time24: string) {
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr ?? '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${ampm}`;
}

// ============================================================================
// Component
// ============================================================================
export default function CentreHoursForm({ centre }: CentreHoursFormProps) {
    const router = useRouter();

    // ── Opening Hours state ────────────────────────────────────────────────
    const [hours, setHours] = useState<WeekSchedule>(() => parseHours(centre.operatingHours));
    const { toast } = useToast();
    const [savingHours, setSavingHours] = useState(false);
    const [hoursError, setHoursError] = useState('');
    const [hoursSuccess, setHoursSuccess] = useState('');

    // ── Session Slots state ────────────────────────────────────────────────
    const [slots, setSlots] = useState<string[]>(() => {
        if (centre.sessionSlots) {
            try { return JSON.parse(centre.sessionSlots); } catch { return DEFAULT_SLOTS; }
        }
        return DEFAULT_SLOTS;
    });
    const [newSlot, setNewSlot] = useState('');
    const [savingSlots, setSavingSlots] = useState(false);
    const [slotsError, setSlotsError] = useState('');
    const [slotsSuccess, setSlotsSuccess] = useState('');

    // ── Handlers: Opening Hours ───────────────────────────────────────────
    const updateDay = (day: string, field: keyof DaySchedule, value: string | boolean) => {
        setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    };

    const handleSaveHours = async () => {
        setSavingHours(true);
        setHoursError('');
        setHoursSuccess('');
        try {
            const res = await fetch(`/api/centres/${centre.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operatingHours: hours }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Failed to save opening hours');
            }
            setHoursSuccess('Opening hours saved successfully.');
            toast({ title: 'Success', message: 'Opening hours saved successfully!', variant: 'success' });
            router.refresh();
            setTimeout(() => setHoursSuccess(''), 3000);
        } catch (err: any) {
            setHoursError(err.message);
            toast({ title: 'Error', message: err.message || 'Failed to save opening hours', variant: 'error' });
        } finally {
            setSavingHours(false);
        }
    };

    // ── Handlers: Session Slots ───────────────────────────────────────────
    const addSlot = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newSlot.trim();
        if (!trimmed) return;
        if (slots.includes(trimmed)) { setSlotsError('This slot already exists.'); return; }
        setSlots([...slots, trimmed]);
        setNewSlot('');
        setSlotsError('');
    };

    const removeSlot = (slot: string) => setSlots(slots.filter(s => s !== slot));

    const handleSaveSlots = async () => {
        setSavingSlots(true);
        setSlotsError('');
        setSlotsSuccess('');
        try {
            const res = await fetch(`/api/centres/${centre.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionSlots: slots }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Failed to save session slots');
            }
            setSlotsSuccess('Session slots saved successfully.');
            toast({ title: 'Success', message: 'Session slots saved successfully!', variant: 'success' });
            router.refresh();
            setTimeout(() => setSlotsSuccess(''), 3000);
        } catch (err: any) {
            setSlotsError(err.message);
            toast({ title: 'Error', message: err.message || 'Failed to save session slots', variant: 'error' });
        } finally {
            setSavingSlots(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8">

            {/* ── Section 1: Opening Hours ─────────────────────────────── */}
            <div className="bg-card border border-border rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-secondary border border-border rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Opening Hours</h2>
                        <p className="text-sm text-muted-foreground">Controls when parents can book sessions at this centre.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {DAYS.map(day => {
                        const sch = hours[day];
                        return (
                            <div
                                key={day}
                                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border transition-colors ${sch.open ? 'bg-secondary/60/50 border-border' : 'bg-secondary/60/20 border-dashed border-border opacity-50'}`}
                            >
                                {/* Day label + toggle */}
                                <div className="flex items-center gap-3 w-36 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => updateDay(day, 'open', !sch.open)}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${sch.open ? 'bg-emerald-500' : 'bg-secondary'}`}
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
                                                className="px-3 py-1.5 bg-secondary/60 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                                            />
                                        </div>
                                        <span className="text-muted-foreground/40 text-sm">–</span>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-muted-foreground whitespace-nowrap">Closes</label>
                                            <input
                                                type="time"
                                                value={sch.end}
                                                onChange={e => updateDay(day, 'end', e.target.value)}
                                                className="px-3 py-1.5 bg-secondary/60 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
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

                {hoursError && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm">{hoursError}</div>}

                <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
                    {hoursSuccess
                        ? <span className="text-emerald-600 text-sm font-medium">✓ {hoursSuccess}</span>
                        : <span className="text-muted-foreground text-sm">Changes apply immediately on save.</span>
                    }
                    <button
                        onClick={handleSaveHours}
                        disabled={savingHours}
                        className="px-6 py-3 bg-emerald-600 text-foreground rounded-2xl text-sm font-bold hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {savingHours ? 'Saving...' : 'Save Opening Hours'}
                    </button>
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
                            <div key={slot} className="flex justify-between items-center p-3 rounded-xl border border-border bg-secondary/60 text-sm font-medium text-slate-200">
                                <span>{slot}</span>
                                <button
                                    onClick={() => removeSlot(slot)}
                                    className="p-1 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={addSlot} className="flex gap-2 p-4 rounded-xl border border-dashed border-border bg-secondary/60/30 mt-4">
                        <input
                            type="text"
                            placeholder="e.g. Wednesday 3:30–5:00 pm"
                            value={newSlot}
                            onChange={e => setNewSlot(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-secondary/60 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        />
                        <button
                            type="submit"
                            disabled={!newSlot.trim()}
                            className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </form>
                </div>

                {slotsError && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm">{slotsError}</div>}

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                    {slotsSuccess
                        ? <span className="text-primary text-sm font-medium">✓ {slotsSuccess}</span>
                        : <span className="text-muted-foreground text-sm">Removing a slot won't affect existing student selections.</span>
                    }
                    <button
                        onClick={handleSaveSlots}
                        disabled={savingSlots}
                        className="px-6 py-3 bg-primary text-foreground rounded-2xl text-sm font-bold hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {savingSlots ? 'Saving...' : 'Save Session Slots'}
                    </button>
                </div>
            </div>
        </div>
    );
}
