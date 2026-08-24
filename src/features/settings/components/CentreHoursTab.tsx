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
                    onClick={() => setEditingCentreId(null)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Centres List
                </button>
                <div className="bg-secondary border border-border rounded-3xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-foreground mb-2">Edit Opening Hours</h2>
                    <p className="text-xs text-muted-foreground mb-6">Configuring opening hours for <strong className="text-foreground">{activeCentre.name}</strong></p>
                    <CentreHoursForm centre={activeCentre} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-foreground tracking-tight">Centre Opening Hours</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure the operating hours for each of your centres.</p>
            </div>

            {centres.length === 0 ? (
                <div className="bg-card border border-border rounded-[32px] p-12 text-center shadow-xl">
                    <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-1">No Centres Found</h3>
                    <p className="text-sm text-muted-foreground mb-6">Create a centre in the main dashboard before setting hours.</p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-primary/20"
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
                            <div key={centre.id} className="bg-card border border-border rounded-[32px] p-6 hover:border-primary/20 hover:shadow-2xl transition-all duration-300 group">
                                <div className="flex items-start justify-between gap-4 mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-secondary border border-border rounded-2xl flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-foreground">{centre.name}</h3>
                                            {centre.address && <p className="text-xs text-muted-foreground mt-0.5">{centre.address}</p>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingCentreId(centre.id)}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary rounded-2xl text-xs font-bold transition-all hover:scale-[1.01]"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit Hours
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Opening Hours Summary */}
                                    <div className="p-4 bg-secondary/60 rounded-2xl border border-border/50 space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Opening Hours</p>
                                        <div className="space-y-1.5">
                                            {openDays.length > 0 ? openDays.map(day => (
                                                <div key={day} className="flex justify-between text-xs">
                                                    <span className="font-semibold text-foreground/70">{DAY_LABELS[day]}</span>
                                                    <span className="text-muted-foreground font-medium">
                                                        {fmt12(hoursMap[day].start)} – {fmt12(hoursMap[day].end)}
                                                    </span>
                                                </div>
                                            )) : (
                                                <p className="text-xs text-muted-foreground/50 italic">No hours configured</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Session Slots — redirect to Centres Settings */}
                                    <div className="p-4 bg-secondary/60 rounded-2xl border border-border/50 space-y-2 flex flex-col justify-between">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Session Slots</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Session time slots (name, price, capacity) are managed in Centre Settings.
                                        </p>
                                        <Link
                                            href={`/dashboard/centres/${centre.id}/settings`}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
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
