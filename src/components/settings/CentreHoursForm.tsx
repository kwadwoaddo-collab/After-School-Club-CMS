'use client';

import { useState } from 'react';
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
            router.refresh();
            setTimeout(() => setHoursSuccess(''), 3000);
        } catch (err: any) {
            setHoursError(err.message);
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
            router.refresh();
            setTimeout(() => setSlotsSuccess(''), 3000);
        } catch (err: any) {
            setSlotsError(err.message);
        } finally {
            setSavingSlots(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8">

            {/* ── Section 1: Opening Hours ─────────────────────────────── */}
            <div className="glass-card rounded-3xl p-6 !bg-[#1a1c23]/80 !border-[#2a2d35]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Opening Hours</h2>
                        <p className="text-sm text-slate-400">Controls when parents can book assessments at this centre.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {DAYS.map(day => {
                        const sch = hours[day];
                        return (
                            <div
                                key={day}
                                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border transition-colors ${sch.open ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-800/30 border-dashed border-slate-700 opacity-60'}`}
                            >
                                {/* Day label + toggle */}
                                <div className="flex items-center gap-3 w-36 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => updateDay(day, 'open', !sch.open)}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${sch.open ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sch.open ? 'translate-x-5' : ''}`} />
                                    </button>
                                    <span className="text-sm font-semibold text-white">{DAY_LABELS[day]}</span>
                                </div>

                                {sch.open ? (
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-500 whitespace-nowrap">Opens</label>
                                            <input
                                                type="time"
                                                value={sch.start}
                                                onChange={e => updateDay(day, 'start', e.target.value)}
                                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                            />
                                        </div>
                                        <span className="text-slate-400 text-sm">–</span>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-500 whitespace-nowrap">Closes</label>
                                            <input
                                                type="time"
                                                value={sch.end}
                                                onChange={e => updateDay(day, 'end', e.target.value)}
                                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400 ml-1">{fmt12(sch.start)} – {fmt12(sch.end)}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-slate-400 italic">Closed</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {hoursError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{hoursError}</div>}

                <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
                    {hoursSuccess
                        ? <span className="text-emerald-600 text-sm font-medium">✓ {hoursSuccess}</span>
                        : <span className="text-slate-400 text-sm">Changes apply immediately on save.</span>
                    }
                    <button
                        onClick={handleSaveHours}
                        disabled={savingHours}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {savingHours ? 'Saving...' : 'Save Opening Hours'}
                    </button>
                </div>
            </div>

            {/* ── Section 2: Registration Session Slots ────────────────── */}
            <div className="glass-card rounded-3xl p-6 !bg-[#1a1c23]/80 !border-[#2a2d35]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Registration Session Slots</h2>
                        <p className="text-sm text-slate-400">The time blocks when students attend sessions — parents choose from these on the registration form.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {slots.map(slot => (
                            <div key={slot} className="flex justify-between items-center p-3 rounded-xl border border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-200">
                                <span>{slot}</span>
                                <button
                                    onClick={() => removeSlot(slot)}
                                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 ml-2"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={addSlot} className="flex gap-2 p-4 rounded-xl border border-dashed border-slate-700 bg-slate-800/30 mt-4">
                        <input
                            type="text"
                            placeholder="e.g. Wednesday 3:30–5:00 pm"
                            value={newSlot}
                            onChange={e => setNewSlot(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        />
                        <button
                            type="submit"
                            disabled={!newSlot.trim()}
                            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </form>
                </div>

                {slotsError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{slotsError}</div>}

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                    {slotsSuccess
                        ? <span className="text-blue-600 text-sm font-medium">✓ {slotsSuccess}</span>
                        : <span className="text-slate-500 text-sm">Removing a slot won't affect existing student selections.</span>
                    }
                    <button
                        onClick={handleSaveSlots}
                        disabled={savingSlots}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {savingSlots ? 'Saving...' : 'Save Session Slots'}
                    </button>
                </div>
            </div>
        </div>
    );
}
