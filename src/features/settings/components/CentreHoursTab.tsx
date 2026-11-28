'use client';

import { useState } from 'react';
import { Clock, Calendar, Plus, Edit2, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import CentreHoursForm from './CentreHoursForm';

// Milestone 3J: Removed sessionSlots from this interface — CentreHoursForm
// (Option B) no longer reads or writes sessionSlots via Settings. Session slot
// management stays exclusively in Centres → Settings → Sessions. See
// project-notes/milestone-3j-settings-audit.md §F for the shape-collision
// rationale.
interface Centre {
    id: string;
    name: string;
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
                    type="button"
                    onClick={() => setEditingCentreId(null)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text min-h-11 sm:min-h-9 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Centres List
                </button>
                <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs">
                    <h2 className="text-xl font-bold text-text mb-2">Edit Opening Hours</h2>
                    <p className="text-xs text-text-muted mb-6">Configuring opening hours for <strong className="text-text">{activeCentre.name}</strong></p>
                    <CentreHoursForm centre={activeCentre} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text tracking-tight">Centre Opening Hours</h2>
                <p className="text-sm text-text-muted mt-1">Configure the operating hours for each of your centres.</p>
            </div>

            {centres.length === 0 ? (
                <div className="bg-surface border border-border rounded-xl p-8 sm:p-12 text-center shadow-xs">
                    <Calendar className="w-12 h-12 text-text-muted/50 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-text mb-1">No Centres Found</h3>
                    <p className="text-sm text-text-muted mb-6">Create a centre in the main dashboard before setting hours.</p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-5 py-2.5 min-h-11 sm:min-h-10 bg-accent text-on-accent rounded-md text-sm font-semibold hover:bg-accent-hover transition-colors shadow-xs"
                    >
                        <Plus className="w-4 h-4" /> Create Centre
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {centres.map((centre) => {
                        const hoursMap = parseHours(centre.operatingHours);
                        const openDays = DAYS.filter(d => hoursMap[d].open);

                        return (
                            <div key={centre.id} className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-xs transition-colors">
                                <div className="flex items-start justify-between gap-4 mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-accent-soft border border-border rounded-lg flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-accent" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-text">{centre.name}</h3>
                                            {centre.address && <p className="text-xs text-text-muted mt-0.5">{centre.address}</p>}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditingCentreId(centre.id)}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 min-h-11 sm:min-h-9 bg-accent-soft hover:bg-accent/20 border border-accent/25 text-accent rounded-md text-xs font-semibold transition-colors"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit Hours
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Opening Hours Summary */}
                                    <div className="p-4 bg-page rounded-lg border border-border space-y-3">
                                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Opening Hours</p>
                                        <div className="space-y-1.5">
                                            {openDays.length > 0 ? openDays.map(day => (
                                                <div key={day} className="flex justify-between text-xs">
                                                    <span className="font-semibold text-text/80">{DAY_LABELS[day]}</span>
                                                    <span className="text-text-muted font-medium tabular-nums">
                                                        {fmt12(hoursMap[day].start)} – {fmt12(hoursMap[day].end)}
                                                    </span>
                                                </div>
                                            )) : (
                                                <p className="text-xs text-text-muted/50 italic">No hours configured</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Session Slots — redirect to Centres Settings */}
                                    <div className="p-4 bg-page rounded-lg border border-border space-y-2 flex flex-col justify-between">
                                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Session Slots</p>
                                        <p className="text-xs text-text-muted leading-relaxed">
                                            Session time slots (name, price, capacity) are managed in Centre Settings.
                                        </p>
                                        <Link
                                            href={`/dashboard/centres/${centre.id}/settings`}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline min-h-11 sm:min-h-9 flex items-center"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open Centre Settings
                                        </Link>
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
