'use client';

import { useState } from 'react';
import { Clock, Calendar, Plus, Edit2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import CentreHoursForm from './CentreHoursForm';

interface Centre {
    id: string;
    name: string;
    sessionSlots: string | null;
    operatingHours: string | null;
    address?: string | null;
}

interface Props {
    centres: Centre[];
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const DEFAULT_HOURS = {
    monday: { open: true, start: '09:00', end: '17:00' },
    tuesday: { open: true, start: '09:00', end: '17:00' },
    wednesday: { open: true, start: '09:00', end: '17:00' },
    thursday: { open: true, start: '09:00', end: '17:00' },
    friday: { open: true, start: '09:00', end: '17:00' },
    saturday: { open: false, start: '09:00', end: '13:00' },
    sunday: { open: false, start: '09:00', end: '13:00' },
};

function parseHours(raw: string | null) {
    if (!raw) return DEFAULT_HOURS;
    try {
        const parsed = JSON.parse(raw);
        const result = { ...DEFAULT_HOURS };
        for (const day of DAYS) {
            if (parsed[day]) result[day] = { ...DEFAULT_HOURS[day], ...parsed[day] };
        }
        return result;
    } catch {
        return DEFAULT_HOURS;
    }
}

function fmt12(t: string) {
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr ?? '00';
    const ampm = h >= 12 ? 'pm' : 'am';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${ampm}`;
}

export default function CentreHoursTab({ centres }: Props) {
    const [editingCentreId, setEditingCentreId] = useState<string | null>(null);

    const activeCentre = centres.find(c => c.id === editingCentreId);

    if (activeCentre) {
        return (
            <div className="space-y-6">
                <button
                    onClick={() => setEditingCentreId(null)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#8c909f] hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Centres List
                </button>
                <div className="bg-[#1a1c23] border border-[#424754]/15 rounded-3xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-2">Edit Operating Hours</h2>
                    <p className="text-xs text-[#8c909f] mb-6">Configuring timings and slots for <strong className="text-white">{activeCentre.name}</strong></p>
                    <CentreHoursForm centre={activeCentre} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Centre Hours &amp; Sessions</h2>
                <p className="text-sm text-[#8c909f] mt-1">Configure operating hours and dynamic session slots per centre.</p>
            </div>

            {centres.length === 0 ? (
                <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-[32px] p-12 text-center shadow-xl">
                    <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-1">No Centres Found</h3>
                    <p className="text-sm text-[#8c909f] mb-6">Create a centre in the main dashboard before setting hours.</p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-slate-950 rounded-2xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" /> Create Centre
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {centres.map((centre) => {
                        const hoursMap = parseHours(centre.operatingHours);
                        const openDays = DAYS.filter(d => hoursMap[d].open);

                        let slotCount = 0;
                        if (centre.sessionSlots) {
                            try { slotCount = JSON.parse(centre.sessionSlots).length; } catch { }
                        }

                        return (
                            <div key={centre.id} className="bg-[#1a1d23] border border-[#424754]/15 rounded-[32px] p-6 hover:border-[#adc6ff]/20 hover:shadow-2xl transition-all duration-300 group">
                                <div className="flex items-start justify-between gap-4 mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#2a2a2a] border border-[#424754]/15 rounded-2xl flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-[#adc6ff]" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white">{centre.name}</h3>
                                            {centre.address && <p className="text-xs text-[#8c909f] mt-0.5">{centre.address}</p>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingCentreId(centre.id)}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#adc6ff]/10 hover:bg-[#adc6ff]/20 border border-[#adc6ff]/25 text-[#adc6ff] rounded-2xl text-xs font-bold transition-all hover:scale-[1.01]"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit Hours
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Opening Hours Summary */}
                                    <div className="p-4 bg-[#14161b] rounded-2xl border border-white/5 space-y-3">
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Opening Hours</p>
                                        <div className="space-y-1.5">
                                            {openDays.map(day => (
                                                <div key={day} className="flex justify-between text-xs">
                                                    <span className="font-semibold text-white/70">{DAY_LABELS[day]}</span>
                                                    <span className="text-[#8c909f] font-medium">
                                                        {fmt12(hoursMap[day].start)} – {fmt12(hoursMap[day].end)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Session Slots Summary */}
                                    <div className="p-4 bg-[#14161b] rounded-2xl border border-white/5 space-y-2">
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Session Slots</p>
                                        {slotCount > 0 ? (
                                            <>
                                                <p className="text-xl font-black text-white">{slotCount} Slots</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {(JSON.parse(centre.sessionSlots!) as string[]).slice(0, 3).map(s => (
                                                        <span key={s} className="text-[10px] bg-white/5 text-[#adc6ff] px-2 py-0.5 rounded-md border border-[#adc6ff]/10 font-bold">{s}</span>
                                                    ))}
                                                    {slotCount > 3 && (
                                                        <span className="text-[10px] bg-white/5 text-[#adc6ff] px-2 py-0.5 rounded-md border border-[#adc6ff]/10 font-bold">+{slotCount - 3} more</span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-[#8c909f]/50 italic">No custom session slots configured</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
