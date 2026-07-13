'use client';

import { useState, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import {
    Loader2, Download, Calendar, Users, BookOpen,
    CalendarCheck, Clock, AlertTriangle, BarChart3, FileText,
} from 'lucide-react';
import { getWeeklyReport, type WeeklyReportData } from '@/features/reports/weekly-report.action';
import { generateCEOReportPDF } from '@/lib/pdf-report';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RangeMode = 'this_week' | 'last_week' | 'custom';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ISO_DATE = (d: Date) => format(d, 'yyyy-MM-dd');

function getThisWeekRange(): { start: string; end: string } {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    return { start: ISO_DATE(start), end: ISO_DATE(today) };
}

function getLastWeekRange(): { start: string; end: string } {
    const today = new Date();
    const lastMon = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const lastSun = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    return { start: ISO_DATE(lastMon), end: ISO_DATE(lastSun) };
}

function fmtDisplay(iso: string): string {
    // Parse as local date to avoid UTC offset drift
    const [y, m, d] = iso.split('-').map(Number);
    return format(new Date(y, m - 1, d), 'd MMM yyyy');
}

function attendanceColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-400';
    if (rate >= 50) return 'text-amber-400';
    return 'text-red-400';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#2a2a2a] rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-foreground text-base">{title}</h3>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground font-medium italic">{message}</p>
        </div>
    );
}

interface TableWrapperProps {
    headers: string[];
    children: React.ReactNode;
}

function TableWrapper({ headers, children }: TableWrapperProps) {
    return (
        <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm min-w-max">
                <thead>
                    <tr className="bg-secondary/60 border-b border-border">
                        {headers.map((h) => (
                            <th
                                key={h}
                                className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#424754]/10">{children}</tbody>
            </table>
        </div>
    );
}

// ─── Summary stat cards ───────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    accentClass?: string;
}

function StatCard({ label, value, icon: Icon, accentClass = 'text-primary' }: StatCardProps) {
    return (
        <div className="bg-card border border-border shadow-sm glow-hover-primary rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
                <div className="w-8 h-8 bg-[#2a2a2a] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-4 h-4 ${accentClass}`} />
                </div>
            </div>
            <span className="text-3xl font-bold text-foreground leading-none">{value}</span>
        </div>
    );
}

// ─── Section: Summary ─────────────────────────────────────────────────────────

function SummarySection({ summary }: { summary: WeeklyReportData['summary'] }) {
    const stats: StatCardProps[] = [
        { label: 'New Registrations', value: summary.newRegistrations, icon: Users, accentClass: 'text-primary' },
        { label: 'New Bookings', value: summary.newBookings, icon: BookOpen, accentClass: 'text-[#d0bcff]' },
        { label: 'Sessions Run', value: summary.sessionsRun, icon: CalendarCheck, accentClass: 'text-emerald-400' },
        {
            label: 'Attendance Rate',
            value: summary.attendanceRate != null ? `${summary.attendanceRate}%` : '—',
            icon: BarChart3,
            accentClass: summary.attendanceRate != null ? attendanceColor(summary.attendanceRate) : 'text-muted-foreground',
        },
        { label: 'Pending This Period', value: summary.pendingRegistrationsThisPeriod, icon: Clock, accentClass: 'text-amber-400' },
        { label: 'Overdue Follow-ups', value: summary.overdueFollowUps, icon: AlertTriangle, accentClass: 'text-red-400' },
    ];

    return (
        <div>
            <SectionHeading icon={BarChart3} title="Summary" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {stats.map((s) => (
                    <StatCard key={s.label} {...s} />
                ))}
            </div>
        </div>
    );
}

// ─── Section: New Registrations ───────────────────────────────────────────────

function NewRegistrationsSection({ rows }: { rows: WeeklyReportData['newRegistrations'] }) {
    const headers = ['Child(ren)', 'Parent', 'Contact', 'Centre', 'Start Date', 'Status', 'Days'];
    return (
        <div>
            <SectionHeading icon={Users} title="New Registrations" />
            {rows.length === 0 ? (
                <EmptyState message="No new registrations for this period." />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((r, i) => {
                        const isOverdue = r.daysSinceSubmitted >= 3;
                        return (
                            <tr
                                key={i}
                                className={`transition-colors ${isOverdue
                                    ? 'border-l-2 border-l-amber-400/70 bg-amber-400/5 hover:bg-amber-400/10'
                                    : 'hover:bg-[#24272e]'
                                    }`}
                            >
                                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.childNames}</td>
                                <td className="px-4 py-3 text-[#c4c7d0] whitespace-nowrap">{r.parentName}</td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                    <div>{r.parentEmail}</div>
                                    <div>{r.parentPhone}</div>
                                </td>
                                <td className="px-4 py-3 text-[#c4c7d0] whitespace-nowrap">{r.centre}</td>
                                <td className="px-4 py-3 text-[#c4c7d0] whitespace-nowrap">{r.startDate}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#2a2a2a] text-primary border border-[#adc6ff]/20">
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {isOverdue ? (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400/15 text-amber-400 border border-amber-400/25">
                                            {r.daysSinceSubmitted}d
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">{r.daysSinceSubmitted}d</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </TableWrapper>
            )}
        </div>
    );
}

// ─── Section: New Bookings ────────────────────────────────────────────────────

function NewBookingsSection({ rows }: { rows: WeeklyReportData['newBookings'] }) {
    const headers = ['Child(ren)', 'Parent', 'Contact', 'Centre', 'Session Date', 'Status', 'Attendance'];
    return (
        <div>
            <SectionHeading icon={BookOpen} title="New Bookings" />
            {rows.length === 0 ? (
                <EmptyState message="No new bookings for this period." />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((b, i) => (
                        <tr key={i} className="hover:bg-[#24272e] transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{b.childNames}</td>
                            <td className="px-4 py-3 text-[#c4c7d0] whitespace-nowrap">{b.parentName}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{b.parentEmail}</td>
                            <td className="px-4 py-3 text-[#c4c7d0] whitespace-nowrap">{b.centre}</td>
                            <td className="px-4 py-3 text-[#c4c7d0] whitespace-nowrap">{b.sessionDate}</td>
                            <td className="px-4 py-3">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#2a2a2a] text-[#d0bcff] border border-[#d0bcff]/20">
                                    {b.bookingStatus}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-[#c4c7d0] whitespace-nowrap">{b.attendance}</td>
                        </tr>
                    ))}
                </TableWrapper>
            )}
        </div>
    );
}

// ─── Section: Attendance by Centre ───────────────────────────────────────────

function AttendanceSection({ rows }: { rows: WeeklyReportData['attendanceByCentre'] }) {
    const headers = ['Centre', 'Sessions', 'Expected', 'Attended', 'Rate'];
    return (
        <div>
            <SectionHeading icon={BarChart3} title="Attendance by Centre" />
            {rows.length === 0 ? (
                <EmptyState message="No attendance data for this period." />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((a) => (
                        <tr key={a.centreId} className="hover:bg-[#24272e] transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{a.centre}</td>
                            <td className="px-4 py-3 text-[#c4c7d0]">{a.sessionsRun}</td>
                            <td className="px-4 py-3 text-[#c4c7d0]">{a.studentsExpected}</td>
                            <td className="px-4 py-3 text-[#c4c7d0]">{a.studentsAttended}</td>
                            <td className={`px-4 py-3 font-bold ${attendanceColor(a.attendanceRate)}`}>
                                {a.attendanceRate}%
                            </td>
                        </tr>
                    ))}
                </TableWrapper>
            )}
        </div>
    );
}

// ─── Section: Pending Actions ─────────────────────────────────────────────────

const PENDING_TYPE_LABELS: Record<WeeklyReportData['pendingActions'][number]['type'], string> = {
    overdue_registration: 'Overdue Reg.',
    missed_attendance: 'Missed Attendance',
};

const PENDING_TYPE_COLORS: Record<WeeklyReportData['pendingActions'][number]['type'], string> = {
    overdue_registration: 'bg-amber-400/15 text-amber-400 border-amber-400/25',
    missed_attendance: 'bg-red-400/15 text-red-400 border-red-400/25',
};

function PendingActionsSection({ rows }: { rows: WeeklyReportData['pendingActions'] }) {
    const headers = ['Type', 'Name', 'Description', 'Date', 'Days Pending'];
    return (
        <div>
            <SectionHeading icon={AlertTriangle} title="Pending Actions" />
            {rows.length === 0 ? (
                <EmptyState message="No pending actions — all clear! 🎉" />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((p, i) => (
                        <tr key={i} className="hover:bg-[#24272e] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${PENDING_TYPE_COLORS[p.type]}`}>
                                    {PENDING_TYPE_LABELS[p.type]}
                                </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{p.name}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{p.description}</td>
                            <td className="px-4 py-3 text-[#c4c7d0] whitespace-nowrap">{p.date}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.daysPending >= 7
                                    ? 'bg-red-400/15 text-red-400 border border-red-400/25'
                                    : 'bg-amber-400/15 text-amber-400 border border-amber-400/25'
                                    }`}>
                                    {p.daysPending}d
                                </span>
                            </td>
                        </tr>
                    ))}
                </TableWrapper>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function WeeklyReportTab() {
    // ── Range mode ───────────────────────────────────────────────────────────
    const [rangeMode, setRangeMode] = useState<RangeMode>('this_week');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // ── Report state ─────────────────────────────────────────────────────────
    const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── PDF state ────────────────────────────────────────────────────────────
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    // ── Derived range ────────────────────────────────────────────────────────
    function getRange(): { start: string; end: string } | null {
        if (rangeMode === 'this_week') return getThisWeekRange();
        if (rangeMode === 'last_week') return getLastWeekRange();
        if (customStart && customEnd) return { start: customStart, end: customEnd };
        return null;
    }

    // ── Preview handler ───────────────────────────────────────────────────────
    const handlePreview = useCallback(async () => {
        const range = getRange();
        if (!range) {
            setError('Please select both a start and end date.');
            return;
        }
        if (range.end < range.start) {
            setError('End date must be after start date.');
            return;
        }

        setError(null);
        setPdfError(null);
        setReportData(null);
        setIsLoading(true);

        try {
            const data = await getWeeklyReport(range.start, range.end);
            setReportData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate report. Please try again.');
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangeMode, customStart, customEnd]);

    // ── PDF handler ───────────────────────────────────────────────────────────
    const handleDownloadPdf = useCallback(async () => {
        if (!reportData) return;
        setPdfError(null);
        setIsPdfLoading(true);
        try {
            await generateCEOReportPDF(reportData);
        } catch (err) {
            setPdfError(err instanceof Error ? err.message : 'PDF generation failed. Please try again.');
        } finally {
            setIsPdfLoading(false);
        }
    }, [reportData]);

    // ── Range pill button ─────────────────────────────────────────────────────
    const PillBtn = ({
        mode,
        label,
    }: {
        mode: RangeMode;
        label: string;
    }) => (
        <button
            onClick={() => {
                setRangeMode(mode);
                setReportData(null);
                setError(null);
                setPdfError(null);
            }}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border ${rangeMode === mode
                ? 'bg-[#adc6ff] text-[#131313] border-[#adc6ff] shadow-[0_4px_16px_rgba(173,198,255,0.2)]'
                : 'bg-[#2a2a2a] text-muted-foreground border-border hover:text-foreground hover:bg-[#353535]'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col gap-6">

            {/* ── Date Range Card ──────────────────────────────────────────────── */}
            <div className="bg-card rounded-[32px] p-8 flex flex-col gap-6 border border-border shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#2a2a2a] rounded-2xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-xl leading-tight">CEO Weekly Activity Report</h2>
                        <p className="text-sm text-muted-foreground mt-1">Preview and download an executive summary for the selected period</p>
                    </div>
                </div>

                {/* Pill buttons */}
                <div className="flex flex-wrap gap-3">
                    <PillBtn mode="this_week" label="This Week" />
                    <PillBtn mode="last_week" label="Last Week" />
                    <PillBtn mode="custom" label="Custom Range" />
                </div>

                {/* Custom range inputs */}
                {rangeMode === 'custom' && (
                    <div className="p-5 bg-[#2a2a2a] rounded-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Custom Range</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Start Date</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-full px-4 py-3 bg-secondary/60 border border-[#2a2a2a] rounded-2xl text-sm text-foreground font-mono outline-none focus:border-[#adc6ff]/50 focus:ring-2 focus:ring-[#adc6ff]/20 transition-all"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">End Date</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-full px-4 py-3 bg-secondary/60 border border-[#2a2a2a] rounded-2xl text-sm text-foreground font-mono outline-none focus:border-[#adc6ff]/50 focus:ring-2 focus:ring-[#adc6ff]/20 transition-all"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Preview button */}
                <button
                    onClick={handlePreview}
                    disabled={isLoading || (rangeMode === 'custom' && (!customStart || !customEnd))}
                    className="w-full py-4 bg-[#adc6ff] hover:bg-[#8facff] text-[#131313] font-bold rounded-2xl text-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex justify-center items-center gap-2 shadow-[0_4px_16px_rgba(173,198,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating Report…
                        </>
                    ) : (
                        <>
                            <Calendar className="w-4 h-4" />
                            Preview Report
                        </>
                    )}
                </button>

                {/* Error card */}
                {error && (
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}
            </div>

            {/* ── Loading spinner (full-page feel) ─────────────────────────────── */}
            {isLoading && (
                <div className="bg-card rounded-[32px] p-16 flex flex-col items-center gap-4 border border-border shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">Fetching data for the selected period…</p>
                </div>
            )}

            {/* ── Report Preview ────────────────────────────────────────────────── */}
            {reportData && !isLoading && (
                <div className="bg-card rounded-[32px] p-8 flex flex-col gap-8 border border-border shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-in fade-in duration-300">

                    {/* Period header row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Report Period</p>
                            <h2 className="text-lg font-bold text-foreground">
                                {fmtDisplay(reportData.startDate)} – {fmtDisplay(reportData.endDate)}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Generated for {reportData.orgName} · by {reportData.generatedBy}
                            </p>
                        </div>

                        {/* Download PDF button */}
                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isPdfLoading}
                                className="flex items-center gap-2 px-6 py-3 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-foreground transition-all border border-border hover:border-[#adc6ff]/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isPdfLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                        Generating PDF…
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 text-primary" />
                                        Download PDF
                                    </>
                                )}
                            </button>
                            {pdfError && (
                                <p className="text-xs text-red-400 font-medium max-w-xs text-right">{pdfError}</p>
                            )}
                        </div>
                    </div>

                    {/* 1. Summary */}
                    <SummarySection summary={reportData.summary} />

                    <hr className="border-border" />

                    {/* 2. New Registrations */}
                    <NewRegistrationsSection rows={reportData.newRegistrations} />

                    <hr className="border-border" />

                    {/* 3. New Bookings */}
                    <NewBookingsSection rows={reportData.newBookings} />

                    <hr className="border-border" />

                    {/* 4. Attendance by Centre */}
                    <AttendanceSection rows={reportData.attendanceByCentre} />

                    <hr className="border-border" />

                    {/* 5. Pending Actions */}
                    <PendingActionsSection rows={reportData.pendingActions} />
                </div>
            )}
        </div>
    );
}
