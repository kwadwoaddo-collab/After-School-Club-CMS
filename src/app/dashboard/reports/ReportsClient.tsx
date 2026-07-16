'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Calendar, FileText, Users, BarChart3, Check } from 'lucide-react';
import { getExportData } from '@/features/bookings/actions';
import { getStudentExportData } from '@/features/students/actions';
import { cn } from '@/components/ui/utils';
import { resolveAttendanceStatus } from '@/lib/attendance';
import WeeklyReportTab from './WeeklyReportTab';
import type { AttendanceStatus } from '@/lib/attendance';

type ReportsTab = 'exports' | 'ceo';
type FilterType = 'all' | 'month' | 'week' | 'custom';

export default function ReportsClient() {
    const [activeTab, setActiveTab] = useState<ReportsTab>('exports');
    const [isExportingBookings, setIsExportingBookings] = useState(false);
    const [isExportingStudents, setIsExportingStudents] = useState(false);
    const [exportedBookings, setExportedBookings] = useState<FilterType | null>(null);
    const [exportedStudents, setExportedStudents] = useState<FilterType | null>(null);

    const [showCustomRangeBooking, setShowCustomRangeBooking] = useState(false);
    const [startDateBooking, setStartDateBooking] = useState('');
    const [endDateBooking, setEndDateBooking] = useState('');

    const [showCustomRangeStudent, setShowCustomRangeStudent] = useState(false);
    const [startDateStudent, setStartDateStudent] = useState('');
    const [endDateStudent, setEndDateStudent] = useState('');

    const [bookingExportMsg, setBookingExportMsg] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
    const [studentExportMsg, setStudentExportMsg] = useState<{ text: string; type: 'error' | 'info' } | null>(null);

    const handleExportBookings = async (filter: FilterType) => {
        setBookingExportMsg(null);
        if (filter === 'custom' && (!startDateBooking || !endDateBooking)) {
            setBookingExportMsg({ text: 'Please select both start and end dates.', type: 'error' });
            return;
        }

        setIsExportingBookings(true);
        try {
            const data = await getExportData();

            const now = new Date();
            const filteredData = data.filter(item => {
                const date = new Date(item.startAt);
                if (filter === 'month') {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(now.getDate() - 30);
                    return date > thirtyDaysAgo;
                }
                if (filter === 'week') {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(now.getDate() - 7);
                    return date > sevenDaysAgo;
                }
                if (filter === 'custom') {
                    const start = new Date(startDateBooking);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDateBooking);
                    end.setHours(23, 59, 59, 999);
                    return date >= start && date <= end;
                }
                return true;
            });

            if (filteredData.length === 0) {
                setBookingExportMsg({ text: 'No records found for the selected period.', type: 'info' });
                return;
            }

            const headers = ['Booking ID', 'Date', 'Status', 'Student', 'Parent Email', 'Centre', 'Feedback Status', 'Score'];
            const rows = filteredData.map(item => [
                item.bookingId,
                new Date(item.startAt).toLocaleString('en-GB'),
                resolveAttendanceStatus((item.attendanceStatus as AttendanceStatus | null) ?? null, item.status).label,
                `${item.childFirstName} ${item.childLastName}`,
                item.parentEmail,
                item.centreName,
                item.feedbackStatus,
                item.feedbackScore || 'N/A'
            ]);

            downloadCSV(headers, rows, `session_bookings_${filter}_${new Date().toISOString().split('T')[0]}.csv`);
            setExportedBookings(filter);
            setTimeout(() => setExportedBookings(null), 2500);

            if (filter === 'custom') {
                setShowCustomRangeBooking(false);
                setStartDateBooking('');
                setEndDateBooking('');
            }
        } catch (error) {
            console.error('Export failed:', error);
            setBookingExportMsg({ text: 'Export failed. Please try again.', type: 'error' });
        } finally {
            setIsExportingBookings(false);
        }
    };

    const handleExportStudents = async (filter: FilterType) => {
        setStudentExportMsg(null);
        if (filter === 'custom' && (!startDateStudent || !endDateStudent)) {
            setStudentExportMsg({ text: 'Please select both start and end dates.', type: 'error' });
            return;
        }

        setIsExportingStudents(true);
        try {
            const data = await getStudentExportData();

            const now = new Date();
            const filteredData = data.filter(item => {
                if (!item.createdAt) return filter === 'all';
                const date = new Date(item.createdAt);
                if (filter === 'month') {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(now.getDate() - 30);
                    return date > thirtyDaysAgo;
                }
                if (filter === 'week') {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(now.getDate() - 7);
                    return date > sevenDaysAgo;
                }
                if (filter === 'custom') {
                    const start = new Date(startDateStudent);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDateStudent);
                    end.setHours(23, 59, 59, 999);
                    return date >= start && date <= end;
                }
                return true;
            });

            if (filteredData.length === 0) {
                setStudentExportMsg({ text: 'No student records found for the selected period.', type: 'info' });
                return;
            }

            const headers = ['Student ID', 'First Name', 'Last Name', 'Date of Birth', 'School Year', 'Parent First Name', 'Parent Last Name', 'Parent Email', 'Parent Phone', 'Registration Date'];
            const rows = filteredData.map(item => [
                item.studentId,
                item.firstName,
                item.lastName,
                item.dateOfBirth ? new Date(item.dateOfBirth).toLocaleDateString('en-GB') : 'N/A',
                item.schoolYear || 'N/A',
                item.parentFirstName,
                item.parentLastName,
                item.parentEmail || 'N/A',
                item.parentPhone || 'N/A',
                item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB') : 'N/A'
            ]);

            downloadCSV(headers, rows, `student_data_${filter}_${new Date().toISOString().split('T')[0]}.csv`);
            setExportedStudents(filter);
            setTimeout(() => setExportedStudents(null), 2500);

            if (filter === 'custom') {
                setShowCustomRangeStudent(false);
                setStartDateStudent('');
                setEndDateStudent('');
            }
        } catch (error) {
            console.error('Export failed:', error);
            setStudentExportMsg({ text: 'Export failed. Please try again.', type: 'error' });
        } finally {
            setIsExportingStudents(false);
        }
    };

    const downloadCSV = (headers: string[], rows: (string | number | null | undefined)[][], fileName: string) => {
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    return (
        <div className="flex flex-col gap-6">

            {/* ── Tab Switcher ─────────────────────────────────────────────── */}
            <div className="inline-flex bg-gray-100 p-1 rounded-2xl gap-1">
                <button
                    onClick={() => setActiveTab('exports')}
                    className={cn(
                        'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                        activeTab === 'exports'
                            ? 'bg-white text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    Data Exports
                </button>
                <button
                    onClick={() => setActiveTab('ceo')}
                    className={cn(
                        'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                        activeTab === 'ceo'
                            ? 'bg-white text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <BarChart3 className="w-4 h-4" />
                    CEO Weekly Report
                </button>
            </div>

            {/* ── CEO Weekly Report Tab ────────────────────────────────────── */}
            {activeTab === 'ceo' && <WeeklyReportTab />}

            {/* ── Data Exports Tab ─────────────────────────────────────────── */}
            {activeTab === 'exports' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* ── Booking Export Card ───────────────────────────────── */}
                    <div className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col gap-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-foreground text-xl leading-tight">Export Bookings</h2>
                                <p className="text-sm text-muted-foreground mt-0.5">Download session schedules and records</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {!showCustomRangeBooking ? (
                                <>
                                    <ExportRow
                                        label="All History"
                                        icon={FileSpreadsheet}
                                        iconColor="text-blue-600"
                                        onExport={() => handleExportBookings('all')}
                                        isLoading={isExportingBookings}
                                        isSuccess={exportedBookings === 'all'}
                                    />
                                    <ExportRow
                                        label="Last 30 Days"
                                        icon={FileSpreadsheet}
                                        iconColor="text-blue-600"
                                        onExport={() => handleExportBookings('month')}
                                        isLoading={isExportingBookings}
                                        isSuccess={exportedBookings === 'month'}
                                    />
                                    <button
                                        onClick={() => setShowCustomRangeBooking(true)}
                                        disabled={isExportingBookings}
                                        className="w-full flex items-center justify-between px-5 py-4 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-2xl text-sm font-semibold text-foreground transition-all shadow-sm group disabled:opacity-60"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                                            Custom Range
                                        </span>
                                        <span className="text-xs text-muted-foreground font-medium">Select dates →</span>
                                    </button>
                                </>
                            ) : (
                                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Range</h4>
                                        <button onClick={() => setShowCustomRangeBooking(false)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">Cancel</button>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Start Date</label>
                                        <input
                                            type="date"
                                            value={startDateBooking}
                                            onChange={(e) => setStartDateBooking(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-foreground font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">End Date</label>
                                        <input
                                            type="date"
                                            value={endDateBooking}
                                            onChange={(e) => setEndDateBooking(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-foreground font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleExportBookings('custom')}
                                        disabled={isExportingBookings}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl text-sm transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
                                    >
                                        {isExportingBookings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        Export Selection
                                    </button>
                                </div>
                            )}
                            {bookingExportMsg && (
                                <p className={`text-xs font-semibold px-4 py-3 rounded-xl ${
                                    bookingExportMsg.type === 'error'
                                        ? 'bg-red-50 text-red-600 border border-red-200'
                                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                                }`}>{bookingExportMsg.text}</p>
                            )}
                        </div>
                    </div>

                    {/* ── Student Export Card ───────────────────────────────── */}
                    <div className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col gap-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-violet-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-foreground text-xl leading-tight">Export Student Data</h2>
                                <p className="text-sm text-muted-foreground mt-0.5">Download contact info and registrations</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {!showCustomRangeStudent ? (
                                <>
                                    <ExportRow
                                        label="All Registered Students"
                                        icon={FileSpreadsheet}
                                        iconColor="text-violet-600"
                                        onExport={() => handleExportStudents('all')}
                                        isLoading={isExportingStudents}
                                        isSuccess={exportedStudents === 'all'}
                                    />
                                    <ExportRow
                                        label="Registered Last 30 Days"
                                        icon={FileSpreadsheet}
                                        iconColor="text-violet-600"
                                        onExport={() => handleExportStudents('month')}
                                        isLoading={isExportingStudents}
                                        isSuccess={exportedStudents === 'month'}
                                    />
                                    <button
                                        onClick={() => setShowCustomRangeStudent(true)}
                                        disabled={isExportingStudents}
                                        className="w-full flex items-center justify-between px-5 py-4 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-2xl text-sm font-semibold text-foreground transition-all shadow-sm group disabled:opacity-60"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-muted-foreground group-hover:text-violet-600 transition-colors" />
                                            Custom Reg. Date Range
                                        </span>
                                        <span className="text-xs text-muted-foreground font-medium">Select dates →</span>
                                    </button>
                                </>
                            ) : (
                                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Range</h4>
                                        <button onClick={() => setShowCustomRangeStudent(false)} className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">Cancel</button>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Start Date</label>
                                        <input
                                            type="date"
                                            value={startDateStudent}
                                            onChange={(e) => setStartDateStudent(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-foreground font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">End Date</label>
                                        <input
                                            type="date"
                                            value={endDateStudent}
                                            onChange={(e) => setEndDateStudent(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-foreground font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleExportStudents('custom')}
                                        disabled={isExportingStudents}
                                        className="w-full py-3 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-bold rounded-2xl text-sm transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
                                    >
                                        {isExportingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        Export Selection
                                    </button>
                                </div>
                            )}
                            {studentExportMsg && (
                                <p className={`text-xs font-semibold px-4 py-3 rounded-xl ${
                                    studentExportMsg.type === 'error'
                                        ? 'bg-red-50 text-red-600 border border-red-200'
                                        : 'bg-violet-50 text-violet-600 border border-violet-200'
                                }`}>{studentExportMsg.text}</p>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}

// ── Shared export row button component ──────────────────────────────────────
function ExportRow({
    label,
    icon: Icon,
    iconColor,
    onExport,
    isLoading,
    isSuccess,
}: {
    label: string;
    icon: React.ElementType;
    iconColor: string;
    onExport: () => void;
    isLoading: boolean;
    isSuccess: boolean;
}) {
    return (
        <button
            onClick={onExport}
            disabled={isLoading}
            className={cn(
                'w-full flex items-center justify-between px-5 py-4 rounded-2xl text-sm font-semibold transition-all border group disabled:opacity-60',
                isSuccess
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-gray-200 text-foreground hover:bg-gray-50 hover:border-gray-300 shadow-sm'
            )}
        >
            <span className="flex items-center gap-3">
                <Icon className={cn('w-5 h-5 transition-transform group-hover:scale-110', isSuccess ? 'text-emerald-600' : iconColor)} />
                {label}
            </span>
            {isLoading
                ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                : isSuccess
                ? <Check className="w-4 h-4 text-emerald-600" />
                : <Download className="w-4 h-4 text-muted-foreground" />
            }
        </button>
    );
}
