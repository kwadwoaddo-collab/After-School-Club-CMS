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
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return { start: ISO_DATE(start), end: ISO_DATE(today) };
}

function getLastWeekRange(): { start: string; end: string } {
    const today = new Date();
    const lastMon = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const lastSun = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    return { start: ISO_DATE(lastMon), end: ISO_DATE(lastSun) };
}

function fmtDisplay(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return format(new Date(y, m - 1, d), 'd MMM yyyy');
}

function attendanceColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-600';
    if (rate >= 50) return 'text-amber-600';
    return 'text-red-600';
}

function attendanceBadgeClass(rate: number): string {
    if (rate >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (rate >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title, iconClass = 'text-blue-600', bgClass = 'bg-blue-50' }: {
    icon: React.ElementType;
    title: string;
    iconClass?: string;
    bgClass?: string;
}) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 ${bgClass} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${iconClass}`} />
            </div>
            <h3 className="font-bold text-foreground text-base">{title}</h3>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="py-10 text-center bg-secondary/40 rounded-2xl border border-border">
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
                    <tr className="bg-secondary/40 border-b border-border">
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
                <tbody className="divide-y divide-gray-100 bg-card">{children}</tbody>
            </table>
        </div>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    iconClass?: string;
    iconBg?: string;
    valueClass?: string;
}

function StatCard({ label, value, icon: Icon, iconClass = 'text-blue-600', iconBg = 'bg-blue-50', valueClass = 'text-foreground' }: StatCardProps) {
    return (
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={`w-8 h-8 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${iconClass}`} />
                </div>
            </div>
            <span className={`text-3xl font-bold leading-none ${valueClass}`}>{value}</span>
        </div>
    );
}

// ─── Summary Section ──────────────────────────────────────────────────────────

function SummarySection({ summary }: { summary: WeeklyReportData['summary'] }) {
    const rate = summary.attendanceRate;
    const rateIconClass = rate != null ? attendanceColor(rate) : 'text-muted-foreground';

    const stats: StatCardProps[] = [
        { label: 'New Registrations', value: summary.newRegistrations, icon: Users, iconClass: 'text-blue-600', iconBg: 'bg-blue-50' },
        { label: 'New Bookings', value: summary.newBookings, icon: BookOpen, iconClass: 'text-violet-600', iconBg: 'bg-violet-50' },
        { label: 'Sessions Run', value: summary.sessionsRun, icon: CalendarCheck, iconClass: 'text-emerald-600', iconBg: 'bg-emerald-50' },
        {
            label: 'Attendance Rate',
            value: rate != null ? `${rate}%` : '—',
            icon: BarChart3,
            iconClass: rateIconClass,
            iconBg: rate != null && rate >= 80 ? 'bg-emerald-50' : rate != null && rate >= 50 ? 'bg-amber-50' : 'bg-red-50',
            valueClass: rateIconClass,
        },
        { label: 'Pending This Period', value: summary.pendingRegistrationsThisPeriod, icon: Clock, iconClass: 'text-amber-600', iconBg: 'bg-amber-50', valueClass: 'text-amber-700' },
        { label: 'Overdue Follow-ups', value: summary.overdueFollowUps, icon: AlertTriangle, iconClass: 'text-red-600', iconBg: 'bg-red-50', valueClass: summary.overdueFollowUps > 0 ? 'text-red-600' : 'text-foreground' },
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

// ─── New Registrations ────────────────────────────────────────────────────────

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
                                    ? 'border-l-2 border-l-amber-400 bg-amber-50/40 hover:bg-amber-50'
                                    : 'hover:bg-secondary/40'
                                }`}
                            >
                                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{r.childNames}</td>
                                <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{r.parentName}</td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                    <div>{r.parentEmail}</div>
                                    <div>{r.parentPhone}</div>
                                </td>
                                <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{r.centre}</td>
                                <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{r.startDate}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {isOverdue ? (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
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

// ─── New Bookings ─────────────────────────────────────────────────────────────

function NewBookingsSection({ rows }: { rows: WeeklyReportData['newBookings'] }) {
    const headers = ['Child(ren)', 'Parent', 'Contact', 'Centre', 'Session Date', 'Status', 'Attendance'];
    return (
        <div>
            <SectionHeading icon={BookOpen} title="New Bookings" iconClass="text-violet-600" bgClass="bg-violet-50" />
            {rows.length === 0 ? (
                <EmptyState message="No new bookings for this period." />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((b, i) => (
                        <tr key={i} className="hover:bg-secondary/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{b.childNames}</td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{b.parentName}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{b.parentEmail}</td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{b.centre}</td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{b.sessionDate}</td>
                            <td className="px-4 py-3">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                    {b.bookingStatus}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground/80 whitespace-nowrap">{b.attendance}</td>
                        </tr>
                    ))}
                </TableWrapper>
            )}
        </div>
    );
}

// ─── Attendance by Centre ─────────────────────────────────────────────────────

function AttendanceSection({ rows }: { rows: WeeklyReportData['attendanceByCentre'] }) {
    const headers = ['Centre', 'Sessions', 'Expected', 'Attended', 'Rate'];
    return (
        <div>
            <SectionHeading icon={BarChart3} title="Attendance by Centre" iconClass="text-emerald-600" bgClass="bg-emerald-50" />
            {rows.length === 0 ? (
                <EmptyState message="No attendance data for this period." />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((a) => (
                        <tr key={a.centreId} className="hover:bg-secondary/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">{a.centre}</td>
                            <td className="px-4 py-3 text-foreground/80">{a.sessionsRun}</td>
                            <td className="px-4 py-3 text-foreground/80">{a.studentsExpected}</td>
                            <td className="px-4 py-3 text-foreground/80">{a.studentsAttended}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${attendanceBadgeClass(a.attendanceRate)}`}>
                                    {a.attendanceRate}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </TableWrapper>
            )}
        </div>
    );
}

// ─── Pending Actions ──────────────────────────────────────────────────────────

const PENDING_TYPE_LABELS: Record<WeeklyReportData['pendingActions'][number]['type'], string> = {
    overdue_registration: 'Overdue Reg.',
    missed_attendance: 'Missed Attendance',
};

const PENDING_TYPE_COLORS: Record<WeeklyReportData['pendingActions'][number]['type'], string> = {
    overdue_registration: 'bg-amber-50 text-amber-700 border-amber-200',
    missed_attendance: 'bg-red-50 text-red-700 border-red-200',
};

function PendingActionsSection({ rows }: { rows: WeeklyReportData['pendingActions'] }) {
    const headers = ['Type', 'Name', 'Description', 'Date', 'Days Pending'];
    return (
        <div>
            <SectionHeading icon={AlertTriangle} title="Pending Actions" iconClass="text-amber-600" bgClass="bg-amber-50" />
            {rows.length === 0 ? (
                <EmptyState message="No pending actions — all clear! 🎉" />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((p, i) => (
                        <tr key={i} className="hover:bg-secondary/40 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${PENDING_TYPE_COLORS[p.type]}`}>
                                    {PENDING_TYPE_LABELS[p.type]}
                                </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{p.name}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{p.description}</td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{p.date}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${p.daysPending >= 7
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
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
    const [rangeMode, setRangeMode] = useState<RangeMode>('this_week');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    function getRange(): { start: string; end: string } | null {
        if (rangeMode === 'this_week') return getThisWeekRange();
        if (rangeMode === 'last_week') return getLastWeekRange();
        if (customStart && customEnd) return { start: customStart, end: customEnd };
        return null;
    }

    const handlePreview = useCallback(async () => {
        const range = getRange();
        if (!range) { setError('Please select both a start and end date.'); return; }
        if (range.end < range.start) { setError('End date must be after start date.'); return; }

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



    return (
        <div className="flex flex-col gap-6">

            {/* ── Date Range Card ──────────────────────────────────────────── */}
            <div className="bg-card border border-border rounded-3xl p-8 flex flex-col gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-xl leading-tight">CEO Weekly Activity Report</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Preview and download an executive summary for the selected period</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {(['this_week', 'last_week', 'custom'] as const).map((mode) => {
                        const label = mode === 'this_week' ? 'This Week' : mode === 'last_week' ? 'Last Week' : 'Custom Range';
                        return (
                            <button
                                key={mode}
                                onClick={() => { setRangeMode(mode); setReportData(null); setError(null); setPdfError(null); }}
                                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border ${rangeMode === mode
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-border hover:bg-secondary/40'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Custom range inputs */}
                {rangeMode === 'custom' && (
                    <div className="p-5 bg-secondary/40 rounded-2xl border border-border animate-in fade-in zoom-in-95 duration-200 space-y-4">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Date Range</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Start Date</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-sm text-foreground font-mono outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">End Date</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-sm text-foreground font-mono outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Preview CTA */}
                <button
                    onClick={handlePreview}
                    disabled={isLoading || (rangeMode === 'custom' && (!customStart || !customEnd))}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl text-sm transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Generating Report…</>
                    ) : (
                        <><Calendar className="w-4 h-4" />Preview Report</>
                    )}
                </button>

                {error && (
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                        {error}
                    </div>
                )}
            </div>

            {/* ── Loading ──────────────────────────────────────────────────── */}
            {isLoading && (
                <div className="bg-card border border-border rounded-3xl p-16 flex flex-col items-center gap-4 shadow-sm">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">Fetching data for the selected period…</p>
                </div>
            )}

            {/* ── Report Preview ───────────────────────────────────────────── */}
            {reportData && !isLoading && (
                <div className="bg-card border border-border rounded-3xl p-8 flex flex-col gap-8 shadow-sm animate-in fade-in duration-300">

                    {/* Period header row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Report Period</p>
                            <h2 className="text-lg font-bold text-foreground">
                                {fmtDisplay(reportData.startDate)} – {fmtDisplay(reportData.endDate)}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Generated for {reportData.orgName} · by {reportData.generatedBy}
                            </p>
                        </div>

                        {/* Download PDF */}
                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isPdfLoading}
                                className="flex items-center gap-2 px-6 py-3 bg-card hover:bg-secondary/40 border border-border hover:border-border rounded-2xl text-sm font-semibold text-foreground transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPdfLoading ? (
                                    <><Loader2 className="w-4 h-4 text-blue-600 animate-spin" />Generating PDF…</>
                                ) : (
                                    <><Download className="w-4 h-4 text-blue-600" />Download PDF</>
                                )}
                            </button>
                            {pdfError && (
                                <p className="text-xs text-red-600 font-medium max-w-xs text-right">{pdfError}</p>
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
