'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import {
    Loader2, Download, Calendar, Users, BookOpen,
    CalendarCheck, Clock, AlertTriangle, BarChart3, FileText,
} from 'lucide-react';
import { getWeeklyReport, type WeeklyReportData } from '@/features/reports/weekly-report.action';
import Link from 'next/link';
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
    if (rate >= 80) return 'text-success';
    if (rate >= 50) return 'text-warning';
    return 'text-destructive';
}

function attendanceBadgeClass(rate: number): string {
    if (rate >= 80) return 'bg-success/10 text-success border-success/20';
    if (rate >= 50) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title, iconClass = 'text-primary', bgClass = 'bg-primary/10' }: {
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
                <tbody className="divide-y divide-border bg-card">{children}</tbody>
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
    onClick?: () => void;
    clickable?: boolean;
}

function StatCard({ label, value, icon: Icon, iconClass = 'text-primary', iconBg = 'bg-primary/10', valueClass = 'text-foreground', onClick, clickable }: StatCardProps) {
    return (
        <div 
            className={`bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow ${clickable ? 'cursor-pointer hover:bg-secondary/80 hover:border-primary/20 active:scale-[0.98] transition-all' : ''}`}
            onClick={onClick}
        >
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
        { label: 'New Registrations', value: summary.newRegistrations, icon: Users, iconClass: 'text-primary', iconBg: 'bg-primary/10' },
        { label: 'New Bookings', value: summary.newBookings, icon: BookOpen, iconClass: 'text-primary', iconBg: 'bg-primary/10' },
        { label: 'Sessions Run', value: summary.sessionsRun, icon: CalendarCheck, iconClass: 'text-success', iconBg: 'bg-success/10' },
        {
            label: 'Attendance Rate',
            value: rate != null ? `${rate}%` : '—',
            icon: BarChart3,
            iconClass: rateIconClass,
            iconBg: rate != null && rate >= 80 ? 'bg-success/10' : rate != null && rate >= 50 ? 'bg-warning/10' : 'bg-destructive/10',
            valueClass: rateIconClass,
        },
        { label: 'Pending This Period', value: summary.pendingRegistrationsThisPeriod, icon: Clock, iconClass: 'text-warning', iconBg: 'bg-warning/10', valueClass: 'text-warning', clickable: true, onClick: () => document.getElementById('pending-actions-section')?.scrollIntoView({ behavior: 'smooth' }) },
        { label: 'Overdue Follow-ups', value: summary.overdueFollowUps, icon: AlertTriangle, iconClass: 'text-destructive', iconBg: 'bg-destructive/10', valueClass: summary.overdueFollowUps > 0 ? 'text-destructive' : 'text-foreground', clickable: true, onClick: () => document.getElementById('pending-actions-section')?.scrollIntoView({ behavior: 'smooth' }) },
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

function renderChildLinks(
    children: { id: string | null; name: string }[] | undefined,
    fallbackText: string,
    fallbackHref?: string,
) {
    if (!children || children.length === 0) {
        return fallbackHref ? (
            <Link href={fallbackHref} className="text-primary hover:underline">
                {fallbackText}
            </Link>
        ) : (
            fallbackText
        );
    }
    return children.map((child, idx) => (
        <span key={`${child.id ?? child.name}-${idx}`}>
            {idx > 0 && ', '}
            {child.id ? (
                <Link href={`/dashboard/students/${child.id}`} className="text-primary hover:underline">
                    {child.name}
                </Link>
            ) : fallbackHref ? (
                <Link href={fallbackHref} className="text-primary hover:underline">
                    {child.name}
                </Link>
            ) : (
                child.name
            )}
        </span>
    ));
}

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
                        const regHref = r.regId ? `/dashboard/registrations/${r.regId}` : undefined;
                        return (
                            <tr
                                key={i}
                                className={`transition-colors ${isOverdue
                                    ? 'border-l-2 border-l-warning bg-warning/10 hover:bg-warning/20'
                                    : 'hover:bg-secondary/40'
                                }`}
                            >
                                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                                    {renderChildLinks(r.children, r.childNames, regHref)}
                                </td>
                                <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">
                                    {r.parentId ? (
                                        <Link href={`/dashboard/parents/${r.parentId}`} className="text-primary hover:underline">
                                            {r.parentName}
                                        </Link>
                                    ) : (
                                        r.parentName
                                    )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                    <div>{r.parentEmail}</div>
                                    <div>{r.parentPhone}</div>
                                </td>
                                <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{r.centre}</td>
                                <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{r.startDate}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {isOverdue ? (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning/10 text-warning border border-warning/20">
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
            <SectionHeading icon={BookOpen} title="New Bookings" iconClass="text-primary" bgClass="bg-primary/10" />
            {rows.length === 0 ? (
                <EmptyState message="No new bookings for this period." />
            ) : (
                <TableWrapper headers={headers}>
                    {rows.map((b, i) => (
                        <tr key={i} className="hover:bg-secondary/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                                {renderChildLinks(b.children, b.childNames)}
                            </td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">
                                {b.parentId ? (
                                    <Link href={`/dashboard/parents/${b.parentId}`} className="text-primary hover:underline">
                                        {b.parentName}
                                    </Link>
                                ) : (
                                    b.parentName
                                )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{b.parentEmail}</td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{b.centre}</td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{b.sessionDate}</td>
                            <td className="px-4 py-3">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
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
            <SectionHeading icon={BarChart3} title="Attendance by Centre" iconClass="text-success" bgClass="bg-success/10" />
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
    overdue_registration: 'bg-warning/10 text-warning border-warning/20',
    missed_attendance: 'bg-destructive/10 text-destructive border-destructive/20',
};

function PendingActionsSection({ rows }: { rows: WeeklyReportData['pendingActions'] }) {
    const headers = ['Type', 'Name', 'Description', 'Date', 'Days Pending'];
    return (
        <div id="pending-actions-section">
            <SectionHeading icon={AlertTriangle} title="Pending Actions" iconClass="text-warning" bgClass="bg-warning/10" />
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
                            <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{p.href ? <Link href={p.href} className="text-primary underline underline-offset-2">{p.name}</Link> : p.name}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{p.description}</td>
                            <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{p.date}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${p.daysPending >= 7
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : 'bg-warning/10 text-warning border-warning/20'
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
    const [centreId, setCentreId] = useState('all');
    const [centreOptions, setCentreOptions] = useState<{id: string; name: string}[]>([]);
    const requestId = useRef(0);
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

        const request = ++requestId.current;
        setError(null);
        setPdfError(null);
        setReportData(null);
        setIsLoading(true);

        try {
            const data = await getWeeklyReport(range.start, range.end, centreId);
            if (request !== requestId.current) return;
            setReportData(data);
            setCentreOptions(data.scope?.centres ?? []);
        } catch (err) {
            if (request === requestId.current) {
                const msg = err instanceof Error && err.message ? err.message : '';
                setError(
                    msg && /90 days|invalid date|after start date/i.test(msg)
                        ? msg
                        : 'We couldn’t load this report. Check the selected dates and centre, then refresh the report. No records were changed.'
                );
            }
        } finally {
            if (request === requestId.current) setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangeMode, customStart, customEnd, centreId]);

    useEffect(() => {
        if (rangeMode === 'custom' && (!customStart || !customEnd)) return;
        handlePreview();
    }, [handlePreview, rangeMode, customStart, customEnd]);

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
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-xl leading-tight">Activity Report</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Preview and download an executive summary for the selected period</p>
                        <p className="text-sm text-muted-foreground mt-1">Scope: {reportData?.scope?.label ?? (centreId === 'all' ? 'All accessible centres' : centreOptions.find(centre => centre.id === centreId)?.name ?? 'Selected centre')}. The report selector controls this report; it is separate from the active centre in the sidebar.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <label className="text-sm text-foreground">Report centre
                        <select aria-label="Report centre" value={centreId} onChange={event => { setCentreId(event.target.value); setReportData(null); }} className="ml-2 min-h-11 rounded-lg border border-border bg-card px-3 text-foreground">
                            <option value="all">All accessible centres</option>
                            {centreOptions.map(centre => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
                        </select>
                    </label>
                    {(['this_week', 'last_week', 'custom'] as const).map((mode) => {
                        const label = mode === 'this_week' ? 'Week to Date' : mode === 'last_week' ? 'Last Full Week' : 'Custom Range';
                        return (
                            <button
                                key={mode}
                                onClick={() => { setRangeMode(mode); setReportData(null); setError(null); setPdfError(null); }}
                                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border ${rangeMode === mode
                                    ? 'bg-primary text-white border-primary shadow-sm'
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
                    className="w-full py-4 bg-secondary border border-border text-foreground hover:bg-secondary/80 font-bold rounded-2xl text-sm transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Generating Report…</>
                    ) : (
                        <><Calendar className="w-4 h-4" />Refresh Report</>
                    )}
                </button>

                {error && (
                    <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                        {error}
                    </div>
                )}
            </div>

            {/* ── Loading ──────────────────────────────────────────────────── */}
            {isLoading && (
                <div className="bg-card border border-border rounded-3xl p-16 flex flex-col items-center gap-4 shadow-sm">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
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
                                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 rounded-2xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPdfLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />Generating PDF…</>
                                ) : (
                                    <><Download className="w-4 h-4" />Download PDF</>
                                )}
                            </button>
                            {pdfError && (
                                <p className="text-xs text-destructive font-medium max-w-xs text-right">{pdfError}</p>
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

                    {reportData.finance && <section aria-label="Financial activity" className="rounded-2xl border border-border bg-card p-5 space-y-4">
                        <h3 className="text-base font-semibold">Financial activity · {reportData.scope?.label ?? 'All accessible centres'}</h3>
                        <div className="grid gap-4 sm:grid-cols-3">{[
                            ['Cash collected', reportData.finance.cashCollected, 'Verified, unreversed payment allocations recorded in the selected period against currently issued, non-void invoices.'],
                            ['Invoiced', reportData.finance.invoiced, 'Currently issued, non-void invoices dated in the selected period. This is not money received.'],
                            ['Drafts prepared', reportData.finance.draftsPrepared, 'Invoices created in the selected period that are still drafts. These have not been issued and are not income.'],
                        ].map(([label,value,description]) => <div key={label}><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP'}).format(Number(value))}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>)}</div>
                        <p className="text-xs text-muted-foreground">Current record status is used, so later verification, reversal or invoice changes can change a past report. Payment recording date is not the bank settlement date. This is not a historical accounting statement.</p>
                        <p className="text-sm text-muted-foreground">Debt ageing is not included. <Link className="text-primary underline" href={`/dashboard/finance?${new URLSearchParams({...((reportData.scope?.centreId && reportData.scope.centreId !== 'all') ? {centre:reportData.scope.centreId} : {centre:'all'}), task:'payments'})}`}>Review outstanding invoices and due dates</Link>.</p>
                    </section>}
                    <p className="text-sm text-muted-foreground">Pending actions use the same centre scope. Overdue registrations include the full backlog; missing attendance covers the last 30 days, regardless of the activity period.</p>
                    {/* 5. Pending Actions */}
                    <PendingActionsSection rows={reportData.pendingActions} />
                </div>
            )}
        </div>
    );
}
