import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar, Plus, Edit2 } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const DEFAULT_HOURS: Record<string, { open: boolean; start: string; end: string }> = {
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

// ── Page ───────────────────────────────────────────────────────────────────
export default async function CentreHoursPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    const allCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, org.id),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            href="/dashboard/settings"
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Centre Hours
                        </h1>
                    </div>
                    <p className="text-slate-700 font-medium ml-14">
                        Manage opening hours and registration session slots per centre
                    </p>
                </div>
            </div>

            {/* Info banner */}
            <div className="glass-card rounded-3xl p-5 bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200">
                <div className="flex gap-6 flex-wrap text-sm text-slate-700">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Opening Hours</p>
                            <p className="text-slate-600 text-xs mt-0.5">Controls when parents can book assessments</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">Session Slots</p>
                            <p className="text-slate-600 text-xs mt-0.5">When students attend — shown on the registration form for parents to choose</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Centres list */}
            {allCentres.length === 0 ? (
                <div className="glass-card rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Centres Yet</h3>
                    <p className="text-slate-600 mb-6">Create a centre first to configure its hours.</p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30"
                    >
                        <Plus className="w-4 h-4" />
                        Add Your First Centre
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {allCentres.map((centre) => {
                        const hoursMap = parseHours(centre.operatingHours);
                        const openDays = DAYS.filter(d => hoursMap[d].open);
                        const closedDays = DAYS.filter(d => !hoursMap[d].open);

                        // Parse session slot count
                        let slotCount = 0;
                        if (centre.sessionSlots) {
                            try { slotCount = JSON.parse(centre.sessionSlots).length; } catch { }
                        }

                        return (
                            <div key={centre.id} className="glass-card rounded-3xl p-6 hover:shadow-xl transition-all group">
                                <div className="flex items-start justify-between gap-4 mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-emerald-700" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">{centre.name}</h3>
                                            {centre.address && <p className="text-sm text-slate-500">{centre.address}</p>}
                                        </div>
                                    </div>
                                    <Link
                                        href={`/dashboard/settings/hours/${centre.id}`}
                                        className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-semibold hover:bg-emerald-100 transition-all group-hover:scale-105"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Edit Hours
                                    </Link>
                                </div>

                                {/* Opening hours summary */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Calendar className="w-4 h-4 text-emerald-600" />
                                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Opening Hours</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            {openDays.map(day => (
                                                <div key={day} className="flex justify-between text-sm">
                                                    <span className="font-medium text-slate-700">{DAY_LABELS[day]}</span>
                                                    <span className="text-slate-600">{fmt12(hoursMap[day].start)} – {fmt12(hoursMap[day].end)}</span>
                                                </div>
                                            ))}
                                            {closedDays.map(day => (
                                                <div key={day} className="flex justify-between text-sm">
                                                    <span className="font-medium text-slate-400">{DAY_LABELS[day]}</span>
                                                    <span className="text-slate-400 italic">Closed</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Session slots summary */}
                                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Clock className="w-4 h-4 text-blue-600" />
                                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Session Slots</p>
                                        </div>
                                        {slotCount > 0 ? (
                                            <>
                                                <p className="text-2xl font-bold text-slate-900">{slotCount}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">slot{slotCount !== 1 ? 's' : ''} available for parents to choose</p>
                                                <div className="mt-3 flex flex-wrap gap-1">
                                                    {(JSON.parse(centre.sessionSlots!) as string[]).slice(0, 3).map(s => (
                                                        <span key={s} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{s}</span>
                                                    ))}
                                                    {slotCount > 3 && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">+{slotCount - 3} more</span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No custom slots — default times will be used</p>
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
