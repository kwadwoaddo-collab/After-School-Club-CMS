'use client';

import { useRouter } from 'next/navigation';
import { updateBookingStatus } from '@/features/bookings/actions';
import { useTransition } from 'react';
import { Calendar, User, Clock, ChevronRight } from 'lucide-react';

interface Student {
    id: string;
    firstName: string;
    lastName: string;
    grade: string | null;
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string | null;
    parentEmail: string | null;
    nextAppointment: Date | null;
    centreName: string | null;
    bookingId: string | null;
    status: 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | null;
}

interface RecentStudentsTableProps {
    students: Student[];
}

import { useState, useEffect } from 'react';

export default function RecentStudentsTable({ students }: RecentStudentsTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleRowClick = (student: Student) => {
        router.push(`/dashboard/students/${student.id}`);
    };

    const handleStatusClick = (e: React.MouseEvent, student: Student) => {
        e.stopPropagation();
        if (!student.bookingId || !student.status || isPending) return;

        const nextStatusMap: Record<string, 'completed' | 'cancelled' | 'confirmed'> = {
            'confirmed': 'completed',
            'completed': 'cancelled',
            'cancelled': 'confirmed',
            'rescheduled': 'confirmed',
        };

        const currentStatus = student.status;
        const nextStatus = nextStatusMap[currentStatus] || 'confirmed';

        startTransition(async () => {
            try {
                await updateBookingStatus(student.bookingId!, nextStatus);
            } catch (error) {
                console.error('Failed to update status', error);
            }
        });
    };

    const getStatusIndicator = (status: string | null) => {
        if (!status) return null;

        const config = {
            confirmed: {
                color: 'bg-primary',
                bg: 'bg-primary/10',
                border: 'border-primary/20',
                text: 'Confirmed'
            },
            completed: {
                color: 'bg-emerald-500',
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/20',
                text: 'Completed'
            },
            cancelled: {
                color: 'bg-rose-500',
                bg: 'bg-rose-500/10',
                border: 'border-rose-500/20',
                text: 'Cancelled'
            },
            rescheduled: {
                color: 'bg-amber-500',
                bg: 'bg-amber-500/10',
                border: 'border-amber-500/20',
                text: 'Rescheduled'
            },
        };

        const { color, bg, border, text } = config[status as keyof typeof config] || { color: 'bg-slate-400', bg: 'bg-slate-100', border: 'border-slate-200', text: status };

        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${bg} border ${border} w-fit transition-all group-hover:scale-105`}>
                <span className={`status-dot ${color}`}></span>
                <span className={`text-[10px] font-bold text-slate-700 uppercase tracking-widest`}>{text}</span>
            </div>
        );
    };

    const formatApptDate = (date: Date) => {
        if (!mounted) return "...";
        return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    };

    const formatApptTime = (date: Date) => {
        if (!mounted) return "...";
        return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
                <thead>
                    <tr className="border-b border-slate-100">
                        <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Student</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Appointment</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Parent & Contact</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {students.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                                No recent bookings found.
                            </td>
                        </tr>
                    ) : (
                        students.map((student) => (
                            <tr
                                key={student.id}
                                className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                onClick={() => handleRowClick(student)}
                            >
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200 group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                                            {student.firstName[0]}{student.lastName[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 leading-none">{student.firstName} {student.lastName}</div>
                                            <div className="text-[11px] font-bold text-primary mt-1 px-1.5 py-0.5 bg-primary/5 rounded w-fit uppercase">{student.grade}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <div className="text-sm font-medium">
                                            {student.nextAppointment ? (
                                                <>
                                                    <span className="text-slate-900 font-bold">{formatApptDate(student.nextAppointment)}</span>
                                                    <span className="text-slate-400 ml-2">{formatApptTime(student.nextAppointment)}</span>
                                                </>
                                            ) : '-'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                                        <span className="text-[11px] font-medium text-slate-400 tracking-wide">{student.centreName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div onClick={(e) => handleStatusClick(e, student)}>
                                        {getStatusIndicator(student.status)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-slate-900">{student.parentFirstName} {student.parentLastName}</div>
                                    <div className="text-xs font-medium text-slate-400 mt-0.5">{student.parentEmail || student.parentPhone}</div>
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <button className="p-2 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
