'use client';

import { useState, useTransition, useEffect } from 'react';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import {
    CheckCircle2, XCircle, Clock, AlertTriangle,
    Loader2, ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Users,
    Maximize2, Minimize2, RefreshCw, Stethoscope, Edit2, Sparkles, Search
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

const playChime = (type: 'success' | 'error') => {
    try {
        const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        
        if (type === 'success') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            const now = ctx.currentTime;
            
            // High-fidelity double chime: G5 (783.99 Hz) then C6 (1046.50 Hz)
            osc.frequency.setValueAtTime(783.99, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            
            osc.frequency.setValueAtTime(1046.50, now + 0.12);
            gain.gain.setValueAtTime(0.1, now + 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            
            osc.start(now);
            osc.stop(now + 0.35);
        } else {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'triangle';
            const now = ctx.currentTime;
            
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(110, now + 0.25);
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
            
            osc.start(now);
            osc.stop(now + 0.25);
        }
    } catch (e) {
        console.error('Failed to play Web Audio API chime:', e);
    }
};

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | null;

interface Attendee {
    id: string;
    childId: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    notes?: string | null;
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string | null;
    parentEmail?: string | null;
    attendanceStatus: AttendanceStatus;
    attendanceNote: string | null;
    lateMinutes: number | null;
    isCatchUp: boolean;
    bookingId: string | null;
}

interface CompiledSlot {
    time: string;
    timeLabel: string;
    regulars: Attendee[];
    catchups: Attendee[];
}

interface Centre { id: string; name: string; }

interface Props {
    slots: CompiledSlot[];
    date: string;
    dateStr?: string;
    centreName: string;
    centres: Centre[];
    activeCentreId: string;
}

// ── Individual student card ───────────────────────────────────────────────────
function StudentCard({
    attendee,
    dateStr,
    sessionTime,
    centreId,
    isLarge,
    onToast,
}: {
    attendee: Attendee;
    dateStr: string;
    sessionTime: string;
    centreId: string;
    isLarge: boolean;
    onToast: ReturnType<typeof useToast>['toast'];
}) {
    const [curBookingId, setCurBookingId] = useState<string | null>(attendee.bookingId);
    const [curAttendeeId, setCurAttendeeId] = useState<string>(attendee.id);
    const [status, setStatus] = useState<AttendanceStatus>(attendee.attendanceStatus);
    const [note, setNote] = useState<string>(attendee.attendanceNote || '');
    const [lateMinutes, setLateMinutes] = useState<string>(
        attendee.lateMinutes != null ? attendee.lateMinutes.toString() : ''
    );
    const [showDetails, setShowDetails] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [flash, setFlash] = useState(false);

    const mark = (s: AttendanceStatus) => {
        const next = status === s ? null : s;
        if (next === 'late') setShowDetails(true);

        startTransition(async () => {
            try {
                const res = await markAttendeeAttendance({
                    bookingId: curBookingId,
                    attendeeId: curAttendeeId,
                    status: next,
                    note: note || null,
                    lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
                    childId: attendee.childId,
                    dateStr,
                    sessionTime,
                    centreId,
                });
                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId || attendee.id);
                }
                setStatus(next);
                setFlash(true);
                setTimeout(() => setFlash(false), 800);
                playChime('success');
            } catch (err: any) {
                playChime('error');
                onToast({ title: 'Could not mark attendance', message: 'Please try again or refresh.', variant: 'error' });
            }
        });
    };

    const saveDetails = () => {
        startTransition(async () => {
            try {
                const res = await markAttendeeAttendance({
                    bookingId: curBookingId,
                    attendeeId: curAttendeeId,
                    status,
                    note: note || null,
                    lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : null,
                    childId: attendee.childId,
                    dateStr,
                    sessionTime,
                    centreId,
                });
                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId || attendee.id);
                }
                setFlash(true);
                setTimeout(() => setFlash(false), 800);
                playChime('success');
            } catch (err: any) {
                playChime('error');
                onToast({ title: 'Could not save details', message: 'Please try again.', variant: 'error' });
            }
        });
    };

    const hasAlert = !!attendee.notes;
    const initials = `${(attendee.firstName || '')[0] || ''}${(attendee.lastName || '')[0] || ''}`.toUpperCase() || '??';

    const statusStyle = {
        present: { ring: 'border-tertiary/30 bg-tertiary-container/5 ring-2 ring-tertiary/10 glow-hover-tertiary', avatar: 'bg-tertiary/20 text-tertiary' },
        absent:  { ring: 'border-error/30 bg-error-container/5 ring-2 ring-error/10 glow-hover-error',         avatar: 'bg-error-container/20 text-error' },
        late:    { ring: 'border-warning/30 bg-warning/5 ring-2 ring-warning/10 glow-hover-warning',     avatar: 'bg-warning/20 text-warning' },
        excused: { ring: 'border-secondary/30 bg-secondary-container/5 ring-2 ring-secondary/10 glow-hover-secondary',   avatar: 'bg-secondary-container/20 text-secondary' },
    };

    const style = status ? statusStyle[status] : { ring: 'bg-card border border-border shadow-sm hover:border-primary/30 glow-hover-primary', avatar: 'bg-secondary/60 text-muted-foreground' };
    const pad = isLarge ? 'p-5' : 'p-4';
    const avatarSize = isLarge ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base';
    const btnSize = isLarge ? 'h-16 text-sm gap-2 px-4 min-w-[88px]' : 'h-11 text-xs gap-1.5 px-3 min-w-[72px]';

    return (
        <div className="space-y-2">
            <div className={`rounded-2xl border transition-all duration-200 ${pad} ${style.ring} ${flash ? 'scale-[0.98]' : ''} flex flex-col gap-4`}>
                {/* Top Section: Avatar and Info */}
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`${avatarSize} rounded-xl flex items-center justify-center font-black flex-shrink-0 transition-colors ${style.avatar}`}>
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-bold text-foreground truncate ${isLarge ? 'text-lg' : 'text-base'}`}>
                                {attendee.firstName} {attendee.lastName}
                            </p>
                            {lateMinutes && parseInt(lateMinutes) > 0 && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/15 border border-warning/20 text-warning text-[10px] font-bold">
                                    <Sparkles className="w-2.5 h-2.5" /> Late
                                </span>
                            )}
                            {hasAlert && (
                                <span title={attendee.notes!} className="flex-shrink-0">
                                    <Stethoscope className="w-4 h-4 text-error" />
                                </span>
                            )}
                            {(hasAlert || (lateMinutes && parseInt(lateMinutes) > 0)) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-warning" title="Has notes/late minutes" />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Year {attendee.schoolYear} · {attendee.parentFirstName} {attendee.parentLastName}
                            {attendee.parentPhone && ` · ${attendee.parentPhone}`}
                            {lateMinutes && ` · Late: ${lateMinutes}m`}
                            {note && ` · "${note}"`}
                        </p>
                        {hasAlert && (
                            <p className="text-xs text-error mt-1.5 font-medium">⚠ {attendee.notes}</p>
                        )}
                    </div>
                </div>

                {/* Bottom Section: Action buttons */}
                {!isPending && (
                    <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-3 w-full">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            title="Add Notes/Details"
                            className={`${btnSize} rounded-xl font-bold flex items-center justify-center transition-all border ${showDetails
                                ? 'bg-primary/20 border-primary/40 text-primary shadow-[0_0_12px_rgba(142,171,255,0.15)]'
                                : 'bg-secondary/60 border-border text-muted-foreground hover:text-foreground hover:border-border'
                            }`}
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        {([
                            { s: 'present' as const, icon: <CheckCircle2 className="w-4 h-4" />, label: 'In',   active: 'bg-tertiary text-slate-950 shadow-[0_0_15px_-3px_rgba(92,253,128,0.4)] border-tertiary/20', inactive: 'bg-secondary/60 border-border/50 text-muted-foreground hover:text-tertiary hover:border-tertiary/20' },
                            { s: 'late'    as const, icon: <Clock className="w-4 h-4" />,        label: 'Late', active: 'bg-warning text-background shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)] border-warning/20',   inactive: 'bg-secondary/60 border-border/50 text-muted-foreground hover:text-warning hover:border-warning/20'   },
                            { s: 'absent'  as const, icon: <XCircle className="w-4 h-4" />,      label: 'Out',  active: 'bg-error text-background shadow-[0_0_15px_-3px_rgba(255,113,108,0.4)] border-error/20',     inactive: 'bg-secondary/60 border-border/50 text-muted-foreground hover:text-error hover:border-error/20'     },
                        ]).map(({ s, icon, label, active, inactive }) => (
                            <button
                                key={s}
                                onClick={() => mark(s)}
                                className={`${btnSize} border rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 flex-1 ${status === s ? active : inactive}`}
                            >
                                {icon} <span className="ml-1">{label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Note & Late Minutes Drawer */}
            {showDetails && (
                <div className="bg-secondary/60 border border-border rounded-2xl p-4 ml-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Attendance Note</label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add custom notes..."
                                className="w-full h-10 px-3 rounded-xl bg-secondary/60 border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:border-primary/40 transition-colors"
                            />
                        </div>
                        <div className="w-full sm:w-28">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Late Mins</label>
                            <input
                                type="number"
                                value={lateMinutes}
                                onChange={(e) => setLateMinutes(e.target.value)}
                                placeholder="Minutes"
                                min="0"
                                className="w-full h-10 px-3 rounded-xl bg-secondary/60 border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:border-primary/40 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setShowDetails(false)}
                            className="px-3.5 py-1.5 rounded-xl bg-secondary/60 border border-border text-foreground/60 hover:text-foreground text-xs font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveDetails}
                            disabled={isPending}
                            className="px-3.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                            Save Details
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Kiosk Register ───────────────────────────────────────────────────────
export default function KioskRegister({ slots, date, dateStr, centreName, centres, activeCentreId }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [slotIdx, setSlotIdx] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [clock, setClock] = useState(() => new Date());
    const [large, setLarge] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);

    // Derive a dateStr from date prop if not passed separately
    const resolvedDateStr = dateStr || new Date().toISOString().slice(0, 10);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Auto-refresh every 60s
    useEffect(() => {
        const t = setInterval(() => router.refresh(), 60_000);
        return () => clearInterval(t);
    }, [router]);

    // Sync fullscreen state with browser events (e.g. Esc key)
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Aggregate stats across all slots
    const allAttendees = slots.flatMap(s => [...s.regulars, ...s.catchups]);
    const totalCount   = allAttendees.length;
    const presentCount = allAttendees.filter(a => a.attendanceStatus === 'present').length;
    const absentCount  = allAttendees.filter(a => a.attendanceStatus === 'absent').length;
    const lateCount    = allAttendees.filter(a => a.attendanceStatus === 'late').length;
    const unmarkedCount = allAttendees.filter(a => a.attendanceStatus === null).length;
    const progressPct  = totalCount > 0 ? Math.round(((totalCount - unmarkedCount) / totalCount) * 100) : 0;

    const activeSlot = slots.length > 0 ? slots[Math.min(slotIdx, slots.length - 1)] : null;
    const rawAttendees = activeSlot
        ? [...activeSlot.regulars, ...activeSlot.catchups]
        : [];

    const searchQueryClean = searchQuery.toLowerCase().trim();
    const filteredAttendees = rawAttendees.filter(a => {
        if (!searchQueryClean) return true;
        return (
            a.firstName.toLowerCase().includes(searchQueryClean) ||
            a.lastName.toLowerCase().includes(searchQueryClean) ||
            `${a.firstName} ${a.lastName}`.toLowerCase().includes(searchQueryClean) ||
            `${a.parentFirstName} ${a.parentLastName}`.toLowerCase().includes(searchQueryClean) ||
            (a.parentEmail && a.parentEmail.toLowerCase().includes(searchQueryClean)) ||
            (a.parentPhone && a.parentPhone.includes(searchQueryClean)) ||
            a.schoolYear.toLowerCase().includes(searchQueryClean)
        );
    });

    const displayAttendees = [...filteredAttendees]
        .filter(a => {
            if (!showUnmarkedOnly) return true;
            return a.attendanceStatus === null;
        })
        .sort((a, b) => {
            const aUnmarked = a.attendanceStatus === null;
            const bUnmarked = b.attendanceStatus === null;
            const aAlert = !!a.notes;
            const bAlert = !!b.notes;

            // Tier 1 — Unmarked with medical alert (most urgent)
            if (aUnmarked && aAlert && !(bUnmarked && bAlert)) return -1;
            if (bUnmarked && bAlert && !(aUnmarked && aAlert)) return 1;

            // Tier 2 — Unmarked without alert
            if (aUnmarked && !bUnmarked) return -1;
            if (!aUnmarked && bUnmarked) return 1;

            // Tier 3 — Already marked, alphabetical
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        });

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-secondary/20 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 overflow-hidden">

            {/* ── TOP BAR ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 bg-card/80 backdrop-blur-md border-b border-border flex-shrink-0">
                <div>
                    <h1 className="text-foreground font-black text-lg leading-tight tracking-tight">Daily Register</h1>
                    <p className="text-muted-foreground text-xs mt-0.5 font-medium">{date} · {centreName}</p>
                </div>

                <div className="text-foreground font-black text-4xl tabular-nums tracking-tight">
                    {format(clock, 'HH:mm')}
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => router.refresh()} aria-label="Refresh register" title="Refresh"
                        className="p-2.5 rounded-xl bg-secondary/60 border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => setLarge(v => !v)} aria-label="Toggle card density" title="Toggle size"
                        className="p-2.5 rounded-xl bg-secondary/60 border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all">
                        {large ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
                    </button>
                    <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        className="p-2.5 rounded-xl bg-secondary/60 border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all">
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    {centres.length > 1 && (
                        <select
                            value={activeCentreId}
                            onChange={e => router.push(`/dashboard/kiosk?centre=${e.target.value}`)}
                            className="bg-secondary/60 border border-border text-foreground text-xs font-bold px-3 py-2.5 rounded-xl outline-none focus:border-primary/50 transition-colors"
                        >
                            <option value="all">All Centres</option>
                            {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* ── STATS BAR ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-0 bg-secondary/50 border-b border-border flex-shrink-0">
                {[
                    { label: 'Total',    value: totalCount,    color: 'text-foreground' },
                    { label: 'Present',  value: presentCount,  color: 'text-tertiary' },
                    { label: 'Late',     value: lateCount,     color: 'text-warning' },
                    { label: 'Absent',   value: absentCount,   color: 'text-error' },
                    { label: 'Unmarked', value: unmarkedCount, color: unmarkedCount > 0 ? 'text-warning' : 'text-muted-foreground/50' },
                ].map((stat, i) => (
                    <div key={stat.label} className={`flex-1 py-3 text-center ${i > 0 ? 'border-l border-border' : ''}`}>
                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest">{stat.label}</p>
                    </div>
                ))}
                <div className="flex-1 py-3 px-4 border-l border-border">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest">Done</p>
                        <p className="text-xs font-black text-foreground">{progressPct}%</p>
                    </div>
                    <div className="h-1.5 bg-secondary/60 rounded-full">
                        <div
                            className="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── SESSION SLOT TABS ──────────────────────────────────────── */}
            {slots.length > 0 && (
                <div className="flex items-center gap-2 px-6 py-3 bg-secondary/30 border-b border-border overflow-x-auto flex-shrink-0">
                    {slots.map((slot, i) => {
                        const slotAll = [...slot.regulars, ...slot.catchups];
                        const slotPresent = slotAll.filter(a => a.attendanceStatus === 'present').length;
                        const slotDone = slotAll.length > 0 && slotAll.every(a => a.attendanceStatus !== null);
                        return (
                            <button key={slot.time} onClick={() => setSlotIdx(i)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 border transition-all ${
                                    i === slotIdx
                                        ? 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_15px_-3px_rgba(142,171,255,0.2)]'
                                        : 'bg-secondary/60 border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                                }`}>
                                {slotDone && <CheckCircle2 className="w-3.5 h-3.5 text-tertiary" />}
                                {slot.timeLabel}
                                <span className="text-[11px] opacity-60">{slotPresent}/{slotAll.length}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── SEARCH BAR ────────────────────────────────────────────── */}
            {slots.length > 0 && (
                <div className="px-6 py-2.5 bg-secondary/20 border-b border-border flex items-center gap-3 flex-shrink-0">
                    {/* Search input — full width, no max-w-md */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search students by name or parent..."
                            className="w-full h-10 pl-10 pr-10 rounded-xl bg-card/80 backdrop-blur-md border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-300"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground text-xs font-bold px-1.5 py-0.5 rounded bg-secondary"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Unmarked Only chip */}
                    <button
                        onClick={() => setShowUnmarkedOnly(v => !v)}
                        aria-pressed={showUnmarkedOnly}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                            showUnmarkedOnly
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                        }`}
                    >
                        Unmarked only
                        {showUnmarkedOnly && unmarkedCount > 0 && (
                            <span className="ml-1.5 text-primary-foreground/70">{unmarkedCount}</span>
                        )}
                    </button>

                    {searchQuery && (
                        <p className="text-xs text-muted-foreground font-medium flex-shrink-0">
                            Found {displayAttendees.length} student{displayAttendees.length === 1 ? '' : 's'}
                        </p>
                    )}
                </div>
            )}

            {/* ── STUDENT LIST ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {slots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                        <div className="w-20 h-20 rounded-3xl bg-secondary/60 flex items-center justify-center mb-5">
                            <Users className="w-12 h-12 text-muted-foreground/50" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">No sessions today</h2>
                        <p className="text-muted-foreground text-sm max-w-xs mb-5">
                            No children are scheduled for today. Check the correct centre is selected above.
                        </p>
                        <Link
                            href="/dashboard/attendance"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
                        >
                            Go to Roll Call &rarr;
                        </Link>
                    </div>
                ) : displayAttendees.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground/50 text-sm">
                        {searchQuery ? 'No matching students found' : 'No students in this slot'}
                    </div>
                ) : (
                    <div className={`grid gap-4 p-6 ${large ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                        {displayAttendees.map(a => (
                            <StudentCard
                                key={a.id}
                                attendee={a}
                                dateStr={resolvedDateStr}
                                sessionTime={activeSlot!.time}
                                centreId={activeCentreId}
                                isLarge={large}
                                onToast={toast}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── BOTTOM NAV ───────────────────────────────────────────── */}
            {slots.length > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/80 backdrop-blur-md flex-shrink-0">
                    <button onClick={() => setSlotIdx(i => Math.max(0, i - 1))} disabled={slotIdx === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/60 border border-border/50 text-foreground font-bold text-sm disabled:opacity-30 hover:bg-secondary transition-all">
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <p className="text-muted-foreground text-sm">Slot {slotIdx + 1} of {slots.length}</p>
                    <button onClick={() => setSlotIdx(i => Math.min(slots.length - 1, i + 1))} disabled={slotIdx === slots.length - 1}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/60 border border-border/50 text-foreground font-bold text-sm disabled:opacity-30 hover:bg-secondary transition-all">
                        Next <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
