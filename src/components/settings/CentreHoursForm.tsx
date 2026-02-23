'use client';

import { useState } from 'react';
import { Save, Plus, X, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CentreHoursFormProps {
    centre: {
        id: string;
        name: string;
        sessionSlots: string | null;
        // ignoring operatingHours for now to focus on session creation logic
    };
}

const DEFAULT_SLOTS = [
    'Monday 4:30–5:50 pm',
    'Monday 6:00–7:20 pm',
    'Tuesday 4:30–5:50 pm',
    'Tuesday 6:00–7:20 pm',
    'Wednesday 4:30–5:50 pm',
    'Wednesday 6:00–7:20 pm',
    'Thursday 4:30–5:50 pm',
    'Thursday 6:00–7:20 pm',
    'Friday 4:30–5:50 pm',
    'Friday 6:00–7:20 pm',
    'Saturday 10:00–11:20 am',
    'Saturday 11:30–12:50 pm',
    'Saturday 1:00–2:20 pm',
];

export default function CentreHoursForm({ centre }: CentreHoursFormProps) {
    const router = useRouter();
    const [slots, setSlots] = useState<string[]>(() => {
        if (centre.sessionSlots) {
            try { return JSON.parse(centre.sessionSlots); } catch { return DEFAULT_SLOTS; }
        }
        return DEFAULT_SLOTS;
    });

    const [newSlot, setNewSlot] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const addSlot = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newSlot.trim();
        if (!trimmed) return;
        if (slots.includes(trimmed)) {
            setError('This session slot already exists.');
            return;
        }
        setSlots([...slots, trimmed]);
        setNewSlot('');
        setError('');
    };

    const removeSlot = (slotToRemove: string) => {
        setSlots(slots.filter(s => s !== slotToRemove));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`/api/centres/${centre.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionSlots: slots }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update session slots');
            }

            setSuccess('Session slots saved successfully.');
            router.refresh();

            setTimeout(() => {
                setSuccess('');
            }, 3000);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Registration Session Slots</h2>
                        <p className="text-sm text-slate-600">Define the exact time blocks parents can select on the registration form.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {slots.map(slot => (
                            <div key={slot} className="flex justify-between items-center p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700">
                                <span>{slot}</span>
                                <button
                                    onClick={() => removeSlot(slot)}
                                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={addSlot} className="flex gap-2 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 mt-4">
                        <input
                            type="text"
                            placeholder="e.g. Wednesday 3:30–5:00 pm"
                            value={newSlot}
                            onChange={(e) => setNewSlot(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
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

                {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                    {success ? (
                        <span className="text-green-600 text-sm font-medium">{success}</span>
                    ) : (
                        <span className="text-slate-500 text-sm">Any unregistered slots removed will not affect existing students.</span>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Slots'}
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-3xl p-6 bg-amber-50 border border-amber-200">
                <h3 className="text-sm font-bold text-slate-900 mb-2">Note about actual Operating Hours</h3>
                <p className="text-sm text-slate-700">Right now, parents mainly use the &quot;Registration Session Slots&quot; defined above when they sign up their children. Modifying general operating availability is coming soon!</p>
            </div>
        </div>
    );
}
