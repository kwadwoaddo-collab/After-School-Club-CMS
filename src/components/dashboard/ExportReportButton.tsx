'use client';

import { useState } from 'react';
import { Download, ChevronDown, FileSpreadsheet, Loader2, Calendar } from 'lucide-react';
import { getExportData } from '@/features/bookings/actions';
import { cn } from '@/components/ui/utils';

type FilterType = 'all' | 'month' | 'week' | 'custom';

export default function ExportReportButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showCustomRange, setShowCustomRange] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleExport = async (filter: FilterType) => {
        if (filter === 'custom' && (!startDate || !endDate)) {
            alert('Please select both start and end dates');
            return;
        }

        setIsExporting(true);
        setIsOpen(false);
        try {
            const data = await getExportData();

            // Filter based on the selection
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
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    return date >= start && date <= end;
                }
                return true;
            });

            if (filteredData.length === 0) {
                alert('No records found for the selected period.');
                return;
            }

            // Convert to CSV
            const headers = ['Booking ID', 'Date', 'Status', 'Student', 'Parent Email', 'Centre', 'Feedback Status', 'Score'];
            const rows = filteredData.map(item => [
                item.bookingId,
                new Date(item.startAt).toLocaleString(),
                item.status,
                `${item.childFirstName} ${item.childLastName}`,
                item.parentEmail,
                item.centreName,
                item.feedbackStatus,
                item.feedbackScore || 'N/A'
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
            ].join('\n');

            // Trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            const fileName = filter === 'custom'
                ? `assessment_report_custom_${startDate}_to_${endDate}.csv`
                : `assessment_report_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Reset custom range after success
            if (filter === 'custom') {
                setShowCustomRange(false);
                setStartDate('');
                setEndDate('');
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export report. See console for details.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    setShowCustomRange(false);
                }}
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Download className="w-4 h-4" />}
                Export Report
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {!showCustomRange ? (
                        <>
                            <button
                                onClick={() => handleExport('all')}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-2xl transition-colors"
                            >
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                </div>
                                All History
                            </button>
                            <button
                                onClick={() => handleExport('month')}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-2xl transition-colors"
                            >
                                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                                </div>
                                Last 30 Days
                            </button>
                            <button
                                onClick={() => handleExport('week')}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-2xl transition-colors"
                            >
                                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                                    <FileSpreadsheet className="w-4 h-4 text-violet-500" />
                                </div>
                                Last 7 Days
                            </button>
                            <div className="h-px bg-slate-100 my-1 mx-2" />
                            <button
                                onClick={() => setShowCustomRange(true)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-2xl transition-colors"
                            >
                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                </div>
                                Custom Date Range
                            </button>
                        </>
                    ) : (
                        <div className="p-4 space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custom Range</h4>
                                <button onClick={() => setShowCustomRange(false)} className="text-[10px] font-bold text-primary hover:underline">Back</button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <button
                                    onClick={() => handleExport('custom')}
                                    className="w-full py-2.5 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all mt-2"
                                >
                                    Export Selection
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
