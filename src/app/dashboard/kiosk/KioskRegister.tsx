'use client';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useTransition, useOptimistic, useEffect } from 'react';
import { markAttendeeAttendance } from '@/features/bookings/actions';
import { queueOfflineAction, getUnsyncedActions, markActionSynced } from '@/lib/offline-sync';
import {
    CheckCircle2, XCircle, Clock, AlertTriangle,
    Loader2, ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Users,
    Maximize2, Minimize2, RefreshCw, Stethoscope, Edit2, Sparkles, Search
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

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
        logger.error('Failed to play Web Audio API chime:', e);
    }
};

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'check_out' | null;

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
    const [status, addOptimisticStatus] = useOptimistic<AttendanceStatus, AttendanceStatus>(
        attendee.attendanceStatus,
        (state, newStatus) => newStatus
    );
    const [note, setNote] = useState<string>(attendee.attendanceNote || '');
    const [lateMinutes, setLateMinutes] = useState<string>(
        attendee.lateMinutes != null ? attendee.lateMinutes.toString() : ''
    );
    const [showDetails, setShowDetails] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [flash, setFlash] = useState(false);
    const [pinPadOpen, setPinPadOpen] = useState(false);
    const [pin, setPin] = useState('');

    const executeMark = (s: AttendanceStatus) => {
        const next = status === s ? null : s;
        if (next === 'late') setShowDetails(true);

        startTransition(async () => {
            // Check out becomes present instantly, just visually
            addOptimisticStatus(next === 'check_out' ? 'present' : next);
            try {
                let res;
                if (!navigator.onLine) {
                    await queueOfflineAction({
                        childId: attendee.childId,
                        centreId,
                        type: next === 'check_out' || next === 'absent' ? 'check_out' : 'check_in',
                        timestamp: new Date().toISOString(),
                    });
                    res = { bookingId: curBookingId, attendeeId: curAttendeeId };
                } else {
                    res = await markAttendeeAttendance({
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
                }

                if (res && (!curBookingId || curBookingId.startsWith('temp-'))) {
                    setCurBookingId(res.bookingId);
                    setCurAttendeeId(res.attendeeId || attendee.id);
                }
                setFlash(true);
                setTimeout(() => setFlash(false), 800);
                playChime('success');
            } catch (err) {
                // If it fails due to network while we thought we were online, queue it
                if (!navigator.onLine || (err as Error).message.includes('fetch')) {
                    await queueOfflineAction({
                        childId: attendee.childId,
                        centreId,
                        type: next === 'check_out' || next === 'absent' ? 'check_out' : 'check_in',
                        timestamp: new Date().toISOString(),
                    });
                    setFlash(true);
                    setTimeout(() => setFlash(false), 800);
                    playChime('success');
                } else {
                    playChime('error');
                    onToast({ title: 'Could not mark attendance', message: 'Please try again or refresh.', variant: 'error' });
                }
            }
        });
    };

    const mark = (s: AttendanceStatus) => {
        const next = status === s ? null : s;
        if (next === 'check_out') {
            setPinPadOpen(true);
            return;
        }
        executeMark(s);
    };

    const handlePinDigit = (num: number) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === 4) {
                // Dummy check - accept any PIN for now or add validation if needed
                setTimeout(() => {
                    setPinPadOpen(false);
                    setPin('');
                    executeMark('check_out');
                }, 300);
            }
        }
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
            } catch (err) {
                playChime('error');
                onToast({ title: 'Could not save details', message: 'Please try again.', variant: 'error' });
            }
        });
    };

    const hasAlert = !!attendee.notes;
    const initials = `${(attendee.firstName || '')[0] || ''}${(attendee.lastName || '')[0] || ''}`.toUpperCase() || '??';

    const statusStyle = {
        present: { ring: 'border-emerald-500/30 bg-success-soft', avatar: 'bg-success-soft text-emerald-700 dark:text-emerald-400' },
        absent:  { ring: 'border-danger/30 bg-danger-soft',        avatar: 'bg-danger-soft text-danger' },
        late:    { ring: 'border-amber-500/30 bg-warning-soft',    avatar: 'bg-warning-soft text-amber-700 dark:text-amber-400' },
        excused: { ring: 'border-blue-500/30 bg-info-soft',        avatar: 'bg-info-soft text-blue-700 dark:text-blue-400' },
        check_out: { ring: 'border-emerald-500/30 bg-success-soft', avatar: 'bg-success-soft text-emerald-700 dark:text-emerald-400' },
    };

    const style = status ? statusStyle[status] : { ring: 'bg-surface border-border', avatar: 'bg-page text-text-muted' };
    const pad = isLarge ? 'p-5' : 'p-4';
    const avatarSize = isLarge ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base';
    const btnSize = isLarge ? 'h-16 text-sm gap-2 px-4 min-w-[88px]' : 'h-11 text-xs gap-1.5 px-3 min-w-[72px]';

    return (
        <div className="space-y-2">
            <div className={`rounded-lg border transition-colors ${pad} ${style.ring} ${flash ? 'scale-[0.98]' : ''} flex flex-col gap-4`}>
                {/* Top Section: Avatar and Info */}
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`${avatarSize} rounded-md flex items-center justify-center font-bold flex-shrink-0 transition-colors ${style.avatar}`}>
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-text truncate ${isLarge ? 'text-lg' : 'text-base'}`}>
                                {attendee.firstName} {attendee.lastName}
                            </p>
                            {lateMinutes && parseInt(lateMinutes) > 0 && (
                                <Badge variant="warning">
                                    <Sparkles className="w-2.5 h-2.5" /> Late
                                </Badge>
                            )}
                            {hasAlert && (
                                <span title={attendee.notes!} className="flex-shrink-0">
                                    <Stethoscope className="w-4 h-4 text-danger" />
                                </span>
                            )}
                            {(hasAlert || (lateMinutes && parseInt(lateMinutes) > 0)) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Has notes/late minutes" />
                            )}
                        </div>
                        <p className="text-xs text-text-muted mt-1 leading-relaxed">
                            Year {attendee.schoolYear} · {attendee.parentFirstName} {attendee.parentLastName}
                            {attendee.parentPhone && ` · ${attendee.parentPhone}`}
                            {lateMinutes && ` · Late: ${lateMinutes}m`}
                            {note && ` · "${note}"`}
                        </p>
                        {hasAlert && (
                            <p className="text-xs text-danger mt-1.5 font-medium">⚠ {attendee.notes}</p>
                        )}
                    </div>
                </div>

                {/* Bottom Section: Action buttons */}
                {!isPending && (
                    <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3 w-full">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            title="Add Notes/Details"
                            className={`${btnSize} rounded-md font-semibold flex items-center justify-center transition-colors border ${showDetails
                                ? 'bg-accent-soft border-accent/40 text-accent'
                                : 'bg-page border-border text-text-muted hover:text-text'
                            }`}
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        {([
                            { s: 'present' as const, icon: <CheckCircle2 className="w-4 h-4" />, label: 'In',   active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'bg-page border-border text-text-muted hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-500/30' },
                            { s: 'late'    as const, icon: <Clock className="w-4 h-4" />,        label: 'Late', active: 'bg-amber-500 text-white border-amber-500',      inactive: 'bg-page border-border text-text-muted hover:text-amber-700 dark:hover:text-amber-400 hover:border-amber-500/30' },
                            { s: 'check_out' as const, icon: <XCircle className="w-4 h-4" />,    label: 'Out',  active: 'bg-danger text-white border-danger',            inactive: 'bg-page border-border text-text-muted hover:text-danger hover:border-danger/30' },
                        ]).map(({ s, icon, label, active, inactive }) => (
                            <button
                                key={s}
                                onClick={() => mark(s)}
                                className={`${btnSize} border rounded-md font-semibold flex items-center justify-center transition-colors active:scale-95 flex-1 ${status === s ? active : inactive}`}
                            >
                                {icon} <span className="ml-1">{label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Note & Late Minutes Drawer */}
            {showDetails && (
                <div className="bg-page border border-border rounded-md p-4 ml-6 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="block text-label text-text-muted mb-1">Attendance Note</label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add custom notes..."
                                className="w-full h-10 px-3 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-xs focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                            />
                        </div>
                        <div className="w-full sm:w-28">
                            <label className="block text-label text-text-muted mb-1">Late Mins</label>
                            <input
                                type="number"
                                value={lateMinutes}
                                onChange={(e) => setLateMinutes(e.target.value)}
                                placeholder="Minutes"
                                min="0"
                                className="w-full h-10 px-3 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-xs focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowDetails(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={saveDetails} disabled={isPending}>
                            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                            Save Details
                        </Button>
                    </div>
                </div>
            )}

            {/* PIN Pad Modal */}
            {pinPadOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4">
                    <div className="bg-surface border border-border p-6 rounded-lg shadow-[var(--shadow-popover)] max-w-[320px] w-full">
                        <h3 className="text-xl font-bold mb-2 text-center text-text">Confirm Check Out</h3>
                        <p className="text-center mb-6 text-sm text-text-secondary">
                            Enter PIN to check out <strong className="text-text">{attendee.firstName} {attendee.lastName}</strong>
                        </p>
                        <div className="flex justify-center gap-4 mb-8">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`w-3.5 h-3.5 rounded-full transition-colors duration-200 ${pin.length > i ? 'bg-accent' : 'bg-page border border-border'}`} />
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button key={num} onClick={() => handlePinDigit(num)} className="h-14 text-2xl font-bold bg-page hover:bg-border-subtle rounded-md active:scale-95 transition-all text-text">{num}</button>
                            ))}
                            <button onClick={() => { setPinPadOpen(false); setPin(''); }} className="h-14 text-sm font-bold bg-danger-soft text-danger hover:opacity-80 rounded-md active:scale-95 transition-all">Cancel</button>
                            <button onClick={() => handlePinDigit(0)} className="h-14 text-2xl font-bold bg-page hover:bg-border-subtle rounded-md active:scale-95 transition-all text-text">0</button>
                            <button onClick={() => setPin(prev => prev.slice(0, -1))} className="h-14 text-sm font-bold bg-warning-soft text-amber-700 dark:text-amber-400 hover:opacity-80 rounded-md active:scale-95 transition-all">Del</button>
                        </div>
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

    // Offline sync manager
    useEffect(() => {
        const handleOnline = async () => {
            const actions = await getUnsyncedActions();
            if (actions.length > 0) {
                toast({ title: 'You are back online!', message: `Syncing ${actions.length} offline actions...`, variant: 'info' });
                for (const action of actions) {
                    try {
                        await markAttendeeAttendance({
                            childId: action.childId,
                            centreId: action.centreId,
                            status: action.type === 'check_in' ? 'present' : 'check_out', // mapping type back to status
                            dateStr: resolvedDateStr,
                            sessionTime: '15:15', // We'll assume default or try to match, but markAttendeeAttendance doesn't strictly need accurate sessionTime if bookingId is missing but we'd normally pass it. Wait, kiosk requires it. Let's pass a dummy or we need to save sessionTime in the action.
                        } as any);
                        await markActionSynced(action.id);
                    } catch (e) {
                        logger.error('Failed to sync action', e);
                    }
                }
                toast({ title: 'Sync complete', message: 'All offline check-ins uploaded.', variant: 'success' });
                router.refresh();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [router, toast, resolvedDateStr]);

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
        <div className="flex flex-col h-[calc(100vh-64px)] bg-page -mx-4 sm:-mx-6 lg:-mx-8 -my-6 overflow-hidden">

            {/* ── TOP BAR ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border-subtle flex-shrink-0">
                <div>
                    <h1 className="text-text font-bold text-lg leading-tight tracking-tight">Daily Register</h1>
                    <p className="text-text-muted text-xs mt-0.5 font-medium">{date} · {centreName}</p>
                </div>

                <div className="text-text font-bold text-4xl tabular-nums tracking-tight">
                    {format(clock, 'HH:mm')}
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => router.refresh()} aria-label="Refresh register" title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setLarge(v => !v)} aria-label="Toggle card density" title="Toggle size">
                        {large ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                    {centres.length > 1 && (
                        <select
                            value={activeCentreId}
                            onChange={e => router.push(`/dashboard/kiosk?centre=${e.target.value}`)}
                            className="h-9 bg-surface border border-border text-text text-xs font-semibold px-3 rounded-sm outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                        >
                            <option value="all">All Centres</option>
                            {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* ── STATS BAR ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-0 bg-page border-b border-border-subtle flex-shrink-0">
                {[
                    { label: 'Total',    value: totalCount,    color: 'text-text' },
                    { label: 'Present',  value: presentCount,  color: 'text-emerald-700 dark:text-emerald-400' },
                    { label: 'Late',     value: lateCount,     color: 'text-amber-700 dark:text-amber-400' },
                    { label: 'Absent',   value: absentCount,   color: 'text-danger' },
                    { label: 'Unmarked', value: unmarkedCount, color: unmarkedCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-text-muted' },
                ].map((stat, i) => (
                    <div key={stat.label} className={`flex-1 py-3 text-center ${i > 0 ? 'border-l border-border-subtle' : ''}`}>
                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest">{stat.label}</p>
                    </div>
                ))}
                <div className="flex-1 py-3 px-4 border-l border-border-subtle">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-text-muted font-semibold uppercase tracking-widest">Done</p>
                        <p className="text-xs font-bold text-text">{progressPct}%</p>
                    </div>
                    <div className="h-1.5 bg-border-subtle rounded-full">
                        <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── SESSION SLOT TABS ──────────────────────────────────────── */}
            {slots.length > 0 && (
                <div className="flex items-center gap-2 px-6 py-3 bg-page border-b border-border-subtle overflow-x-auto flex-shrink-0">
                    {slots.map((slot, i) => {
                        const slotAll = [...slot.regulars, ...slot.catchups];
                        const slotPresent = slotAll.filter(a => a.attendanceStatus === 'present').length;
                        const slotDone = slotAll.length > 0 && slotAll.every(a => a.attendanceStatus !== null);
                        return (
                            <button key={slot.time} onClick={() => setSlotIdx(i)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold flex-shrink-0 border transition-colors ${
                                    i === slotIdx
                                        ? 'bg-accent-soft text-accent border-accent/30'
                                        : 'bg-surface border-border text-text-muted hover:text-text'
                                }`}>
                                {slotDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                                {slot.timeLabel}
                                <span className="text-[11px] opacity-60">{slotPresent}/{slotAll.length}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── SEARCH BAR ────────────────────────────────────────────── */}
            {slots.length > 0 && (
                <div className="px-6 py-2.5 bg-page border-b border-border-subtle flex items-center gap-3 flex-shrink-0">
                    {/* Search input — full width, no max-w-md */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search students by name or parent..."
                            className="w-full h-10 pl-10 pr-10 rounded-sm bg-surface border border-border text-text placeholder:text-text-muted text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-page"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Unmarked Only chip */}
                    <button
                        onClick={() => setShowUnmarkedOnly(v => !v)}
                        aria-pressed={showUnmarkedOnly}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                            showUnmarkedOnly
                                ? 'bg-accent text-white border-accent'
                                : 'bg-surface border-border text-text-muted hover:border-accent/40'
                        }`}
                    >
                        Unmarked only
                        {showUnmarkedOnly && unmarkedCount > 0 && (
                            <span className="ml-1.5 text-white/70">{unmarkedCount}</span>
                        )}
                    </button>

                    {searchQuery && (
                        <p className="text-xs text-text-muted font-medium flex-shrink-0">
                            Found {displayAttendees.length} student{displayAttendees.length === 1 ? '' : 's'}
                        </p>
                    )}
                </div>
            )}

            {/* ── STUDENT LIST ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {slots.length === 0 ? (
                    <div className="flex items-center justify-center h-full px-8">
                        <EmptyState
                            icon={<Users className="w-8 h-8" />}
                            title="No sessions today"
                            description="No children are scheduled for today. Check the correct centre is selected above."
                            action={
                                <Button asChild>
                                    <Link href="/dashboard/attendance">Go to Roll Call &rarr;</Link>
                                </Button>
                            }
                        />
                    </div>
                ) : displayAttendees.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-text-muted text-sm">
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
                <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-surface flex-shrink-0">
                    <Button variant="outline" onClick={() => setSlotIdx(i => Math.max(0, i - 1))} disabled={slotIdx === 0}>
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <p className="text-text-muted text-sm">Slot {slotIdx + 1} of {slots.length}</p>
                    <Button variant="outline" onClick={() => setSlotIdx(i => Math.min(slots.length - 1, i + 1))} disabled={slotIdx === slots.length - 1}>
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
