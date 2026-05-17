'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Calendar, FileText, Users } from 'lucide-react';
import { getExportData } from '@/features/bookings/actions';
import { getStudentExportData } from '@/features/students/actions';
import { cn } from '@/components/ui/utils';
import { resolveAttendanceStatus } from '@/lib/attendance';
import type { AttendanceStatus } from '@/lib/attendance';

type FilterType = 'all' | 'month' | 'week' | 'custom';

export default function ReportsClient() {
    const [isExportingBookings, setIsExportingBookings] = useState(false);
    const [isExportingStudents, setIsExportingStudents] = useState(false);
    
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

            downloadCSV(headers, rows, `assessment_bookings_${filter}_${new Date().toISOString().split('T')[0]}.csv`);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Booking Export Card */}
            <div className="bg-[#20201f] rounded-[32px] p-8 flex flex-col gap-6 border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#2a2a2a] rounded-2xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[#adc6ff]" />
                    </div>
                    <div>
                        <h2 className="font-bold text-[#e5e2e1] text-xl leading-tight">Export Bookings</h2>
                        <p className="text-sm text-[#8c909f] mt-1">Download assessment schedules and records</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {!showCustomRangeBooking ? (
                        <>
                            <button
                                onClick={() => handleExportBookings('all')}
                                disabled={isExportingBookings}
                                className="w-full flex items-center justify-between px-5 py-4 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-[#e5e2e1] transition-all border border-[#424754]/15 shadow-sm group disabled:opacity-50"
                            >
                                <span className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-[#adc6ff] group-hover:scale-110 transition-transform" />
                                    All History
                                </span>
                                {isExportingBookings ? <Loader2 className="w-4 h-4 text-[#adc6ff] animate-spin" /> : <Download className="w-4 h-4 text-[#8c909f]" />}
                            </button>
                            <button
                                onClick={() => handleExportBookings('month')}
                                disabled={isExportingBookings}
                                className="w-full flex items-center justify-between px-5 py-4 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-[#e5e2e1] transition-all border border-[#424754]/15 shadow-sm group disabled:opacity-50"
                            >
                                <span className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-[#adc6ff] group-hover:scale-110 transition-transform" />
                                    Last 30 Days
                                </span>
                                {isExportingBookings ? <Loader2 className="w-4 h-4 text-[#adc6ff] animate-spin" /> : <Download className="w-4 h-4 text-[#8c909f]" />}
                            </button>
                            <button
                                onClick={() => setShowCustomRangeBooking(true)}
                                disabled={isExportingBookings}
                                className="w-full flex items-center justify-between px-5 py-4 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-[#e5e2e1] transition-all border border-[#424754]/15 shadow-sm group disabled:opacity-50"
                            >
                                <span className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-[#8c909f] group-hover:text-[#adc6ff] group-hover:scale-110 transition-all" />
                                    Custom Range
                                </span>
                            </button>
                        </>
                    ) : (
                        <div className="p-5 bg-[#2a2a2a] rounded-2xl border border-[#424754]/15 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-bold text-[#8c909f] uppercase tracking-wider">Custom Range</h4>
                                <button onClick={() => setShowCustomRangeBooking(false)} className="text-xs font-bold text-[#adc6ff] hover:underline">Cancel</button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#8c909f] uppercase mb-1.5">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDateBooking}
                                        onChange={(e) => setStartDateBooking(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#131313] border border-[#424754]/30 rounded-xl text-sm text-[#e5e2e1] font-mono outline-none focus:border-[#adc6ff]/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#8c909f] uppercase mb-1.5">End Date</label>
                                    <input
                                        type="date"
                                        value={endDateBooking}
                                        onChange={(e) => setEndDateBooking(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#131313] border border-[#424754]/30 rounded-xl text-sm text-[#e5e2e1] font-mono outline-none focus:border-[#adc6ff]/50 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={() => handleExportBookings('custom')}
                                    disabled={isExportingBookings}
                                    className="w-full py-3 mt-2 bg-[#adc6ff] hover:bg-[#8facff] text-[#131313] font-bold rounded-xl text-sm transition-all flex justify-center items-center gap-2 shadow-[0_4px_16px_rgba(173,198,255,0.2)] disabled:opacity-50"
                                >
                                    {isExportingBookings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Export Selection
                                </button>
                            </div>
                        </div>
                    )}
                    {bookingExportMsg && (
                        <p className={`text-xs font-bold px-4 py-3 rounded-xl ${
                            bookingExportMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[#adc6ff]/10 text-[#adc6ff] border border-[#adc6ff]/20'
                        }`}>{bookingExportMsg.text}</p>
                    )}
                </div>
            </div>

            {/* Student Export Card */}
            <div className="bg-[#20201f] rounded-[32px] p-8 flex flex-col gap-6 border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#2a2a2a] rounded-2xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-[#d0bcff]" />
                    </div>
                    <div>
                        <h2 className="font-bold text-[#e5e2e1] text-xl leading-tight">Export Student Data</h2>
                        <p className="text-sm text-[#8c909f] mt-1">Download contact info and registrations</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {!showCustomRangeStudent ? (
                        <>
                            <button
                                onClick={() => handleExportStudents('all')}
                                disabled={isExportingStudents}
                                className="w-full flex items-center justify-between px-5 py-4 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-[#e5e2e1] transition-all border border-[#424754]/15 shadow-sm group disabled:opacity-50"
                            >
                                <span className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-[#d0bcff] group-hover:scale-110 transition-transform" />
                                    All Registered Students
                                </span>
                                {isExportingStudents ? <Loader2 className="w-4 h-4 text-[#d0bcff] animate-spin" /> : <Download className="w-4 h-4 text-[#8c909f]" />}
                            </button>
                            <button
                                onClick={() => handleExportStudents('month')}
                                disabled={isExportingStudents}
                                className="w-full flex items-center justify-between px-5 py-4 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-[#e5e2e1] transition-all border border-[#424754]/15 shadow-sm group disabled:opacity-50"
                            >
                                <span className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-[#d0bcff] group-hover:scale-110 transition-transform" />
                                    Registered Last 30 Days
                                </span>
                                {isExportingStudents ? <Loader2 className="w-4 h-4 text-[#d0bcff] animate-spin" /> : <Download className="w-4 h-4 text-[#8c909f]" />}
                            </button>
                            <button
                                onClick={() => setShowCustomRangeStudent(true)}
                                disabled={isExportingStudents}
                                className="w-full flex items-center justify-between px-5 py-4 bg-[#2a2a2a] hover:bg-[#353535] rounded-2xl text-sm font-bold text-[#e5e2e1] transition-all border border-[#424754]/15 shadow-sm group disabled:opacity-50"
                            >
                                <span className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-[#8c909f] group-hover:text-[#d0bcff] group-hover:scale-110 transition-all" />
                                    Custom Reg. Date Range
                                </span>
                            </button>
                        </>
                    ) : (
                        <div className="p-5 bg-[#2a2a2a] rounded-2xl border border-[#424754]/15 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-bold text-[#8c909f] uppercase tracking-wider">Custom Range</h4>
                                <button onClick={() => setShowCustomRangeStudent(false)} className="text-xs font-bold text-[#d0bcff] hover:underline">Cancel</button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#8c909f] uppercase mb-1.5">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDateStudent}
                                        onChange={(e) => setStartDateStudent(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#131313] border border-[#424754]/30 rounded-xl text-sm text-[#e5e2e1] font-mono outline-none focus:border-[#d0bcff]/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#8c909f] uppercase mb-1.5">End Date</label>
                                    <input
                                        type="date"
                                        value={endDateStudent}
                                        onChange={(e) => setEndDateStudent(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#131313] border border-[#424754]/30 rounded-xl text-sm text-[#e5e2e1] font-mono outline-none focus:border-[#d0bcff]/50 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={() => handleExportStudents('custom')}
                                    disabled={isExportingStudents}
                                    className="w-full py-3 mt-2 bg-[#d0bcff] hover:bg-[#bd9eff] text-[#131313] font-bold rounded-xl text-sm transition-all flex justify-center items-center gap-2 shadow-[0_4px_16px_rgba(208,188,255,0.2)] disabled:opacity-50"
                                >
                                    {isExportingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Export Selection
                                </button>
                            </div>
                        </div>
                    )}
                    {studentExportMsg && (
                        <p className={`text-xs font-bold px-4 py-3 rounded-xl ${
                            studentExportMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[#d0bcff]/10 text-[#d0bcff] border border-[#d0bcff]/20'
                        }`}>{studentExportMsg.text}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
